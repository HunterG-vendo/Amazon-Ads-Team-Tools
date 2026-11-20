/* PLTFRM Team Tools: validation for data files, uploads and manager edits.
   Pure functions only (no DOM), so the same checks run in the browser and in tests. */
(function (root) {
  'use strict';

  var TARGETS = {
    'amc-queries': { id: 'amc-queries', label: 'AMC Queries', file: 'amc-queries.json', path: 'data/amc-queries.json', kind: 'data', noun: 'query', nouns: 'queries' },
    'apps':        { id: 'apps',        label: 'Apps',        file: 'apps.json',        path: 'data/apps.json',        kind: 'data', noun: 'app',   nouns: 'apps' },
    'skills':      { id: 'skills',      label: 'Skills',      file: 'skills.json',      path: 'data/skills.json',      kind: 'data', noun: 'skill', nouns: 'skills' },
    'resources':   { id: 'resources',   label: 'Resources',   file: 'resources.json',   path: 'data/resources.json',   kind: 'data', noun: 'resource', nouns: 'resources' },
    'config':      { id: 'config',      label: 'Tags & Categories', file: 'config.json', path: 'data/config.json',      kind: 'config', noun: 'tag', nouns: 'tags' }
  };
  var DATA_TARGETS = ['amc-queries', 'apps', 'skills', 'resources'];

  // Site code files that the Upload tab is allowed to replace.
  var SITE_FILES = ['index.html', 'js/core.js', 'js/validate.js', 'js/analyzer.js', 'js/tab-amc.js',
                    'js/tab-apps.js', 'js/tab-skills.js', 'js/tab-resources.js', 'js/manager.js'];
  var RESERVED_TAGS = ['app', 'skill', 'amc query', 'resource'];
  var LOG_CAP = 150;
  var SIZE_WARN = 900 * 1024;

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }
  function nonEmpty(v) { return isStr(v) && v.trim() !== ''; }
  function isHttpUrl(v) { return isStr(v) && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v.trim()); }
  function isHex(v) { return isStr(v) && /^#[0-9a-f]{6}$/i.test(v); }
  function isStrArray(v) { return Array.isArray(v) && v.every(isStr); }

  function b64Prefix(str, n) {
    var chunk = str.slice(0, n);
    if (typeof atob === 'function') return atob(chunk);
    return Buffer.from(chunk, 'base64').toString('latin1');
  }
  function looksLikeZipBase64(v) {
    if (!nonEmpty(v)) return false;
    var s = v.replace(/\s+/g, '');
    if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false;
    try { return b64Prefix(s, 8).slice(0, 2) === 'PK'; } catch (e) { return false; }
  }

  // ---------- file names ----------
  // Browsers save repeat downloads as "apps (1).json"; treat that as "apps.json".
  function normalizeFileName(name) {
    var base = String(name || '').split(/[\\/]/).pop().trim();
    return base.replace(/\s\(\d+\)(?=\.[a-z0-9]+$)/i, '');
  }
  function checkFileName(targetId, name) {
    var t = TARGETS[targetId];
    var norm = normalizeFileName(name);
    if (norm === t.file) {
      return { ok: true, normalized: norm, note: norm !== String(name).split(/[\\/]/).pop().trim() ? 'Read "' + name + '" as ' + t.file + '.' : '' };
    }
    var other = null;
    Object.keys(TARGETS).forEach(function (k) { if (TARGETS[k].file === norm) other = TARGETS[k]; });
    return {
      ok: false, normalized: norm,
      message: other
        ? 'This is ' + other.file + ', which belongs to ' + other.label + '. Pick ' + other.label + ' above, or upload ' + t.file + ' here.'
        : 'The file must be named ' + t.file + ' (got "' + name + '"). Rename it and try again.'
    };
  }

  function parseJson(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      var msg = String(e && e.message || e).replace(/\s+/g, ' ');
      text = String(text);
      // The most common hand-editing mistake: a comma right before } or ]
      var tc = /,(\s*)([}\]])/.exec(text);
      if (tc) {
        var tcLine = text.slice(0, tc.index).split('\n').length;
        return { ok: false, error: 'Line ' + tcLine + ': extra comma before "' + tc[2] + '". Remove that comma.' };
      }
      var lc = msg.match(/line (\d+) column (\d+)/i);
      var m = msg.match(/position (\d+)/);
      var short = msg.replace(/ in JSON at position \d+.*$/, '').replace(/^JSON\.parse: /, '').replace(/ at line \d+ column \d+.*$/, '');
      if (lc) return { ok: false, error: 'Line ' + lc[1] + ', column ' + lc[2] + ': ' + short };
      if (m) {
        var pos = +m[1], before = text.slice(0, pos);
        return { ok: false, error: 'Line ' + before.split('\n').length + ', column ' + (pos - before.lastIndexOf('\n')) + ': ' + short };
      }
      return { ok: false, error: 'The file is not valid JSON (' + short.slice(0, 160) + ').' };
    }
  }

  // ---------- items ----------
  function itemLabel(targetId, item) {
    if (!isObj(item)) return '(not an object)';
    var n = targetId === 'amc-queries' ? item.title : item.name;
    return nonEmpty(n) ? n : (nonEmpty(item.id) ? item.id : '(untitled)');
  }

  // Returns { errors: [], warnings: [] } for one entry. ctx.tags = known tag names.
  function validateItem(targetId, item, ctx) {
    var errors = [], warnings = [];
    ctx = ctx || {};
    if (!isObj(item)) { errors.push('Entry is not an object.'); return { errors: errors, warnings: warnings }; }
    var who = '"' + itemLabel(targetId, item) + '"';

    if (!nonEmpty(item.id)) errors.push(who + ' has no id.');
    if (item.tags !== undefined && !isStrArray(item.tags)) errors.push(who + ': tags must be a list of text labels.');

    if (targetId === 'amc-queries') {
      if (nonEmpty(item.id) && !/^[A-Za-z0-9_-]+$/.test(item.id)) errors.push(who + ': id may only use letters, numbers, - and _ (it becomes part of the page link).');
      if (!nonEmpty(item.title)) errors.push((nonEmpty(item.id) ? '"' + item.id + '"' : 'A query') + ' has no title.');
      var parts = Array.isArray(item.sqlParts) ? item.sqlParts : null;
      if (item.sqlParts !== undefined && !parts) errors.push(who + ': sqlParts must be a list.');
      var partsWithSql = (parts || []).filter(function (p) { return isObj(p) && nonEmpty(p.sql); });
      (parts || []).forEach(function (p, i) {
        if (!isObj(p)) errors.push(who + ': SQL part ' + (i + 1) + ' is not an object.');
        else if (!nonEmpty(p.sql)) errors.push(who + ': SQL part ' + (i + 1) + (p.name ? ' ("' + p.name + '")' : '') + ' has no SQL.');
      });
      if (!nonEmpty(item.sql) && partsWithSql.length === 0) errors.push(who + ' has no SQL.');
      ['howTo', 'requirements', 'useCases'].forEach(function (k) {
        if (item[k] !== undefined && !isStrArray(item[k])) errors.push(who + ': ' + k + ' must be a list of text lines.');
      });
      if (item.example !== undefined && item.example !== null) {
        var ex = item.example;
        if (!isObj(ex) || !isStrArray(ex.columns) || !Array.isArray(ex.rows)) {
          errors.push(who + ': example must have columns (list) and rows (list of lists).');
        } else {
          ex.rows.forEach(function (r, i) {
            if (!Array.isArray(r)) errors.push(who + ': example row ' + (i + 1) + ' is not a list.');
            else if (r.length !== ex.columns.length) warnings.push(who + ': example row ' + (i + 1) + ' has ' + r.length + ' values but ' + ex.columns.length + ' columns.');
          });
        }
      }
      if (item.viz !== undefined && item.viz !== null && !isObj(item.viz)) errors.push(who + ': viz (analyzer settings) must be an object.');
      if (!nonEmpty(item.type)) warnings.push(who + ' has no category; it will be listed under Other.');
      if (!nonEmpty(item.summary)) warnings.push(who + ' has no summary.');
    } else {
      if (!nonEmpty(item.name)) errors.push((nonEmpty(item.id) ? '"' + item.id + '"' : 'An entry') + ' has no name.');
      if (targetId === 'skills') {
        var hasFile = nonEmpty(item.skillData);
        if (hasFile && !looksLikeZipBase64(item.skillData)) errors.push(who + ': the stored skill file is damaged (not a valid .skill/zip file).');
        if (!hasFile && !isHttpUrl(item.url)) errors.push(who + ' needs a skill file or a link that starts with https://.');
        if (nonEmpty(item.url) && !isHttpUrl(item.url)) errors.push(who + ': link must start with https:// (got "' + item.url + '").');
        if (hasFile && !/\.skill$/i.test(item.skillFileName || '')) warnings.push(who + ': file name should end in .skill.');
      } else {
        if (!nonEmpty(item.url)) errors.push(who + ' has no link.');
        else if (!isHttpUrl(item.url)) errors.push(who + ': link must start with https:// (got "' + item.url + '").');
      }
      if (!nonEmpty(item.desc)) warnings.push(who + ' has no description.');
      if (isStrArray(item.tags) && ctx.tags) {
        var known = ctx.tags.map(function (s) { return s.toLowerCase(); });
        item.tags.forEach(function (tg) {
          if (known.indexOf(tg.toLowerCase()) === -1) warnings.push(who + ': tag "' + tg + '" is not in the Tags list yet. It still shows, but add it under Tags so it appears there too.');
        });
      }
    }
    if (!nonEmpty(item.author) && targetId !== 'amc-queries') warnings.push(who + ' has no author.');
    return { errors: errors, warnings: warnings };
  }

  // Validates a whole data or config file object.
  function validateData(targetId, obj, ctx) {
    var t = TARGETS[targetId];
    var errors = [], warnings = [], checks = [];
    ctx = ctx || {};
    if (!isObj(obj)) { errors.push('The file must contain a JSON object, not ' + (Array.isArray(obj) ? 'a list' : typeof obj) + '.'); return { errors: errors, warnings: warnings, checks: checks }; }
    if (obj.file !== targetId) {
      errors.push(obj.file ? 'This file is marked as "' + obj.file + '", not "' + targetId + '". It may be the wrong file.' : 'The file is missing "file": "' + targetId + '". It may not be a Team Tools file.');
    } else checks.push('File is marked as ' + t.label);
    if (obj.schemaVersion !== 1) warnings.push('Unexpected schemaVersion (' + obj.schemaVersion + '). Expected 1.');
    if (obj.log !== undefined && !Array.isArray(obj.log)) errors.push('"log" must be a list.');

    if (t.kind === 'config') {
      if (!Array.isArray(obj.tags)) { errors.push('"tags" must be a list.'); return { errors: errors, warnings: warnings, checks: checks }; }
      var seen = {};
      obj.tags.forEach(function (tg, i) {
        if (!isObj(tg) || !nonEmpty(tg.name)) { errors.push('Tag ' + (i + 1) + ' has no name.'); return; }
        var key = tg.name.trim().toLowerCase();
        if (seen[key]) errors.push('Tag "' + tg.name + '" is listed twice.');
        seen[key] = true;
        if (RESERVED_TAGS.indexOf(key) !== -1) errors.push('"' + tg.name + '" is a tab name, not a tag. Remove it.');
        if (tg.color !== undefined && !isHex(tg.color)) errors.push('Tag "' + tg.name + '" has an unreadable color value ("' + tg.color + '"). Remove it or use a value like #4f9eff.');
      });
      if (!errors.length) checks.push(obj.tags.length + ' tags, all with a name');
      if (obj.amcCategories !== undefined) {
        if (!Array.isArray(obj.amcCategories)) errors.push('"amcCategories" must be a list.');
        else {
          var seenC = {}, catErrors = 0;
          obj.amcCategories.forEach(function (c, i) {
            if (!isObj(c) || !nonEmpty(c.name)) { errors.push('Category ' + (i + 1) + ' has no name.'); catErrors++; return; }
            var k = c.name.trim().toLowerCase();
            if (seenC[k]) { errors.push('Category "' + c.name + '" is listed twice.'); catErrors++; }
            seenC[k] = true;
            if (c.icon !== undefined && !(isStr(c.icon) && /^[a-z0-9-]+$/.test(c.icon))) { errors.push('Category "' + c.name + '" has an unreadable icon value.'); catErrors++; }
          });
          if (!catErrors) checks.push(obj.amcCategories.length + ' AMC categories, all with a name and icon');
        }
      }
      return { errors: errors, warnings: warnings, checks: checks };
    }

    if (!Array.isArray(obj.items)) { errors.push('"items" must be a list.'); return { errors: errors, warnings: warnings, checks: checks }; }
    var ids = {}, itemErrors = 0;
    obj.items.forEach(function (item) {
      var r = validateItem(targetId, item, ctx);
      if (r.errors.length) itemErrors++;
      errors.push.apply(errors, r.errors);
      warnings.push.apply(warnings, r.warnings);
      if (isObj(item) && nonEmpty(item.id)) {
        if (ids[item.id]) errors.push('Two entries share the id "' + item.id + '".');
        ids[item.id] = true;
      }
    });
    if (!itemErrors) checks.push(obj.items.length + ' ' + (obj.items.length === 1 ? t.noun : t.nouns) + ', all with the required fields');
    if (obj.items.length === 0) warnings.push('The file has no ' + t.nouns + '. Publishing it will empty the ' + t.label + ' tab.');
    return { errors: errors, warnings: warnings, checks: checks };
  }

  // ---------- diffs ----------
  function stable(v) { return JSON.stringify(v === undefined ? null : v); }
  function changedFields(a, b) {
    var keys = {}, out = [];
    Object.keys(a || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(b || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { if (stable(a && a[k]) !== stable(b && b[k])) out.push(k); });
    return out;
  }
  // Compares two item lists by id. Returns added, removed, changed and whether the order moved.
  function diffItems(targetId, oldItems, newItems) {
    oldItems = Array.isArray(oldItems) ? oldItems : [];
    newItems = Array.isArray(newItems) ? newItems : [];
    var byOld = {}, byNew = {};
    oldItems.forEach(function (it) { if (isObj(it) && it.id) byOld[it.id] = it; });
    newItems.forEach(function (it) { if (isObj(it) && it.id) byNew[it.id] = it; });
    var added = [], removed = [], changed = [], unchanged = 0;
    newItems.forEach(function (it) {
      if (!isObj(it) || !it.id) return;
      var prev = byOld[it.id];
      if (!prev) added.push({ id: it.id, label: itemLabel(targetId, it) });
      else {
        var f = changedFields(prev, it);
        if (f.length) changed.push({ id: it.id, label: itemLabel(targetId, it), fields: f });
        else unchanged++;
      }
    });
    oldItems.forEach(function (it) { if (isObj(it) && it.id && !byNew[it.id]) removed.push({ id: it.id, label: itemLabel(targetId, it) }); });
    var keptOld = oldItems.filter(function (it) { return isObj(it) && byNew[it.id]; }).map(function (it) { return it.id; });
    var keptNew = newItems.filter(function (it) { return isObj(it) && byOld[it.id]; }).map(function (it) { return it.id; });
    return { added: added, removed: removed, changed: changed, unchanged: unchanged, reordered: keptOld.join('\n') !== keptNew.join('\n') };
  }
  function diffTags(oldTags, newTags) {
    var o = {}, n = {}, added = [], removed = [], recolored = [];
    (oldTags || []).forEach(function (t) { o[t.name] = t.color; });
    (newTags || []).forEach(function (t) { n[t.name] = t.color; });
    Object.keys(n).forEach(function (k) { if (!(k in o)) added.push(k); else if (String(o[k]).toLowerCase() !== String(n[k]).toLowerCase()) recolored.push(k); });
    Object.keys(o).forEach(function (k) { if (!(k in n)) removed.push(k); });
    return { added: added, removed: removed, recolored: recolored };
  }
  // Tags and AMC categories together, in the same shape as item diffs
  function diffConfig(oldObj, newObj) {
    oldObj = oldObj || {}; newObj = newObj || {};
    var t = diffTags(oldObj.tags, newObj.tags);
    var oc = {}, nc = {}, added = [], removed = [], changed = [];
    (oldObj.amcCategories || []).forEach(function (c) { oc[c.name] = c; });
    (newObj.amcCategories || []).forEach(function (c) { nc[c.name] = c; });
    t.added.forEach(function (n) { added.push({ id: 'tag:' + n, label: 'tag ' + n }); });
    t.removed.forEach(function (n) { removed.push({ id: 'tag:' + n, label: 'tag ' + n }); });
    Object.keys(nc).forEach(function (n) {
      if (!oc[n]) added.push({ id: 'cat:' + n, label: 'category ' + n });
      else if (stable(oc[n]) !== stable(nc[n])) changed.push({ id: 'cat:' + n, label: 'category ' + n, fields: changedFields(oc[n], nc[n]) });
    });
    Object.keys(oc).forEach(function (n) { if (!nc[n]) removed.push({ id: 'cat:' + n, label: 'category ' + n }); });
    var names = function (arr) { return (arr || []).map(function (c) { return c.name; }).join('\n'); };
    var reordered = !added.length && !removed.length && (names(oldObj.amcCategories) !== names(newObj.amcCategories) || names(oldObj.tags) !== names(newObj.tags));
    return { added: added, removed: removed, changed: changed, recolored: [], reordered: reordered, unchanged: 0 };
  }
  function summarizeDiff(d) {
    var parts = [];
    if (d.added && d.added.length) parts.push(d.added.length + ' added');
    if (d.changed && d.changed.length) parts.push(d.changed.length + ' edited');
    if (d.recolored && d.recolored.length) parts.push(d.recolored.length + ' recolored');
    if (d.removed && d.removed.length) parts.push(d.removed.length + ' removed');
    if (d.reordered) parts.push('order changed');
    return parts.length ? parts.join(', ') : 'no changes';
  }

  // ---------- site code ----------
  function validateSiteFile(path, text) {
    var errors = [], warnings = [], checks = [];
    if (SITE_FILES.indexOf(path) === -1) {
      errors.push('"' + path + '" is not one of the site files (' + SITE_FILES.join(', ') + ').');
      return { errors: errors, warnings: warnings, checks: checks };
    }
    checks.push('Recognized as ' + path);
    if (!nonEmpty(text)) { errors.push('The file is empty.'); return { errors: errors, warnings: warnings, checks: checks }; }
    if (/\.js$/.test(path)) {
      try { new Function(text); checks.push('JavaScript has no syntax errors'); }
      catch (e) { errors.push('JavaScript syntax error: ' + e.message); }
      if (path !== 'js/validate.js' && !/window\.Hub|Hub\./.test(text)) warnings.push('This file does not mention Hub. Make sure it is the right file.');
      warnings.push('Browsers keep code files for up to 10 minutes. Also upload index.html with the ?v= number raised so everyone gets this change right away.');
    } else {
      if (!/<!doctype html>/i.test(text)) errors.push('index.html must start with <!DOCTYPE html>.');
      var need = ['js/validate.js', 'js/core.js', 'js/analyzer.js', 'js/tab-amc.js', 'js/tab-apps.js', 'js/tab-skills.js', 'js/tab-resources.js', 'js/manager.js'];
      var missing = need.filter(function (f) { return text.indexOf('src="' + f) === -1; });
      if (missing.length) errors.push('index.html is missing script tags for: ' + missing.join(', ') + '.');
      else checks.push('Loads all site scripts');
      if (text.indexOf('var GH_CONFIG') === -1) errors.push('index.html is missing the GitHub connection (var GH_CONFIG). Publishing would stop working.');
      if (text.indexOf('id="app"') === -1) errors.push('index.html is missing the main page container (id="app").');
    }
    return { errors: errors, warnings: warnings, checks: checks };
  }

  var api = {
    TARGETS: TARGETS, DATA_TARGETS: DATA_TARGETS, SITE_FILES: SITE_FILES, RESERVED_TAGS: RESERVED_TAGS,
    LOG_CAP: LOG_CAP, SIZE_WARN: SIZE_WARN,
    isHttpUrl: isHttpUrl, isHex: isHex, looksLikeZipBase64: looksLikeZipBase64,
    normalizeFileName: normalizeFileName, checkFileName: checkFileName, parseJson: parseJson,
    itemLabel: itemLabel, validateItem: validateItem, validateData: validateData,
    changedFields: changedFields, diffItems: diffItems, diffTags: diffTags, diffConfig: diffConfig, summarizeDiff: summarizeDiff,
    validateSiteFile: validateSiteFile
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HubValidate = api;
})(typeof window !== 'undefined' ? window : globalThis);
