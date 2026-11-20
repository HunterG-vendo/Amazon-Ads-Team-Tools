/* PLTFRM Team Tools: Manage Page. Password gate, editing, uploads and publishing to GitHub.
   Every publish writes exactly one file, so a mistake in one tab can never break another. */
(function () {
  'use strict';
  var Hub = window.Hub, V = window.HubValidate;
  var esc = Hub.esc;
  var DEFAULT_PASSWORD = 'PLTFRM2026';
  var TAB_OF = { 'amc-queries': 'amc', 'apps': 'apps', 'skills': 'skills', 'resources': 'resources' };
  var TARGET_COLORS = { 'amc-queries': 'var(--gray)', 'apps': 'var(--gray)', 'skills': 'var(--gray)', 'resources': 'var(--gray)', 'config': 'var(--gray)', 'site': 'var(--gray)', 'legacy': 'var(--gray-dim)' };
  var FIELD_NAMES = {
    name: 'name', url: 'link', desc: 'description', author: 'author', tags: 'tags',
    skillData: 'skill file', skillFileName: 'file name', title: 'title', type: 'category',
    summary: 'summary', description: 'description', sql: 'SQL', sqlParts: 'SQL parts',
    howTo: 'how-to steps', requirements: 'requirements', useCases: 'use cases', example: 'example output',
    viz: 'analyzer settings', icon: 'icon'
  };

  var M = Hub.manager = {
    unlocked: false,
    section: 'content',
    contentTarget: 'amc-queries',
    uploadTarget: 'amc-queries',
    sha: {},          // target -> GitHub blob sha of the live file (null = file does not exist yet)
    synced: false,
    syncing: false,
    syncError: '',
    drafts: {},       // target -> { items | tags, log: [] }
    conflict: {},     // target -> true after GitHub refused a stale write
    editing: null,    // { target, id (null for new), item }
    upload: null,     // current upload report
    busy: false
  };

  // ---------- GitHub connection ----------
  function decodeToken(t) {
    if (!t) return '';
    try { var p = String(t).split('.'); return p.length === 2 ? atob(p[0]) + atob(p[1]) : atob(t); }
    catch (e) { return String(t); }
  }
  function encodeToken(t) {
    if (!t) return '';
    var mid = Math.ceil(t.length / 2);
    return btoa(t.slice(0, mid)) + '.' + btoa(t.slice(mid));
  }
  M.encodeToken = encodeToken;
  M.settings = function () {
    try {
      var local = JSON.parse(Hub.store.get('pltfrm_gh') || 'null');
      if (local && local.token && local.username && local.repo) return { username: local.username, repo: local.repo, token: local.token, source: 'this browser' };
    } catch (e) { /* ignore broken local settings */ }
    var g = window.GH_CONFIG;
    if (g && g.token && g.username && g.repo) return { username: g.username, repo: g.repo, token: decodeToken(g.token), source: 'built in' };
    return null;
  };
  M.canPublish = function () { return !Hub.preview && !!M.settings(); };

  function GhError(kind, message, status) { this.kind = kind; this.message = message; this.status = status; }
  GhError.prototype = Object.create(Error.prototype);

  function friendly(status, body) {
    var msg = body && body.message ? body.message : '';
    if (status === 401) return 'GitHub rejected the access token (401). It may have expired or been revoked. Update it in Settings.';
    if (status === 403) return /rate limit/i.test(msg) ? 'GitHub rate limit reached. Wait a few minutes and try again.' : 'GitHub refused the request (403). The token may not have write access to this repo.';
    if (status === 404) return 'GitHub could not find the repo or file (404). Check the username and repo name in Settings.';
    if (status === 409 || status === 422) return 'GitHub has a newer version of this file than the one you started from.';
    return 'GitHub returned an error (' + status + ')' + (msg ? ': ' + msg : '') + '.';
  }

  function gh(method, path, body, accept) {
    var s = M.settings();
    if (!s) return Promise.reject(new GhError('config', 'GitHub is not connected. Add a token in Settings.'));
    var url = 'https://api.github.com/repos/' + encodeURIComponent(s.username) + '/' + encodeURIComponent(s.repo) + path;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(url, {
      method: method, cache: 'no-store', signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Authorization': 'Bearer ' + s.token, 'Accept': accept || 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (text) {
        var json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
        return { status: res.status, ok: res.ok, json: json, text: text };
      });
    }, function (err) {
      clearTimeout(timer);
      throw new GhError('network', err && err.name === 'AbortError' ? 'GitHub took longer than 30 seconds to answer. Try again.' : 'Could not reach GitHub. Check your internet connection and try again.');
    });
  }
  function contentsPath(path) { return '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }

  // Returns { sha, text } for a repo file, or { sha: null, text: null } when it does not exist yet.
  M.ghGet = function (path) {
    return gh('GET', contentsPath(path) + '?t=' + Date.now()).then(function (r) {
      if (r.status === 404) return { sha: null, text: null };
      if (!r.ok) throw new GhError('http', friendly(r.status, r.json), r.status);
      var j = r.json || {};
      if (j.content && j.encoding === 'base64') return { sha: j.sha, text: Hub.b64ToUtf8(j.content) };
      // Files over 1 MB come back without content; ask for the raw file instead
      return gh('GET', contentsPath(path) + '?t=' + Date.now(), null, 'application/vnd.github.raw').then(function (raw) {
        if (!raw.ok) throw new GhError('http', friendly(raw.status, raw.json), raw.status);
        return { sha: j.sha, text: raw.text };
      });
    });
  };
  // Writes one file. sha must be the live version you started from; GitHub refuses stale writes.
  M.ghPut = function (path, text, sha, message) {
    var body = { message: message, content: Hub.utf8ToB64(text) };
    if (sha) body.sha = sha;
    return gh('PUT', contentsPath(path), body).then(function (r) {
      if (r.status === 409 || r.status === 422 && /sha/i.test(r.text)) throw new GhError('conflict', friendly(409, r.json), r.status);
      if (!r.ok) throw new GhError('http', friendly(r.status, r.json), r.status);
      return r.json && r.json.content ? r.json.content.sha : null;
    });
  };
  // ---------- backups (made before every publish; the 3 newest per file are kept) ----------
  var BACKUPS_KEPT = 3;
  M.BACKUPS_KEPT = BACKUPS_KEPT;
  function backupParts(path) {
    var base = path.split('/').pop(), dot = base.lastIndexOf('.');
    return { dir: 'backups/' + (path.indexOf('data/') === 0 ? 'data' : 'site'), stem: base.slice(0, dot), ext: base.slice(dot), base: base };
  }
  function stampOf(name, stem, ext) {
    var m = name.slice(stem.length + 1, name.length - ext.length).match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
    return m ? new Date(m[1] + 'T' + m[2] + ':' + m[3] + ':' + m[4] + '.' + m[5] + 'Z') : null;
  }
  M.ghList = function (dir) {
    return gh('GET', contentsPath(dir) + '?t=' + Date.now()).then(function (r) {
      if (r.status === 404) return [];
      if (!r.ok) throw new GhError('http', friendly(r.status, r.json), r.status);
      return Array.isArray(r.json) ? r.json : [];
    });
  };
  M.ghDelete = function (path, sha, message) {
    return gh('DELETE', contentsPath(path), { message: message, sha: sha }).then(function (r) {
      if (!r.ok) throw new GhError('http', friendly(r.status, r.json), r.status);
    });
  };
  // Backups of one file, newest first: [{ name, path, sha, date }]
  M.listBackups = function (path) {
    var p = backupParts(path);
    return M.ghList(p.dir).then(function (list) {
      return list.filter(function (f) { return f.type !== 'dir' && f.name.indexOf(p.stem + '-') === 0 && f.name.slice(-p.ext.length) === p.ext && stampOf(f.name, p.stem, p.ext); })
        .map(function (f) { return { name: f.name, path: f.path, sha: f.sha, date: stampOf(f.name, p.stem, p.ext), original: p.base }; })
        .sort(function (a, b) { return b.date - a.date; });
    });
  };
  // Copies the live file into backups/ before it is replaced. Resolves with the backup path, or null if there was nothing to back up.
  M.backupFile = function (path) {
    if (Hub.preview) return Promise.reject(new GhError('preview', 'Publishing is turned off in this preview copy.'));
    var p = backupParts(path);
    return M.ghGet(path).then(function (f) {
      if (f.text === null) return null;
      var name = p.stem + '-' + new Date().toISOString().replace(/[:.]/g, '-') + p.ext;
      var bpath = p.dir + '/' + name;
      return M.ghPut(bpath, f.text, null, 'Back up ' + path + ' before publishing (' + (Hub.managerName() || 'unknown') + ')').then(function () { return bpath; });
    }).catch(function (e) {
      throw new GhError(e.kind || 'backup', 'Nothing was published, because the backup of the current ' + p.base + ' could not be saved. ' + (e.message || ''), e.status);
    });
  };
  // Deletes all but the newest backups of a file. Best effort: a failure here never undoes a publish.
  M.pruneBackups = function (path) {
    return M.listBackups(path).then(function (list) {
      return list.slice(BACKUPS_KEPT).reduce(function (chain, b) {
        return chain.then(function () { return M.ghDelete(b.path, b.sha, 'Remove old backup ' + b.name + ' (keeping the ' + BACKUPS_KEPT + ' newest)'); });
      }, Promise.resolve());
    }).catch(function (e) { console.warn('Could not remove old backups of ' + path + ':', e.message); });
  };

  M.checkConnection = function () {
    return gh('GET', '').then(function (r) {
      if (!r.ok) throw new GhError('http', friendly(r.status, r.json), r.status);
      return { canPush: !!(r.json && r.json.permissions && r.json.permissions.push), fullName: r.json && r.json.full_name };
    });
  };

  // ---------- load the latest files straight from GitHub ----------
  // The public page may be up to a minute behind after a publish; managers always edit the newest copy.
  M.sync = function () {
    if (!M.canPublish()) { M.synced = false; return Promise.resolve(); }
    M.syncing = true; M.syncError = '';
    var targets = ['config'].concat(V.DATA_TARGETS);
    return Promise.all(targets.map(function (t) {
      return M.ghGet(V.TARGETS[t].path).then(function (f) {
        var p = f.text === null ? null : V.parseJson(f.text);
        if (p && !p.ok) { M.syncError = V.TARGETS[t].file + ' on GitHub is not valid JSON. Re-upload a good copy from the Upload section.'; M.sha[t] = f.sha; return; }
        var latest = p ? p.value : null;
        if (M.drafts[t]) {
          // Keep the version the draft was built from, so a stale draft can never overwrite newer work.
          if (!(t in M.sha)) {
            if (JSON.stringify(latest) === JSON.stringify(Hub.data[t])) M.sha[t] = f.sha;
            else { M.sha[t] = null; M.conflict[t] = true; }
          }
          return;
        }
        M.sha[t] = f.sha;
        if (latest && JSON.stringify(latest) !== JSON.stringify(Hub.data[t])) Hub.setData(t, latest);
      });
    })).then(function () { M.synced = true; }, function (e) {
      M.synced = false; M.syncError = e.message || String(e);
    }).then(function () { M.syncing = false; });
  };

  // ---------- activity log ----------
  M.logEntry = function (target, action, text) {
    return { id: Hub.uid('u'), time: new Date().toISOString(), actor: Hub.managerName() || 'Someone', device: Hub.deviceTag(), action: action, target: target, text: text };
  };
  M.fieldNames = function (fields) {
    var out = [];
    fields.forEach(function (f) { var n = FIELD_NAMES[f]; if (n && out.indexOf(n) === -1) out.push(n); });
    return out;
  };
  M.TARGET_COLORS = TARGET_COLORS;
  M.TAB_OF = TAB_OF;

  // ---------- drafts ----------
  M.published = function (target) { return Hub.data[target] || null; };
  M.draft = function (target) {
    if (!M.drafts[target]) {
      var pub = M.published(target) || {};
      M.drafts[target] = target === 'config'
        ? { tags: Hub.clone(pub.tags || []), categories: Hub.clone(pub.amcCategories || []), log: [] }
        : { items: Hub.clone(pub.items || []), log: [] };
    }
    return M.drafts[target];
  };
  M.draftDiff = function (target) {
    var d = M.drafts[target]; if (!d) return null;
    var pub = M.published(target) || {};
    return target === 'config' ? V.diffConfig(pub, { tags: d.tags, amcCategories: d.categories }) : V.diffItems(target, pub.items, d.items);
  };
  M.isDirty = function (target) {
    var d = M.draftDiff(target);
    if (!d) return false;
    return !!(d.added.length || d.removed.length || (d.changed && d.changed.length) || (d.recolored && d.recolored.length) || d.reordered);
  };
  M.anyDirty = function () { return ['config'].concat(V.DATA_TARGETS).some(M.isDirty); };
  M.discard = function (target) { delete M.drafts[target]; delete M.conflict[target]; if (M.editing && M.editing.target === target) M.editing = null; };

  // ---------- publish one file ----------
  function stamp(obj, entries) {
    var pub = M.published(obj.file) || {};
    obj.schemaVersion = 1;
    obj.updatedAt = new Date().toISOString();
    obj.updatedBy = Hub.managerName() || 'Someone';
    obj.log = (entries || []).concat(Array.isArray(pub.log) ? pub.log : []).slice(0, V.LOG_CAP);
    return obj;
  }
  // Publishes a complete file object for one target. Resolves with the object that went live.
  M.publishObject = function (target, obj, entries, commitNote) {
    if (Hub.preview) return Promise.reject(new GhError('preview', 'Publishing is turned off in this preview copy.'));
    if (!M.settings()) return Promise.reject(new GhError('config', 'GitHub is not connected. Add a token in Settings.'));
    if (!(target in M.sha)) return Promise.reject(new GhError('sync', 'The latest version of ' + V.TARGETS[target].file + ' has not loaded from GitHub yet. Wait a moment and try again.'));
    obj = stamp(Hub.clone(obj), entries);
    obj.file = target;
    var check = V.validateData(target, obj, { tags: Hub.tagList().map(function (t) { return t.name; }) });
    if (check.errors.length) return Promise.reject(new GhError('invalid', 'Not published. Fix these first: ' + check.errors.slice(0, 5).join(' ')));
    var text = JSON.stringify(obj, null, 2) + '\n';
    var message = 'Update ' + V.TARGETS[target].file + ' via Team Tools' + (commitNote ? ': ' + commitNote : '') + ' (' + (Hub.managerName() || 'unknown') + ')';
    M.busy = true;
    return M.ghPut(V.TARGETS[target].path, text, M.sha[target], message).then(function (newSha) {
      M.busy = false;
      M.sha[target] = newSha;
      delete M.conflict[target];
      Hub.notePublished(target, obj);   // so a refresh during the Pages rebuild still shows this version
      Hub.setData(target, obj);
      return obj;
    }, function (e) {
      M.busy = false;
      if (e.kind === 'conflict') M.conflict[target] = true;
      throw e;
    });
  };
  // Publishes the draft for a target (manager edits).
  M.publishDraft = function (target) {
    var d = M.drafts[target]; if (!d) return Promise.resolve(null);
    var pub = Hub.clone(M.published(target) || { file: target, schemaVersion: 1 });
    if (target === 'config') { pub.tags = d.tags; pub.amcCategories = d.categories; } else pub.items = d.items;
    var diff = M.draftDiff(target);
    var entries = d.log.slice().reverse();
    if (!entries.length) entries = [M.logEntry(target, 'edit', V.TARGETS[target].label + ' updated (' + V.summarizeDiff(diff) + ')')];
    // Back up the live file first; if that fails nothing is published. Old backups are pruned afterwards.
    var path = V.TARGETS[target].path;
    return M.backupFile(path).then(function () {
      return M.publishObject(target, pub, entries, V.summarizeDiff(diff));
    }).then(function (obj) {
      delete M.drafts[target];
      M.pruneBackups(path).then(function () { Hub.emit('backupschange', target); });
      return obj;
    });
  };
  // Re-reads one file from GitHub, dropping any draft (used after a conflict).
  M.reloadLatest = function (target) {
    return M.ghGet(V.TARGETS[target].path).then(function (f) {
      M.sha[target] = f.sha;
      M.discard(target);
      if (f.text !== null) {
        var p = V.parseJson(f.text);
        if (p.ok) Hub.setData(target, p.value);
      }
    });
  };

  // Site code: writes one code file. Fetches the live sha first so it never needs a draft.
  M.publishSiteFile = function (path, text) {
    if (Hub.preview) return Promise.reject(new GhError('preview', 'Publishing is turned off in this preview copy.'));
    return M.ghGet(path).then(function (f) {
      return M.ghPut(path, text, f.sha, 'Update ' + path + ' via Team Tools upload (' + (Hub.managerName() || 'unknown') + ')');
    });
  };
  // Best effort: records site code updates in config.json's history. Never blocks the code upload.
  M.appendConfigLog = function (entry) {
    var path = V.TARGETS.config.path;
    return M.ghGet(path).then(function (f) {
      if (f.text === null) return;
      var p = V.parseJson(f.text); if (!p.ok) return;
      var obj = p.value;
      obj.log = [entry].concat(Array.isArray(obj.log) ? obj.log : []).slice(0, V.LOG_CAP);
      return M.ghPut(path, JSON.stringify(obj, null, 2) + '\n', f.sha, 'Log site code update (' + (Hub.managerName() || 'unknown') + ')').then(function (sha) {
        M.sha.config = sha;
        Hub.notePublished('config', obj);
        if (!M.drafts.config) Hub.setData('config', obj);
        else { var pub = Hub.data.config; if (pub) pub.log = obj.log; }
      });
    }).catch(function (e) { console.warn('Could not record the site code update in the activity log:', e.message); });
  };

  window.addEventListener('beforeunload', function (e) {
    if (M.anyDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- password gate ----------
  function getPassword() { return Hub.store.get('pltfrm_pw') || DEFAULT_PASSWORD; }
  M.getPassword = getPassword;

  M.open = function () {
    if (M.unlocked) { M.showManager(); return; }
    var needName = !Hub.managerName();
    var m = Hub.openModal(
      '<h2>Manage Page</h2><p class="lead">Managers can edit, upload and publish changes here.</p>' +
      '<div style="margin-top:20px">' +
        '<div class="field"><label class="field-label" for="gate-pw">Password</label>' +
        '<div class="inline-form"><input class="input" id="gate-pw" type="password" autocomplete="current-password" data-autofocus>' +
        '<button class="btn btn-secondary btn-small" type="button" data-act="toggle-pw" style="padding:9px 14px">Show</button></div></div>' +
        (needName ? '<div class="field"><label class="field-label" for="gate-name">Your name</label><input class="input" id="gate-name" type="text" placeholder="e.g. Hunter G." autocomplete="name">' +
          '<p class="field-hint">Shown in Updates next to every change you make. You only enter this once on this browser.</p></div>' : '') +
        '<p class="field-error" id="gate-err" role="alert"></p>' +
        '<div class="modal-actions" style="margin-top:8px"><button class="btn btn-primary" type="button" data-act="unlock">Unlock</button>' +
        '<button class="btn btn-secondary" type="button" data-role="close">Cancel</button></div>' +
      '</div>', { className: '' });
    m.style.maxWidth = '420px';
    function submit() {
      var pw = m.querySelector('#gate-pw').value, nameEl = m.querySelector('#gate-name'), err = m.querySelector('#gate-err');
      if (pw !== getPassword()) { err.textContent = 'That password is not right. Try again.'; m.querySelector('#gate-pw').select(); return; }
      if (nameEl && !nameEl.value.trim()) { err.textContent = 'Add your name so the team can see who made each change.'; nameEl.focus(); return; }
      if (nameEl) Hub.setManagerName(nameEl.value);
      M.unlocked = true;
      Hub.closeModal();
      M.showManager();
    }
    m.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a) return;
      if (a.getAttribute('data-act') === 'unlock') submit();
      if (a.getAttribute('data-act') === 'toggle-pw') {
        var inp = m.querySelector('#gate-pw'), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password'; a.textContent = show ? 'Hide' : 'Show';
      }
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
  };

  // ---------- manager shell ----------
  var SECTIONS = [['content', 'Content'], ['tags', 'Tags & Categories'], ['upload', 'Upload'], ['updates', 'Updates'], ['settings', 'Settings']];
  var modalEl = null;

  M.showManager = function () {
    modalEl = Hub.openModal('<div data-role="manager"></div>', {
      className: 'manager', sticky: true,
      onClose: function () { M.unlocked = false; M.editing = null; M.upload = null; M.synced = false; modalEl = null; Hub.emit('managerclosed'); }
    });
    modalEl.addEventListener('click', onClick);
    modalEl.addEventListener('change', onChange);
    modalEl.addEventListener('input', onInput);
    M.render();
    if (M.canPublish() && !M.synced && !M.syncing) {
      M.sync().then(function () { if (modalEl) M.render(); });
      M.render();
    }
  };
  Hub.on('datachange', function () { if (modalEl && !M.editing && !M.busy) M.render(); });
  M.isOpen = function () { return !!modalEl; };
  // After every successful publish: close Manage Page and go to the home page, like the old site did
  M.finishPublish = function (message) {
    if (modalEl) Hub.closeModal();
    Hub.go('#' + Hub.TAB_ORDER[0]);
    window.scrollTo(0, 0);
    Hub.toast(message);
  };

  M.render = function () {
    if (!modalEl) return;
    var root = modalEl.querySelector('[data-role="manager"]');
    var name = Hub.managerName();
    root.innerHTML =
      '<div class="manager-head"><div><h2>Manage Page</h2><p class="who">Signed in as <strong>' + esc(name || 'Someone') + '</strong></p><p class="who">' + connectionNote() + '</p></div></div>' +
      '<div class="seg" role="tablist">' + SECTIONS.map(function (s) {
        var dirty = s[0] === 'content' ? V.DATA_TARGETS.some(M.isDirty) : s[0] === 'tags' ? M.isDirty('config') : false;
        return '<button class="seg-btn" type="button" role="tab" data-act="section" data-v="' + s[0] + '" aria-selected="' + (M.section === s[0]) + '">' +
          esc(s[1]) + (dirty ? '<span class="pending" title="Unpublished changes"></span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div data-role="section">' + sectionHtml() + '</div>';
    afterRender();
  };
  function connectionNote() {
    if (Hub.preview) return '<span class="muted">Preview copy: publishing is off.</span>';
    if (!M.settings()) return '<span style="color:#F07878">GitHub is not connected; add a token in Settings to publish.</span>';
    if (M.syncing) return '<span class="muted">Loading the latest files from GitHub…</span>';
    if (M.syncError) return '<span style="color:#F07878">' + esc(M.syncError) + '</span> <button class="btn btn-secondary btn-small" type="button" data-act="retry-sync">Try again</button>';
    if (M.synced) return '<span class="muted">Editing the latest files from GitHub.</span>';
    return '';
  }
  function sectionHtml() {
    if (M.section === 'content') return contentHtml();
    if (M.section === 'tags') return M.tagsHtml();
    if (M.section === 'upload') return M.uploadHtml();
    if (M.section === 'updates') return M.updatesHtml();
    if (M.section === 'settings') return M.settingsHtml();
    return '';
  }
  var afterHooks = [];
  M.after = function (fn) { afterHooks.push(fn); };
  function afterRender() { afterHooks.forEach(function (fn) { fn(modalEl); }); }

  // Event delegation: sections register handlers by data-act name
  var actions = {};
  M.action = function (name, fn) { actions[name] = fn; };
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el || !modalEl.contains(el)) return;
    var fn = actions[el.getAttribute('data-act')];
    if (fn) { e.preventDefault(); fn(el, e); }
  }
  var changeHandlers = [], inputHandlers = [];
  M.onChange = function (fn) { changeHandlers.push(fn); };
  M.onInput = function (fn) { inputHandlers.push(fn); };
  function onChange(e) { changeHandlers.forEach(function (fn) { fn(e); }); }
  function onInput(e) { inputHandlers.forEach(function (fn) { fn(e); }); }

  M.action('retry-sync', function () { M.sync().then(function () { M.render(); }); M.render(); });
  M.action('section', function (el) {
    if (M.editing && !confirmLeaveEditor()) return;
    M.section = el.getAttribute('data-v'); M.editing = null; M.render();
  });
  function confirmLeaveEditor() { return true; } // edits in an open form are dropped when switching; drafts are kept

  // Two-click confirmation for destructive buttons (no browser dialogs, which iframes block)
  M.confirmClick = function (el, label) {
    if (el.getAttribute('data-armed') === '1') return true;
    var original = el.innerHTML;
    el.setAttribute('data-armed', '1'); el.textContent = label || 'Click again to confirm';
    setTimeout(function () { if (el.isConnected && el.getAttribute('data-armed') === '1') { el.removeAttribute('data-armed'); el.innerHTML = original; } }, 3500);
    return false;
  };

  // Shared bar that shows unpublished changes for a target with Publish and Discard
  M.pendingBarHtml = function (target) {
    if (M.conflict[target]) {
      return '<div class="pending-bar" style="border-color:rgba(240,82,82,.45);background:rgba(240,82,82,.07)"><span>Someone else published ' + esc(V.TARGETS[target].file) +
        ' after you started. To avoid overwriting their work, load the latest version, then make your change again.</span>' +
        '<div class="actions"><button class="btn btn-danger btn-small" type="button" data-act="reload-latest" data-target="' + target + '">Load latest (drops your unpublished changes)</button></div></div>';
    }
    if (!M.isDirty(target)) return '';
    var label = V.TARGETS[target].label;
    return '<div class="pending-bar"><span><strong>' + esc(V.summarizeDiff(M.draftDiff(target))) + '</strong> in ' + esc(label) + ', not published yet.</span>' +
      '<div class="actions"><button class="btn btn-secondary btn-small" type="button" data-act="discard" data-target="' + target + '">Discard</button>' +
      '<button class="btn btn-primary btn-small" type="button" data-act="publish-draft" data-target="' + target + '"' + (M.canPublish() ? '' : ' disabled') + '>Publish ' + esc(label) + '</button></div></div>';
  };
  M.action('discard', function (el) {
    if (!M.confirmClick(el, 'Click again to discard')) return;
    M.discard(el.getAttribute('data-target')); M.render(); Hub.toast('Unpublished changes discarded');
  });
  M.action('publish-draft', function (el) {
    var target = el.getAttribute('data-target');
    el.disabled = true; el.textContent = 'Publishing…';
    M.publishDraft(target).then(function () {
      M.finishPublish('Published ' + V.TARGETS[target].label + '. Live for everyone in about a minute.');
    }, function (e) { M.render(); Hub.toast(e.message, true); });
  });
  M.action('reload-latest', function (el) {
    if (!M.confirmClick(el, 'Click again to load the latest')) return;
    var target = el.getAttribute('data-target');
    el.disabled = true; el.textContent = 'Loading…';
    M.reloadLatest(target).then(function () { M.render(); Hub.toast('Loaded the latest ' + V.TARGETS[target].file); },
      function (e) { M.render(); Hub.toast(e.message, true); });
  });

  // ---------- Content section ----------
  function itemsFor(target) { return M.drafts[target] ? M.drafts[target].items : Hub.items(target); }
  function rowSub(target, it) {
    if (target === 'amc-queries') return [it.type || 'Other', it.author].filter(Boolean).join(', ');
    return it.author || '';
  }
  function contentHtml() {
    var t = M.contentTarget, T = V.TARGETS[t];
    var items = itemsFor(t);
    var pub = {}; Hub.items(t).forEach(function (it) { pub[it.id] = JSON.stringify(it); });
    var ed = M.editing && M.editing.target === t ? M.editing : null;
    return '<div class="seg seg-sub" role="tablist">' + V.DATA_TARGETS.map(function (k) {
        return '<button class="seg-btn" type="button" data-act="content-target" data-v="' + k + '" aria-selected="' + (k === t) + '">' +
          esc(V.TARGETS[k].label) +
          '<span class="muted">' + itemsFor(k).length + '</span>' + (M.isDirty(k) ? '<span class="pending"></span>' : '') + '</button>';
      }).join('') + '</div>' +
      M.pendingBarHtml(t) +
      '<div class="section-title"><span>' + esc(T.label) + ' <span class="hint">Drag to reorder. Changes stay unpublished until you publish.</span></span>' +
      (ed && ed.id === null ? '' : t === 'amc-queries'
        ? '<button class="btn btn-secondary btn-small" type="button" data-act="add-item">Add queries with a file</button>'
        : '<button class="btn btn-secondary btn-small" type="button" data-act="add-item">Add ' + esc(T.noun) + '</button>') + '</div>' +
      (t === 'amc-queries' ? '<p class="note">New AMC queries are added by uploading an updated <code>amc-queries.json</code>. You can still edit or remove existing queries here.</p>' : '') +
      (ed && ed.id === null ? M.editorHtml(ed) : '') +
      '<div class="item-list" data-role="item-list">' + (items.length ? items.map(function (it, i) {
        var state = !(it.id in pub) ? ' is-new' : pub[it.id] !== JSON.stringify(it) ? ' is-edited' : '';
        var row = '<div class="item-row' + state + '" draggable="true" data-idx="' + i + '">' +
          '<button class="drag-handle" type="button" aria-label="Drag to reorder" tabindex="-1"><span></span><span></span><span></span></button>' +
          '<span class="item-name">' + esc(V.itemLabel(t, it)) + '</span><span class="item-sub">' + esc(rowSub(t, it)) + '</span>' +
          '<button class="btn btn-secondary btn-small" type="button" data-act="edit-item" data-id="' + esc(it.id) + '">Edit</button>' +
          '<button class="btn btn-danger btn-small" type="button" data-act="remove-item" data-id="' + esc(it.id) + '">Remove</button></div>';
        if (ed && ed.id === it.id) row += '<div style="padding:12px;background:var(--black)">' + M.editorHtml(ed) + '</div>';
        return row;
      }).join('') : '<div class="empty-row">No ' + esc(T.nouns) + ' yet. Use Add ' + esc(T.noun) + ' to create the first one.</div>') + '</div>';
  }

  M.action('content-target', function (el) { M.contentTarget = el.getAttribute('data-v'); M.editing = null; M.render(); });
  M.action('add-item', function () {
    if (M.contentTarget === 'amc-queries') {
      // AMC queries are added as a whole file: go straight to Upload from file with AMC Queries chosen
      M.section = 'upload'; M.uploadTarget = 'amc-queries'; M.upload = null; M.editing = null; M.render();
      setTimeout(function () { var s = modalEl && modalEl.querySelector('[data-role="upload-steps"]'); if (s) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30);
      return;
    }
    M.editing = { target: M.contentTarget, id: null, item: M.contentTarget === 'amc-queries' ? { type: '', howTo: [], requirements: [], useCases: [], tags: [] } : { tags: [] } };
    M.render(); focusEditor();
  });
  M.action('edit-item', function (el) {
    var id = el.getAttribute('data-id');
    var it = itemsFor(M.contentTarget).filter(function (x) { return String(x.id) === id; })[0]; if (!it) return;
    M.editing = { target: M.contentTarget, id: it.id, item: Hub.clone(it), orig: Hub.clone(it) };
    M.render(); focusEditor();
  });
  M.action('remove-item', function (el) {
    if (!M.confirmClick(el, 'Click again to remove')) return;
    var t = M.contentTarget, id = el.getAttribute('data-id'), d = M.draft(t);
    var idx = -1; d.items.forEach(function (x, i) { if (String(x.id) === id) idx = i; });
    if (idx === -1) return;
    var removed = d.items.splice(idx, 1)[0];
    d.log.push(M.logEntry(t, 'removed', 'Removed "' + V.itemLabel(t, removed) + '" from ' + V.TARGETS[t].label));
    if (M.editing && M.editing.id === removed.id) M.editing = null;
    M.render();
  });
  // Long text boxes grow to fit what is in them (up to a limit), so nothing hides behind a scrollbar
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 380) + 'px'; }
  M.after(function (root) { root.querySelectorAll('.editor textarea.textarea:not(.code)').forEach(autosize); });
  M.onInput(function (e) { if (e.target.matches && e.target.matches('.editor textarea.textarea:not(.code)')) autosize(e.target); });
  function focusEditor() {
    setTimeout(function () {
      var ed = modalEl && modalEl.querySelector('[data-role="editor"]'); if (!ed) return;
      if (ed.contains(document.activeElement) && document.activeElement !== ed) return;   // you already clicked into a field
      var f = ed.querySelector('#ed-title, #ed-name'); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); }
    }, 30);
  }

  // Drag to reorder
  var dragFrom = null;
  M.after(function (root) {
    var list = root.querySelector('[data-role="item-list"]'); if (!list) return;
    list.querySelectorAll('.item-row').forEach(function (row) {
      row.addEventListener('dragstart', function (e) {
        if (M.editing) { e.preventDefault(); return; }
        dragFrom = +row.getAttribute('data-idx'); row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (x) { /* some browsers need data */ }
      });
      row.addEventListener('dragend', function () { row.classList.remove('dragging'); list.querySelectorAll('.drag-over').forEach(function (r) { r.classList.remove('drag-over'); }); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var to = +row.getAttribute('data-idx');
        if (dragFrom === null || dragFrom === to) return;
        M.moveItem(M.contentTarget, dragFrom, to); dragFrom = null;
      });
    });
  });
  M.moveItem = function (t, from, to) {
    var d = M.draft(t);
    var moved = d.items.splice(from, 1)[0];
    d.items.splice(to, 0, moved);
    d.log.push(M.logEntry(t, 'reordered', 'Moved "' + V.itemLabel(t, moved) + '" to position ' + (to + 1) + ' in ' + V.TARGETS[t].label));
    M.render();
  };

  // ---------- editor forms ----------
  function lines(v) { return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function parseTable(text) {
    text = String(text || '').replace(/\r/g, '').trim();
    if (!text) return null;
    var delim = text.split('\n')[0].indexOf('\t') !== -1 ? '\t' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); rows.push(row);
    var columns = rows.shift().map(function (s) { return s.trim(); });
    return { columns: columns, rows: rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); })
      .map(function (r) { return columns.map(function (_, i) { return String(r[i] == null ? '' : r[i]).trim(); }); }) };
  }
  M.parseTable = parseTable;
  function tableToText(ex) {
    if (!ex || !ex.columns) return '';
    return [ex.columns].concat(ex.rows || []).map(function (r) { return r.join('\t'); }).join('\n');
  }
  function field(id, label, html, hint, req) {
    return '<div class="field"><label class="field-label" for="' + id + '">' + esc(label) + (req ? ' <span class="req">(required)</span>' : '') + '</label>' + html +
      (hint ? '<p class="field-hint">' + hint + '</p>' : '') + '</div>';
  }
  function input(id, value, ph, type) { return '<input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; }
  function textarea(id, value, ph, cls) { return '<textarea class="textarea' + (cls ? ' ' + cls : '') + '" id="' + id + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' spellcheck="' + (cls === 'code' ? 'false' : 'true') + '">' + esc(value || '') + '</textarea>'; }
  function tagPicker(selected) {
    var tags = Hub.tagList();
    if (!tags.length) return '<p class="field-hint">No tags yet. Add some in the Tags section.</p>';
    var extra = (selected || []).filter(function (s) { return !tags.some(function (t) { return t.name === s; }); });
    return '<div class="tag-picker" id="ed-tags">' + tags.map(function (t) {
      return '<button class="tag-pick" type="button" data-act="toggle-tag" data-tag="' + esc(t.name) + '" aria-pressed="' + ((selected || []).indexOf(t.name) !== -1) + '">' + esc(t.name) + '</button>';
    }).join('') + extra.map(function (n) {
      return '<button class="tag-pick" type="button" data-act="toggle-tag" data-tag="' + esc(n) + '" aria-pressed="true" title="Not in the Tags list">' + esc(n) + '</button>';
    }).join('') + '</div>';
  }
  M.action('toggle-tag', function (el) { el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true')); });

  M.editorHtml = function (ed) {
    var t = ed.target, it = ed.item, T = V.TARGETS[t], isNew = ed.id === null;
    var h = '<div class="editor" data-role="editor"><div class="editor-head"><h3>' + (isNew ? 'Add ' + esc(T.noun) : 'Edit ' + esc(V.itemLabel(t, it))) + '</h3></div>' +
      '<div class="field-error" data-role="ed-errors" role="alert"></div>';
    if (t === 'amc-queries') {
      h += '<details class="import"' + (ed.importOpen ? ' open' : '') + '><summary>Fill this form from JSON</summary>' +
        '<p class="field-hint" style="margin-bottom:8px">Paste one query as JSON (for example, a query Claude wrote for you). It fills the fields below so you can review before saving.</p>' +
        textarea('ed-import', '', '{ "title": "…", "type": "…", "sql": "…" }', 'code') +
        '<div style="margin-top:8px"><button class="btn btn-secondary btn-small" type="button" data-act="import-json">Fill the form</button></div></details>' +
        '<div class="field-row">' + field('ed-title', 'Title', input('ed-title', it.title, 'e.g. NTB by Campaign'), '', true) +
        field('ed-type', 'Category', catSelect(it.type), 'Add or change categories under Tags & Categories.') + '</div>' +
        field('ed-author', 'Author', input('ed-author', it.author, 'e.g. Matan L.')) +
        field('ed-summary', 'Summary', textarea('ed-summary', it.summary, 'One or two sentences shown in the list.'), '') +
        field('ed-description', 'What it does', textarea('ed-description', it.description, 'Longer explanation. Leave a blank line between paragraphs. Wrap table and column names in `backticks`.'), '') +
        sqlEditorHtml(ed) +
        field('ed-howto', 'How to run it', textarea('ed-howto', (it.howTo || []).join('\n'), 'One step per line'), 'One step per line. Start a line with "Label: " to bold the label.') +
        field('ed-req', 'What it needs', textarea('ed-req', (it.requirements || []).join('\n'), 'One requirement per line'), '') +
        field('ed-uses', 'Use cases', textarea('ed-uses', (it.useCases || []).join('\n'), 'One use case per line'), '') +
        field('ed-qtags', 'Tags', input('ed-qtags', (it.tags || []).join(', '), 'e.g. conversions_all, Paid feature, Daily'), 'Separate tags with commas.') +
        field('ed-example', 'Example output', textarea('ed-example', tableToText(it.example), 'Paste a header row and a few result rows from Excel or a CSV', 'code'), 'Paste straight from Excel (tab separated) or a CSV. Leave empty for none.');
      h += '<p class="field-hint" style="margin-bottom:14px">Page link: <code>#amc/' + esc(isNew ? '(made from the title)' : it.id) + '</code></p>';
    } else {
      h += field('ed-name', 'Name', input('ed-name', it.name, t === 'apps' ? 'e.g. Daypart Analyzer' : t === 'skills' ? 'e.g. Bulk Sheet Tool' : 'e.g. Tentpole Playbook'), '', true);
      if (t === 'skills') {
        var fileLine = ed.pendingFile ? esc(ed.pendingFile.name) + ' ready (' + Math.round(ed.pendingFile.size / 1024) + ' KB)'
          : it.skillData ? 'Current file: ' + esc(Hub.skillFileName(it)) + ' (' + Math.round(it.skillData.length * 0.75 / 1024) + ' KB)' : 'No file yet';
        h += '<div class="field"><span class="field-label">Skill file</span>' +
          '<div class="drop-zone" data-role="skill-drop" tabindex="0"><strong>Drop a .skill file here or click to choose</strong><span data-role="skill-file-line">' + fileLine + '</span></div>' +
          '<input type="file" id="ed-skill-file" accept=".skill,.zip" hidden>' +
          (it.skillData || ed.pendingFile ? '<div style="margin-top:8px"><button class="btn btn-secondary btn-small" type="button" data-act="remove-skill-file">' + (ed.removeFile ? 'Keep the file' : 'Remove the file') + '</button>' +
            (ed.removeFile ? ' <span class="field-hint">The file will be removed when you save.</span>' : '') + '</div>' : '') + '</div>' +
          field('ed-url', 'Link to the file (optional)', input('ed-url', it.url, 'https://…'), 'Only needed if there is no uploaded file, for example a SharePoint link.');
      } else {
        h += field('ed-url', 'Link', input('ed-url', it.url, 'https://…', 'url'), t === 'resources' ? 'The SharePoint or web link to the document.' : 'The GitHub Pages or web link to the app.', true);
      }
      h += field('ed-desc', 'Description', textarea('ed-desc', it.desc, 'What does it do? One or two sentences.'), '') +
        field('ed-author', 'Author', input('ed-author', it.author, 'e.g. Hunter G.')) +
        '<div class="field"><span class="field-label">Tags</span>' + tagPicker(it.tags) + '</div>';
    }
    h += '<div class="modal-actions">' +
      '<button class="btn btn-primary" type="button" data-act="save-publish"' + (M.canPublish() ? '' : ' disabled title="Publishing needs a GitHub connection"') + '>Save and publish</button>' +
      '<button class="btn btn-secondary" type="button" data-act="save-draft">Save to draft</button>' +
      '<button class="btn btn-secondary" type="button" data-act="cancel-edit">Cancel</button></div></div>';
    return h;
  };
  function catSelect(current) {
    var names = M.catsNow().map(function (c) { return c.name; });
    if (!names.some(function (n) { return n.toLowerCase() === 'other'; })) names.push('Other');
    var cur = String(current || '').trim() || 'Other';
    if (!names.some(function (n) { return n.toLowerCase() === cur.toLowerCase(); })) names.unshift(cur);   // keep a category that is no longer listed
    return '<select class="input" id="ed-type">' + names.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n.toLowerCase() === cur.toLowerCase() ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('') + '</select>';
  }

  function sqlEditorHtml(ed) {
    var parts = ed.parts || (ed.parts = Array.isArray(ed.item.sqlParts) && ed.item.sqlParts.length > 1 ? Hub.clone(ed.item.sqlParts) : null);
    if (!parts) {
      return field('ed-sql', 'SQL', textarea('ed-sql', ed.item.sql || (ed.item.sqlParts && ed.item.sqlParts[0] ? ed.item.sqlParts[0].sql : ''), 'Paste the full query', 'code'),
        'Paste the query exactly as it runs in AMC. <button class="btn btn-secondary btn-small" type="button" data-act="split-parts" style="margin-left:6px">Split into several queries</button>', true);
    }
    return '<div class="field"><span class="field-label">SQL (' + parts.length + ' queries, run in order) <span class="req">(required)</span></span>' +
      parts.map(function (p, i) {
        return '<div class="part-editor"><div class="part-editor-head"><span>Query ' + (i + 1) + '</span>' +
          (parts.length > 1 ? '<button class="btn btn-danger btn-small" type="button" data-act="remove-part" data-i="' + i + '">Remove</button>' : '') + '</div>' +
          '<div class="field-row">' + field('ed-part-name-' + i, 'Name', input('ed-part-name-' + i, p.name, 'e.g. 1. Classification')) +
          field('ed-part-file-' + i, 'Save the result as', input('ed-part-file-' + i, p.file, 'e.g. campaign_cost.csv')) + '</div>' +
          field('ed-part-note-' + i, 'Note', input('ed-part-note-' + i, p.note, 'What this step does')) +
          field('ed-part-sql-' + i, 'SQL', textarea('ed-part-sql-' + i, p.sql, 'Paste this query', 'code')) + '</div>';
      }).join('') +
      '<button class="btn btn-secondary btn-small" type="button" data-act="add-part">Add another query</button></div>';
  }
  // Copy what is typed in the form into the working copy, so re-drawing the form keeps it
  // Text that only differs by trailing spaces or line endings counts as unchanged, so an
  // edit to one field never rewrites the others (textareas trim and normalize text).
  function norm(s) { return String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/^\n/, '').replace(/\s+$/, ''); }
  function sameish(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify((a || []).map(norm)) === JSON.stringify((b || []).map(norm));
    return norm(a) === norm(b);
  }
  M._sameish = sameish;
  function syncForm() {
    var ed = M.editing; if (!ed || !modalEl) return;
    var it = ed.item, orig = ed.orig || {};
    function val(id) { var el = modalEl.querySelector('#' + id); return el ? el.value : undefined; }
    function set(key, id, fn) {
      var v = val(id); if (v === undefined) return;
      var nv = fn ? fn(v) : v.trim();
      it[key] = key in orig && sameish(orig[key], nv) ? Hub.clone(orig[key]) : nv;
    }
    if (ed.target === 'amc-queries') {
      set('title', 'ed-title'); set('type', 'ed-type'); set('author', 'ed-author'); set('summary', 'ed-summary');
      set('description', 'ed-description', function (v) { return v.replace(/\s+$/, ''); });
      set('howTo', 'ed-howto', lines); set('requirements', 'ed-req', lines); set('useCases', 'ed-uses', lines);
      set('tags', 'ed-qtags', function (v) { return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean); });
      var exText = val('ed-example');
      if (exText !== undefined) ed.exampleText = exText;
      if (ed.parts) ed.parts = ed.parts.map(function (p, i) {
        var o = (Array.isArray(orig.sqlParts) && orig.sqlParts[i]) || {};
        function pv(key, id, keepEnd) {
          var v = val(id); if (v === undefined) return p[key];
          var nv = keepEnd ? v.replace(/\s+$/, '') : v.trim();
          return key in o && sameish(o[key], nv) ? o[key] : nv;
        }
        return Object.assign({}, p, { name: pv('name', 'ed-part-name-' + i), file: pv('file', 'ed-part-file-' + i), note: pv('note', 'ed-part-note-' + i), sql: pv('sql', 'ed-part-sql-' + i, true) });
      });
      else set('sql', 'ed-sql', function (v) { return v.replace(/\s+$/, ''); });
    } else {
      set('name', 'ed-name'); set('url', 'ed-url'); set('desc', 'ed-desc'); set('author', 'ed-author');
      var picks = modalEl.querySelectorAll('#ed-tags [aria-pressed="true"]');
      if (modalEl.querySelector('#ed-tags')) it.tags = Array.prototype.map.call(picks, function (b) { return b.getAttribute('data-tag'); });
    }
  }
  function redrawEditor() { syncForm(); M.render(); focusEditor(); }

  M.action('split-parts', function () { syncForm(); var ed = M.editing; ed.parts = [{ name: '1. ', file: '', note: '', sql: ed.item.sql || '' }, { name: '2. ', file: '', note: '', sql: '' }]; M.render(); });
  M.action('add-part', function () { syncForm(); M.editing.parts.push({ name: (M.editing.parts.length + 1) + '. ', file: '', note: '', sql: '' }); M.render(); });
  M.action('remove-part', function (el) {
    syncForm(); var i = +el.getAttribute('data-i'); M.editing.parts.splice(i, 1);
    if (M.editing.parts.length === 1) { M.editing.item.sql = M.editing.parts[0].sql; M.editing.parts = null; M.editing.item.sqlParts = []; }
    M.render();
  });
  M.action('cancel-edit', function () { M.editing = null; M.render(); });
  M.action('remove-skill-file', function () { syncForm(); var ed = M.editing; if (ed.pendingFile) { ed.pendingFile = null; } else { ed.removeFile = !ed.removeFile; } M.render(); });

  M.action('import-json', function () {
    var ed = M.editing; syncForm();
    var raw = modalEl.querySelector('#ed-import').value.trim();
    var errBox = modalEl.querySelector('[data-role="ed-errors"]');
    if (!raw) { errBox.textContent = 'Paste the query JSON first.'; return; }
    var p = V.parseJson(raw);
    if (!p.ok) { errBox.textContent = 'That is not valid JSON. ' + p.error; return; }
    var v = p.value, q = null;
    if (Array.isArray(v)) { if (v.length !== 1) { errBox.textContent = 'That list has ' + v.length + ' queries. Paste one at a time, or use Upload to replace the whole file.'; return; } q = v[0]; }
    else if (v && Array.isArray(v.items)) { errBox.textContent = 'That is a whole file with ' + v.items.length + ' queries. Use the Upload section to publish a whole file.'; return; }
    else if (v && typeof v === 'object' && !v.title && !v.sql && Object.keys(v).length === 1 && typeof v[Object.keys(v)[0]] === 'object') {
      var k = Object.keys(v)[0]; q = Object.assign({ id: k }, v[k]);   // library export shape: { "id": { ...query } }
    } else q = v;
    if (!q || typeof q !== 'object') { errBox.textContent = 'Paste a single query object, like { "title": "…", "sql": "…" }.'; return; }
    var keepId = ed.id !== null ? ed.item.id : null;
    ed.item = Object.assign({}, ed.item, Hub.clone(q));
    if (keepId) ed.item.id = keepId;
    else if (q.id && itemsFor('amc-queries').some(function (x) { return x.id === q.id; })) delete ed.item.id;
    ed.parts = null; ed.exampleText = undefined; ed.importOpen = false;
    M.render(); focusEditor();
    Hub.toast('Form filled from JSON. Review it, then save.');
  });

  // Skill file picker inside the editor
  M.after(function (root) {
    var drop = root.querySelector('[data-role="skill-drop"]'), fileIn = root.querySelector('#ed-skill-file');
    if (!drop || !fileIn) return;
    drop.addEventListener('click', function () { fileIn.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); if (e.dataTransfer.files[0]) readSkill(e.dataTransfer.files[0]); });
    fileIn.addEventListener('change', function () { if (this.files[0]) readSkill(this.files[0]); });
  });
  function readSkill(file) {
    var errBox = modalEl.querySelector('[data-role="ed-errors"]');
    if (!/\.(skill|zip)$/i.test(file.name)) { errBox.textContent = 'Choose a .skill file (got ' + file.name + ').'; return; }
    if (file.size > 5 * 1024 * 1024) { errBox.textContent = 'That file is over 5 MB. Skill files are usually under 100 KB; check it is the right file.'; return; }
    var r = new FileReader();
    r.onload = function () {
      var bytes = new Uint8Array(r.result);
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) { errBox.textContent = file.name + ' is not a valid .skill file (it is not a zip archive).'; return; }
      syncForm();
      M.editing.pendingFile = { name: V.normalizeFileName(file.name), size: file.size, data: Hub.bytesToB64(bytes) };
      M.editing.removeFile = false;
      M.render();
    };
    r.onerror = function () { errBox.textContent = 'Could not read ' + file.name + '.'; };
    r.readAsArrayBuffer(file);
  }

  // Build the finished item from the form, validate it, and put it in the draft
  function commitEditor() {
    syncForm();
    var ed = M.editing, t = ed.target, it = Hub.clone(ed.item), isNew = ed.id === null;
    var errBox = modalEl.querySelector('[data-role="ed-errors"]');
    var d = M.draft(t);
    if (t === 'amc-queries') {
      if (ed.exampleText !== undefined && !(ed.orig && ed.orig.example && sameish(tableToText(ed.orig.example), ed.exampleText))) {
        var ex = parseTable(ed.exampleText);
        if (ex && ex.columns.length) it.example = ex; else delete it.example;
      }
      if (ed.parts) {
        var orig = JSON.stringify((ed.orig && ed.orig.sqlParts) || []);
        it.sqlParts = ed.parts.map(function (p) {
          var o = Object.assign({}, p);
          ['file', 'note'].forEach(function (k) { if (!o[k]) delete o[k]; });
          return o;
        });
        if (JSON.stringify(it.sqlParts) !== orig) it.sql = it.sqlParts.map(function (p) { return p.sql; }).join('\n\n');
      } else if (Array.isArray(it.sqlParts) && it.sqlParts.length <= 1) { delete it.sqlParts; }
      if (isNew) {
        var base = Hub.slug(it.title), id = base, n = 2;
        while (d.items.some(function (x) { return x.id === id; })) id = base + '-' + n++;
        it.id = it.id && /^[A-Za-z0-9_-]+$/.test(it.id) && !d.items.some(function (x) { return x.id === it.id; }) ? it.id : id;
        it.createdAt = it.createdAt || new Date().toISOString();
      }
      ['howTo', 'requirements', 'useCases', 'tags'].forEach(function (k) { if (!Array.isArray(it[k])) it[k] = []; });
    } else {
      if (isNew) it.id = Hub.uid('t');
      if (t === 'skills') {
        if (ed.pendingFile) { it.skillData = ed.pendingFile.data; it.skillFileName = ed.pendingFile.name; }
        else if (ed.removeFile) { delete it.skillData; delete it.skillFileName; }
      }
    }
    var check = V.validateItem(t, it, { tags: Hub.tagList().map(function (x) { return x.name; }) });
    if (check.errors.length) {
      errBox.innerHTML = 'Not saved yet:<br>' + check.errors.map(esc).join('<br>');
      errBox.scrollIntoView({ block: 'center' });
      return null;
    }
    if (isNew) {
      d.items.push(it);
      d.log.push(M.logEntry(t, 'added', 'Added "' + V.itemLabel(t, it) + '" to ' + V.TARGETS[t].label));
    } else {
      var idx = -1; d.items.forEach(function (x, i) { if (x.id === ed.id) idx = i; });
      if (idx === -1) { errBox.textContent = 'This entry was removed while you were editing it.'; return null; }
      var fields = V.changedFields(d.items[idx], it);
      if (!fields.length) { M.editing = null; return { item: it, unchanged: true }; }
      if (t === 'amc-queries') it.updatedAt = new Date().toISOString();
      d.items[idx] = it;
      var names = M.fieldNames(fields);
      d.log.push(M.logEntry(t, 'edited', 'Edited "' + V.itemLabel(t, it) + '" in ' + V.TARGETS[t].label + (names.length ? ': ' + names.join(', ') : '')));
    }
    M.editing = null;
    return { item: it };
  }
  M.action('save-draft', function () {
    var r = commitEditor(); if (!r) return;
    M.render(); Hub.toast(r.unchanged ? 'No changes to save' : 'Saved to draft. Publish when you are ready.');
  });
  M.action('save-publish', function (el) {
    var t = M.editing.target;
    var r = commitEditor(); if (!r) return;
    M.render();
    if (!M.isDirty(t)) { Hub.toast('No changes to publish'); return; }
    Hub.toast('Publishing ' + V.TARGETS[t].label + '…');
    M.publishDraft(t).then(function () { M.finishPublish('Published ' + V.TARGETS[t].label + '. Live for everyone in about a minute.'); },
      function (e) { M.render(); Hub.toast(e.message + ' Your change is saved as a draft.', true); });
  });

  // ---------- Tags & Categories (both live in config.json, published together) ----------
  function tagsNow() { return M.drafts.config ? M.drafts.config.tags : Hub.tagList(); }
  function catsNow() { return M.drafts.config ? M.drafts.config.categories : Hub.amcCategories(); }
  M.catsNow = catsNow;
  function tagUsage(name) {
    var n = 0, key = String(name).toLowerCase();
    V.DATA_TARGETS.forEach(function (t) { Hub.items(t).forEach(function (it) { if ((it.tags || []).some(function (x) { return String(x).toLowerCase() === key; })) n++; }); });
    return n;
  }
  function catUsage(name) {
    var key = String(name).toLowerCase();
    var items = M.drafts['amc-queries'] ? M.drafts['amc-queries'].items : Hub.items('amc-queries');
    return items.filter(function (q) { return String(q.type || 'Other').trim().toLowerCase() === key; }).length;
  }
  var catIconOpen = -1, newCatIcon = 'tag';
  function iconGrid(current, act, extra) {
    return '<div class="icon-grid" role="group" aria-label="Choose an icon">' + Object.keys(Hub.CAT_ICONS).map(function (id) {
      return '<button class="icon-pick" type="button" data-act="' + act + '" data-icon="' + id + '"' + (extra || '') + ' aria-pressed="' + (id === current) + '" title="' + esc(Hub.CAT_ICONS[id].label) + '">' + Hub.catIconSvg(id, 'icon-svg') + '</button>';
    }).join('') + '</div>';
  }
  M.tagsHtml = function () {
    var tags = tagsNow(), cats = catsNow();
    return M.pendingBarHtml('config') +
      '<div class="settings-block"><div class="section-title">AMC categories <span class="hint">Group the AMC Queries tab and its Filters menu</span></div>' +
      '<div class="cat-list">' + (cats.length ? cats.map(function (c, i) {
        var used = catUsage(c.name);
        return '<div class="cat-row"><button class="cat-icon-btn" type="button" data-act="cat-icon-toggle" data-i="' + i + '" aria-expanded="' + (catIconOpen === i) + '" title="Change icon">' + Hub.catIconSvg(c.icon, 'icon-svg') + '</button>' +
          '<span class="cat-name">' + esc(c.name) + '</span><span class="muted">' + used + (used === 1 ? ' query' : ' queries') + '</span>' +
          '<span class="cat-actions"><button class="btn btn-secondary btn-small" type="button" data-act="cat-move" data-i="' + i + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
          '<button class="btn btn-secondary btn-small" type="button" data-act="cat-move" data-i="' + i + '" data-d="1"' + (i === cats.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' +
          '<button class="btn btn-danger btn-small" type="button" data-act="remove-cat" data-i="' + i + '">Remove</button></span></div>' +
          (catIconOpen === i ? '<div class="cat-icon-panel">' + iconGrid(c.icon, 'set-cat-icon', ' data-i="' + i + '"') + '</div>' : '');
      }).join('') : '<div class="empty-row">No categories yet.</div>') + '</div>' +
      '<div class="field" style="margin-top:14px"><label class="field-label" for="new-cat-name">Add a category</label>' +
      '<div class="add-tag-row"><span class="cat-icon-preview" title="Icon">' + Hub.catIconSvg(newCatIcon, 'icon-svg') + '</span><input class="input" id="new-cat-name" type="text" placeholder="Category name, e.g. Retention" maxlength="60">' +
      '<button class="btn btn-secondary" type="button" data-act="add-cat">Add category</button></div>' +
      '<p class="field-hint" style="margin:8px 0 6px">Icon</p>' + iconGrid(newCatIcon, 'new-cat-icon') +
      '<p class="field-error" id="cat-err" role="alert"></p>' +
      '<p class="field-hint">Renaming would also change the queries file, so to rename: add the new category, move the queries to it in Content, then remove the old one.</p></div></div>' +
      '<div class="settings-block"><div class="section-title">Tags <span class="hint">Label apps, skills and resources and power the Filters menu</span></div>' +
      '<div class="tag-edit-list">' + (tags.length ? tags.map(function (t, i) {
        var used = tagUsage(t.name);
        return '<span class="tag-edit"><span>' + esc(t.name) + '</span><span class="muted" title="Entries using this tag">' + used + '</span>' +
          '<button class="x" type="button" data-act="remove-tag" data-i="' + i + '" aria-label="Remove ' + esc(t.name) + '">' + Hub.icon('close').replace('<svg', '<svg width="10" height="10"') + '</button></span>';
      }).join('') : '<span class="muted">No tags yet.</span>') + '</div>' +
      '<div class="add-tag-row"><input class="input" id="new-tag-name" type="text" placeholder="Tag name, e.g. Sponsored Display" maxlength="40">' +
      '<button class="btn btn-secondary" type="button" data-act="add-tag">Add tag</button></div>' +
      '<p class="field-error" id="tag-err" role="alert"></p>' +
      '<p class="field-hint">Removing a tag here keeps it on existing entries.</p></div>';
  };
  M.action('cat-icon-toggle', function (el) { var i = +el.getAttribute('data-i'); catIconOpen = catIconOpen === i ? -1 : i; M.render(); });
  M.action('set-cat-icon', function (el) {
    var i = +el.getAttribute('data-i'), icon = el.getAttribute('data-icon'), d = M.draft('config'), c = d.categories[i];
    if (!c || c.icon === icon) { catIconOpen = -1; M.render(); return; }
    c.icon = icon;
    d.log = d.log.filter(function (x) { return x.text !== 'Changed the icon of category "' + c.name + '"'; });
    d.log.push(M.logEntry('config', 'category-icon', 'Changed the icon of category "' + c.name + '"'));
    catIconOpen = -1; M.render();
  });
  M.action('new-cat-icon', function (el) {
    var name = modalEl.querySelector('#new-cat-name').value;
    newCatIcon = el.getAttribute('data-icon'); M.render();
    var inp = modalEl.querySelector('#new-cat-name'); inp.value = name; inp.focus();
  });
  M.action('add-cat', function () {
    var nameEl = modalEl.querySelector('#new-cat-name'), err = modalEl.querySelector('#cat-err');
    var name = nameEl.value.trim().replace(/\s+/g, ' ');
    if (!name) { err.textContent = 'Type a category name first.'; nameEl.focus(); return; }
    if (catsNow().some(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })) { err.textContent = 'There is already a category called "' + name + '".'; return; }
    var d = M.draft('config');
    var otherAt = -1; d.categories.forEach(function (c, i) { if (c.name.toLowerCase() === 'other') otherAt = i; });
    var entry = { name: name, icon: newCatIcon };
    if (otherAt === -1) d.categories.push(entry); else d.categories.splice(otherAt, 0, entry);   // keep Other last
    d.log.push(M.logEntry('config', 'category-added', 'Added AMC category "' + name + '"'));
    newCatIcon = 'tag'; M.render();
  });
  M.action('cat-move', function (el) {
    var i = +el.getAttribute('data-i'), dir = +el.getAttribute('data-d'), d = M.draft('config'), j = i + dir;
    if (j < 0 || j >= d.categories.length) return;
    var moved = d.categories.splice(i, 1)[0]; d.categories.splice(j, 0, moved);
    d.log.push(M.logEntry('config', 'category-moved', 'Moved AMC category "' + moved.name + '" to position ' + (j + 1)));
    catIconOpen = -1; M.render();
  });
  M.action('remove-cat', function (el) {
    var i = +el.getAttribute('data-i'), c = catsNow()[i]; if (!c) return;
    var used = catUsage(c.name);
    if (!M.confirmClick(el, used ? used + ' use it. Click again' : 'Click again')) return;
    var d = M.draft('config'), removed = d.categories.splice(i, 1)[0];
    d.log.push(M.logEntry('config', 'category-removed', 'Removed AMC category "' + removed.name + '"'));
    catIconOpen = -1; M.render();
  });
  M.action('add-tag', function () {
    var nameEl = modalEl.querySelector('#new-tag-name'), err = modalEl.querySelector('#tag-err');
    var name = nameEl.value.trim().replace(/\s+/g, ' ');
    if (!name) { err.textContent = 'Type a tag name first.'; nameEl.focus(); return; }
    if (V.RESERVED_TAGS.indexOf(name.toLowerCase()) !== -1) { err.textContent = '"' + name + '" is a tab name, so it cannot be a tag.'; return; }
    if (tagsNow().some(function (t) { return t.name.toLowerCase() === name.toLowerCase(); })) { err.textContent = 'There is already a tag called "' + name + '".'; return; }
    var d = M.draft('config');
    d.tags.push({ name: name });
    d.log.push(M.logEntry('config', 'tag-added', 'Added tag "' + name + '"'));
    M.render();
  });
  M.action('remove-tag', function (el) {
    var i = +el.getAttribute('data-i'), t = tagsNow()[i]; if (!t) return;
    var used = tagUsage(t.name);
    if (!M.confirmClick(el, used ? 'Used by ' + used + '. Click again' : 'Click again')) return;
    var d = M.draft('config'), removed = d.tags.splice(i, 1)[0];
    d.log.push(M.logEntry('config', 'tag-removed', 'Removed tag "' + removed.name + '"'));
    M.render();
  });

  // ---------- Upload ----------
  var UPLOAD_TARGETS = V.DATA_TARGETS.concat(['config', 'site']);
  function uploadLabel(k) { return k === 'site' ? 'Site code' : V.TARGETS[k].label; }
  var PUBLISH_TARGETS = V.DATA_TARGETS.concat(['config']);
  var pushState = { kind: '', text: '' };   // '', 'busy', 'ok', 'bad'
  function publishCurrentHtml() {
    var dirty = PUBLISH_TARGETS.filter(function (t) { return M.isDirty(t) && !M.conflict[t]; });
    var s = M.settings();
    var status = pushState.kind ? pushState
      : dirty.length ? { kind: 'busy-idle', text: dirty.length + ' file' + (dirty.length === 1 ? '' : 's') + ' with changes ready to push' }
      : { kind: 'ok-idle', text: 'Everything is live' };
    var dot = status.kind === 'busy' ? 'busy' : status.kind === 'bad' ? 'bad' : status.kind === 'busy-idle' ? 'busy' : 'ok';
    return '<div class="pub-block"><div class="section-title">Publish current <span class="hint">Changes made here in Manage Page that are not live yet</span></div>' +
      '<div class="push-box">' +
        '<div class="status-line" style="margin:0 0 10px"><span class="status-dot ' + dot + '"></span><span data-role="push-status">' + esc(status.text) + '</span></div>' +
        '<p class="note" style="margin-bottom:12px">Click <strong>Push to GitHub</strong> to make your edits live. Each changed tab is saved as its own file, the current version is backed up first, and everyone sees the update in about a minute.</p>' +
        (s ? '<p class="field-hint" style="margin-bottom:14px">Pushing to <strong style="color:var(--white)">' + esc(s.username + ' / ' + s.repo) + '</strong></p>' : '') +
        '<button class="btn btn-primary" type="button" data-act="push-all"' + (M.canPublish() && dirty.length && pushState.kind !== 'busy' ? '' : ' disabled') + '>' +
          Hub.icon('external').replace('<svg', '<svg style="transform:rotate(0deg)"') + 'Push to GitHub</button>' +
      '</div>' +
      '<div class="item-list" style="margin-top:12px">' + PUBLISH_TARGETS.map(function (t) {
        var T = V.TARGETS[t], state;
        if (M.conflict[t]) state = '<span class="pub-state bad">Someone else published first</span><button class="btn btn-danger btn-small" type="button" data-act="reload-latest" data-target="' + t + '">Load latest</button>';
        else if (M.isDirty(t)) state = '<span class="pub-state">' + esc(V.summarizeDiff(M.draftDiff(t))) + '</span>' +
          '<button class="btn btn-secondary btn-small" type="button" data-act="discard" data-target="' + t + '">Discard</button>';
        else state = '<span class="pub-state ok">' + Hub.icon('check').replace('<svg', '<svg width="13" height="13"') + 'Up to date</span>';
        return '<div class="item-row"><span class="item-name">' + esc(T.label) + ' <span class="muted" style="font-weight:400">' + esc(T.file) + '</span></span>' + state + '</div>';
      }).join('') + '</div></div>';
  }
  // ---------- step 3: edit with Claude (skill or copy-paste prompt) ----------
  var SKILL_NAME = 'amazon-ads-team-tools-hub-editor';
  var promptCache = {};   // upload target -> text | null (loading) | { error }
  function promptUrl(k) { return 'downloads/prompts/' + k + '.md?v=' + encodeURIComponent(window.HUB_BUILD || ''); }
  function loadPrompt(k) {
    if (k in promptCache) return;
    promptCache[k] = null;
    fetch(promptUrl(k), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) { promptCache[k] = t; }, function (e) { promptCache[k] = { error: e.message }; });
  }
  function claudeStepHtml(k) {
    if (!Hub.preview) loadPrompt(k);
    var label = k === 'site' ? 'site code' : V.TARGETS[k].file;
    return 'Edit it with Claude. Pick one way:' +
      '<div class="claude-options">' +
        '<div class="claude-option"><strong>Use the Claude skill</strong><span>Add the Amazon Ads Team Tools Hub Editor skill to Claude once. It knows every file here, asks for anything missing, and checks the file before giving it back.</span>' +
          '<a class="btn btn-secondary btn-small" href="downloads/' + SKILL_NAME + '.skill" download="' + SKILL_NAME + '.skill">' + Hub.icon('download') + 'Download the Claude skill</a></div>' +
        '<div class="claude-option"><strong>Or copy a prompt</strong><span>Paste it into Claude together with the file, then describe your change at the bottom.</span>' +
          '<button class="btn btn-secondary btn-small" type="button" data-act="copy-prompt" data-target="' + k + '">' + Hub.icon('copy') + 'Copy prompt for ' + esc(label) + '</button></div>' +
      '</div>' +
      '<div data-role="prompt-fallback"></div>' +
      '<p class="field-hint" style="margin-top:8px">Keep the file name the same when you save Claude\'s version.</p>';
  }
  M.action('copy-prompt', function (el) {
    var k = el.getAttribute('data-target'), box = modalEl.querySelector('[data-role="prompt-fallback"]');
    function show(text) {
      // Copying was blocked: show the prompt selected so it can be copied by hand
      box.innerHTML = '<p class="field-hint" style="margin:10px 0 6px">Your browser blocked copying. The prompt is selected below; press Ctrl+C or Cmd+C.</p><textarea class="textarea code" readonly style="min-height:160px"></textarea>';
      var ta = box.querySelector('textarea'); ta.value = text; ta.focus(); ta.select();
    }
    function copy(text) {
      Hub.copyText(text).then(function (ok) {
        if (ok) { Hub.toast('Prompt copied. Paste it into Claude with the file.'); el.classList.add('is-done'); setTimeout(function () { el.classList.remove('is-done'); }, 1600); }
        else show(text);
      });
    }
    var cached = promptCache[k];
    if (typeof cached === 'string') { copy(cached); return; }
    if (Hub.preview) { Hub.toast('Prompts are available on the live site.', true); return; }
    el.disabled = true;
    fetch(promptUrl(k), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) { promptCache[k] = t; el.disabled = false; copy(t); },
        function () { el.disabled = false; Hub.toast('Could not load the prompt. Check your connection and try again.', true); });
  });

  var backupsCache = {};   // upload target -> null (loading) | [backups] | { error }
  Hub.on('backupschange', function (t) { delete backupsCache[t]; if (modalEl && M.section === 'upload' && M.uploadTarget === t) M.render(); });
  function backupsHtml(k) {
    if (Hub.preview || !M.settings()) return '<p class="field-hint" style="margin-top:8px">Earlier versions are listed here on the live site.</p>';
    var paths = k === 'site' ? V.SITE_FILES : [V.TARGETS[k].path];
    if (!(k in backupsCache)) {
      backupsCache[k] = null;
      Promise.all(paths.map(M.listBackups)).then(function (lists) {
        backupsCache[k] = [].concat.apply([], lists).sort(function (a, b) { return b.date - a.date; });
      }, function (e) { backupsCache[k] = { error: e.message }; }).then(function () { if (M.section === 'upload' && M.uploadTarget === k) M.render(); });
    }
    var list = backupsCache[k];
    var head = '<div class="backup-list"><div class="field-hint">Earlier versions, saved automatically before every publish (newest ' + M.BACKUPS_KEPT + ' kept per file). To restore one, download it and drop it in step 4.</div>';
    if (list === null) return head + '<div class="field-hint">Loading…</div></div>';
    if (list.error) return head + '<div class="field-error">Could not load backups: ' + esc(list.error) + '</div></div>';
    if (!list.length) return head + '<div class="field-hint">No backups yet. One is made the next time this file is published.</div></div>';
    return head + list.map(function (b) {
      return '<div class="backup-row"><span>' + esc(b.original) + '</span><span class="muted">' + esc(Hub.fmtTime(b.date.toISOString())) + '</span>' +
        '<button class="btn btn-secondary btn-small" type="button" data-act="download-backup" data-path="' + esc(b.path) + '" data-name="' + esc(b.original) + '">' + Hub.icon('download') + 'Download</button></div>';
    }).join('') + '</div>';
  }
  M.action('download-backup', function (el) {
    var path = el.getAttribute('data-path'), name = el.getAttribute('data-name');
    M.ghGet(path).then(function (f) {
      if (f.text === null) throw new Error('That backup no longer exists.');
      Hub.download(name, f.text, /\.json$/.test(name) ? 'application/json' : /\.js$/.test(name) ? 'text/javascript' : 'text/html');
      Hub.toast('Downloaded the backup as ' + name);
    }).catch(function (e) { Hub.toast(e.message, true); });
  });
  M.action('push-all', function (el) {
    var targets = PUBLISH_TARGETS.filter(function (t) { return M.isDirty(t) && !M.conflict[t]; });
    if (!targets.length) return;
    var done = [];
    pushState = { kind: 'busy', text: 'Pushing to GitHub…' }; M.render();
    targets.reduce(function (chain, t) {
      return chain.then(function () { return M.publishDraft(t).then(function () { done.push(V.TARGETS[t].label); }); });
    }, Promise.resolve()).then(function () {
      pushState = { kind: '', text: '' };
      M.finishPublish('Pushed ' + done.join(', ') + ' to GitHub. Live for everyone in about a minute.');
    }, function (e) {
      pushState = { kind: 'bad', text: 'Not pushed: ' + e.message + (done.length ? ' (Already pushed: ' + done.join(', ') + '.)' : '') };
      M.render(); Hub.toast(e.message, true);
      setTimeout(function () { pushState = { kind: '', text: '' }; }, 15000);
    });
  });
  function steps(list) {
    return '<ol class="steps-list" data-role="upload-steps">' + list.map(function (s, i) { return '<li><span class="step-n">' + (i + 1) + '</span><div class="step-body">' + s + '</div></li>'; }).join('') + '</ol>';
  }
  M.uploadHtml = function () {
    var k = M.uploadTarget, isSite = k === 'site';
    var u = M.upload && M.upload.target === k ? M.upload : null;
    var pick = '<div class="seg seg-sub" role="tablist">' + UPLOAD_TARGETS.map(function (x) {
      return '<button class="seg-btn" type="button" data-act="upload-target" data-v="' + x + '" aria-selected="' + (x === k) + '">' + esc(uploadLabel(x)) + '</button>';
    }).join('') + '</div>';
    var download = isSite
      ? 'Download the code file you want to change.<div class="code-files">' + V.SITE_FILES.map(function (f) {
          return '<button class="btn btn-secondary btn-small" type="button" data-act="download-code" data-path="' + f + '">' + Hub.icon('download') + esc(f) + '</button>';
        }).join('') + '</div>'
      : 'Download the current file. <button class="btn btn-secondary btn-small" type="button" data-act="download-current" data-target="' + k + '">' + Hub.icon('download') + 'Download ' + esc(V.TARGETS[k].file) + '</button>';
    download += backupsHtml(k);
    var drop = '<div class="drop-zone" data-role="upload-drop" tabindex="0"><strong>Drop ' + (isSite ? 'the edited code files' : 'the edited ' + esc(V.TARGETS[k].file)) + ' here or click to choose</strong>' +
      '<span>' + (isSite ? 'You can drop several at once' : 'Only ' + esc(V.TARGETS[k].label) + ' changes; every other tab stays as it is') + '</span></div>' +
      '<input type="file" id="upload-input" ' + (isSite ? 'accept=".html,.js" multiple' : 'accept=".json,application/json"') + ' hidden>';
    return publishCurrentHtml() +
      '<div class="pub-block"><div class="section-title">Upload from file <span class="hint">Make bigger changes with Claude, then publish the edited file</span></div>' +
      steps([
        'Choose what to update.' + pick,
        download,
        claudeStepHtml(k),
        'Drop the edited file below.' + drop,
        'Check the results, then publish.' + (u ? uploadReportHtml(u) : '<p class="field-hint" style="margin-top:6px">The checks and a preview of what changes appear here after you drop a file.</p>')
      ]) + '</div>';
  };
  M.action('download-code', function (el) {
    var path = el.getAttribute('data-path'), name = path.split('/').pop();
    var viaGitHub = M.canPublish() ? M.ghGet(path).then(function (f) { if (f.text === null) throw new Error(path + ' is not in the repo yet.'); return f.text; }) : Promise.reject(new Error('no connection'));
    viaGitHub.catch(function () {
      return fetch(path + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
    }).then(function (text) {
      Hub.download(name, text, path.slice(-3) === '.js' ? 'text/javascript' : 'text/html');
      Hub.toast('Downloaded ' + name);
    }, function () { Hub.toast('Could not download ' + path + '. Code files can only be downloaded from the live site.', true); });
  });
  M.action('upload-target', function (el) { M.uploadTarget = el.getAttribute('data-v'); M.upload = null; M.render(); });
  M.action('download-current', function (el) {
    var t = el.getAttribute('data-target'), obj = M.published(t);
    if (!obj) { Hub.toast(V.TARGETS[t].file + ' has not loaded.', true); return; }
    Hub.download(V.TARGETS[t].file, JSON.stringify(obj, null, 2) + '\n', 'application/json');
  });
  M.after(function (root) {
    var drop = root.querySelector('[data-role="upload-drop"]'), fileIn = root.querySelector('#upload-input');
    if (!drop || !fileIn) return;
    drop.addEventListener('click', function () { fileIn.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); readUpload(Array.prototype.slice.call(e.dataTransfer.files)); });
    fileIn.addEventListener('change', function () { readUpload(Array.prototype.slice.call(this.files)); });
  });
  function readText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      r.readAsText(file, 'utf-8');
    });
  }
  function readUpload(files) {
    var k = M.uploadTarget;
    if (!files.length) return;
    if (k !== 'site' && files.length > 1) { M.upload = { target: k, fatal: 'Drop one file at a time here.' }; M.render(); return; }
    Promise.all(files.map(function (f) { return readText(f).then(function (text) { return { name: f.name, size: f.size, text: text }; }); }))
      .then(function (list) { M.upload = k === 'site' ? checkSite(list) : checkData(k, list[0]); M.render(); },
        function (e) { M.upload = { target: k, fatal: e.message }; M.render(); });
  }
  M.checkData = checkData;
  function checkData(k, f) {
    var T = V.TARGETS[k], u = { target: k, fileName: f.name, checks: [], errors: [], warnings: [], obj: null, diff: null };
    var fn = V.checkFileName(k, f.name);
    if (!fn.ok) { u.errors.push(fn.message); return u; }
    u.checks.push('File name is ' + T.file + (fn.note ? ' (' + fn.note + ')' : ''));
    if (f.size > V.SIZE_WARN) u.warnings.push('This file is ' + Math.round(f.size / 1024) + ' KB. That works, but large files are slower to publish and load.');
    var p = V.parseJson(f.text);
    if (!p.ok) { u.errors.push('The file is not valid JSON. ' + p.error); return u; }
    u.checks.push('Valid JSON');
    var r = V.validateData(k, p.value, { tags: Hub.tagList().map(function (t) { return t.name; }) });
    u.checks = u.checks.concat(r.checks); u.errors = u.errors.concat(r.errors); u.warnings = u.warnings.concat(r.warnings);
    u.obj = p.value;
    if (!r.errors.length) {
      var pub = M.published(k) || {};
      u.diff = k === 'config' ? V.diffConfig(pub, p.value) : V.diffItems(k, pub.items, p.value.items);
      var same = !u.diff.added.length && !u.diff.removed.length && !u.diff.changed.length && !u.diff.reordered;
      u.same = same;
      if (M.isDirty(k)) u.warnings.push('You have unpublished edits to ' + T.label + '. Publishing this upload replaces them.');
      if (Array.isArray(p.value.log) && JSON.stringify(p.value.log) !== JSON.stringify(pub.log || [])) u.warnings.push('The history inside the uploaded file is ignored; the live history is kept and this upload is added to it.');
    }
    return u;
  }
  function checkSite(list) {
    var u = { target: 'site', files: [] };
    list.forEach(function (f) {
      var base = V.normalizeFileName(f.name);
      var path = V.SITE_FILES.filter(function (s) { return s.split('/').pop() === base; })[0] || base;
      var r = V.validateSiteFile(path, f.text);
      if (base !== f.name.split(/[\\/]/).pop()) r.checks.unshift('Read "' + f.name + '" as ' + base);
      u.files.push({ name: f.name, path: path, text: f.text, size: f.size, checks: r.checks, errors: r.errors, warnings: r.warnings });
    });
    var paths = u.files.map(function (f) { return f.path; });
    u.files.forEach(function (f) { if (paths.indexOf(f.path) !== paths.lastIndexOf(f.path)) f.errors.push('Two of the dropped files are both ' + f.path + '. Drop just one.'); });
    return u;
  }
  function li(cls, mark, text) { return '<li class="' + cls + '"><span class="mark">' + mark + '</span><span>' + text + '</span></li>'; }
  function listNames(arr, max) {
    max = max || 8;
    var names = arr.slice(0, max).map(function (x) { return '"' + esc(typeof x === 'string' ? x : x.label) + '"' + (x.fields ? ' (' + esc(M.fieldNames(x.fields).join(', ') || 'details') + ')' : ''); });
    return names.join(', ') + (arr.length > max ? ' and ' + (arr.length - max) + ' more' : '');
  }
  function uploadReportHtml(u) {
    if (u.fatal) return '<div class="report"><ul>' + li('err', '✕', esc(u.fatal)) + '</ul></div>';
    if (u.target === 'site') {
      var okCount = u.files.filter(function (f) { return !f.errors.length; }).length;
      return u.files.map(function (f) {
        return '<div class="report"><h4>' + esc(f.path) + ' <span class="muted">(' + Math.round(f.size / 1024) + ' KB)</span>' + (f.done ? ' <span style="color:var(--green)">Published</span>' : '') + '</h4><ul>' +
          f.checks.map(function (c) { return li('ok', '✓', esc(c)); }).join('') + f.errors.map(function (c) { return li('err', '✕', esc(c)); }).join('') +
          f.warnings.map(function (c) { return li('warn', '!', esc(c)); }).join('') + (f.backup ? li('ok', '✓', 'Saved the previous version as ' + esc(f.backup) + '.') : '') +
          (f.failed ? li('err', '✕', esc(f.failed)) : '') + '</ul></div>';
      }).join('') +
        '<div class="modal-actions">' + (okCount === u.files.length && !u.done
          ? '<button class="btn btn-primary" type="button" data-act="publish-site"' + (M.canPublish() ? '' : ' disabled') + '>Publish ' + okCount + ' code file' + (okCount === 1 ? '' : 's') + '</button>'
          : !u.done ? '<p class="note" style="margin:0">Fix the problems marked above, then drop the files again.</p>' : '') +
        '<button class="btn btn-secondary" type="button" data-act="clear-upload">' + (u.done ? 'Done' : 'Cancel') + '</button></div>';
    }
    var T = V.TARGETS[u.target];
    var h = '<div class="report"><h4>Checks for ' + esc(u.fileName) + '</h4><ul>' +
      u.checks.map(function (c) { return li('ok', '✓', esc(c)); }).join('') +
      u.errors.slice(0, 25).map(function (c) { return li('err', '✕', esc(c)); }).join('') +
      (u.errors.length > 25 ? li('err', '✕', (u.errors.length - 25) + ' more problems not shown') : '') +
      u.warnings.slice(0, 15).map(function (c) { return li('warn', '!', esc(c)); }).join('') +
      (u.warnings.length > 15 ? li('warn', '!', (u.warnings.length - 15) + ' more notes not shown') : '') + '</ul></div>';
    if (u.diff) {
      var d = u.diff;
      h += '<div class="report"><h4>What changes on the live site</h4><ul>' +
        (u.same ? li('ok', '=', 'This file matches what is live. Nothing would change.') :
          (d.added.length ? li('diff-line', '+', '<strong>' + d.added.length + ' added:</strong> ' + listNames(d.added)) : '') +
          (d.changed && d.changed.length ? li('diff-line', '~', '<strong>' + d.changed.length + ' edited:</strong> ' + listNames(d.changed)) : '') +
          (d.recolored && d.recolored.length ? li('diff-line', '~', '<strong>' + d.recolored.length + ' recolored:</strong> ' + listNames(d.recolored)) : '') +
          (d.removed.length ? li('err', '−', '<strong>' + d.removed.length + ' removed:</strong> ' + listNames(d.removed)) : '') +
          (d.reordered ? li('diff-line', '↕', 'The order changes.') : '') +
          (d.unchanged ? li('diff-line', '=', d.unchanged + ' unchanged') : '')) + '</ul></div>';
    }
    if (u.done) h += '<div class="report"><ul>' + (u.backup ? li('ok', '✓', 'Saved the previous version as ' + esc(u.backup) + '.') : '') +
      li('ok', '✓', 'Published ' + esc(T.file) + '. Live for everyone in about a minute.') + '</ul></div>';
    var removing = u.diff && u.diff.removed && u.diff.removed.length;
    h += '<div class="modal-actions">' +
      (!u.errors.length && !u.same && !u.done ? '<button class="btn ' + (removing ? 'btn-danger' : 'btn-primary') + '" type="button" data-act="publish-upload"' + (M.canPublish() ? '' : ' disabled') + '>' +
        'Publish ' + esc(T.file) + (removing ? ' (removes ' + removing + ')' : '') + '</button>' : '') +
      '<button class="btn btn-secondary" type="button" data-act="clear-upload">' + (u.done ? 'Done' : 'Cancel') + '</button></div>';
    if (u.errors.length) h += '<p class="note" style="margin-top:10px">Nothing was published. Fix the problems marked with ✕ and drop the file again.</p>';
    return h;
  }
  M.action('clear-upload', function () { M.upload = null; M.render(); });
  M.action('publish-upload', function (el) {
    var u = M.upload; if (!u || !u.obj || u.errors.length) return;
    if (u.diff && u.diff.removed && u.diff.removed.length && !M.confirmClick(el, 'Click again to publish and remove ' + u.diff.removed.length)) return;
    el.disabled = true; el.textContent = 'Backing up the current file…';
    var k = u.target, obj = Hub.clone(u.obj), path = V.TARGETS[k].path;
    M.backupFile(path).then(function (bpath) {
      u.backup = bpath;
      el.textContent = 'Publishing…';
      var entry = M.logEntry(k, 'upload', 'Uploaded ' + V.TARGETS[k].file + ' (' + V.summarizeDiff(u.diff) + ')' + (bpath ? '. Previous version backed up.' : ''));
      return M.publishObject(k, obj, [entry], 'upload, ' + V.summarizeDiff(u.diff));
    }).then(function () {
      M.discard(k); u.done = true; delete backupsCache[k]; M.upload = null;
      M.finishPublish('Published ' + V.TARGETS[k].file + (u.backup ? ' and backed up the previous version' : '') + '. Live for everyone in about a minute.');
      return M.pruneBackups(path).then(function () { delete backupsCache[k]; });
    }, function (e) { M.render(); Hub.toast(e.message, true); });
  });
  M.action('publish-site', function (el) {
    var u = M.upload; if (!u || u.target !== 'site') return;
    if (!M.confirmClick(el, 'Click again to publish the code')) return;
    el.disabled = true; el.textContent = 'Publishing…';
    var done = [];
    u.files.reduce(function (chain, f) {
      return chain.then(function () {
        return M.backupFile(f.path).then(function (bpath) {
          f.backup = bpath;
          return M.publishSiteFile(f.path, f.text);
        }).then(function () { f.done = true; done.push(f.path); return M.pruneBackups(f.path); }, function (e) { f.failed = 'Not published: ' + e.message; throw e; });
      });
    }, Promise.resolve()).then(function () {
      u.done = true; delete backupsCache.site; M.upload = null;
      M.appendConfigLog(M.logEntry('site', 'site-code', 'Updated site code: ' + done.join(', ')));
      M.finishPublish('Published ' + done.length + ' code file' + (done.length === 1 ? '' : 's') + '. Open pages, including this one, will offer a refresh once the new code is live.');
    }, function (e) {
      if (done.length) M.appendConfigLog(M.logEntry('site', 'site-code', 'Updated site code: ' + done.join(', ') + ' (stopped early: ' + e.message + ')'));
      M.render(); Hub.toast(e.message + (done.length ? ' Published before the error: ' + done.join(', ') + '.' : ''), true);
    });
  });

  // ---------- Updates (activity from every file, newest first) ----------
  var updatesFilter = 'all';
  var FILTERS = [['all', 'All'], ['amc-queries', 'AMC Queries'], ['apps', 'Apps'], ['skills', 'Skills'], ['resources', 'Resources'], ['config', 'Tags'], ['site', 'Site code'], ['legacy', 'Earlier history']];
  M.allLog = function () {
    var all = [];
    ['config'].concat(V.DATA_TARGETS).forEach(function (t) {
      var f = Hub.data[t];
      (f && Array.isArray(f.log) ? f.log : []).forEach(function (e) { all.push(Object.assign({ target: t }, e)); });
    });
    all.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
    return all;
  };
  M.updatesHtml = function () {
    var all = M.allLog();
    var list = updatesFilter === 'all' ? all : all.filter(function (e) { return e.target === updatesFilter; });
    return '<div class="chip-row">' + FILTERS.map(function (f) {
        var n = f[0] === 'all' ? all.length : all.filter(function (e) { return e.target === f[0]; }).length;
        if (!n && f[0] !== 'all') return '';
        return '<button class="filter-chip" type="button" data-act="updates-filter" data-v="' + f[0] + '" aria-pressed="' + (updatesFilter === f[0]) + '">' + esc(f[1]) + '<span class="n">' + n + '</span></button>';
      }).join('') + '</div>' +
      (list.length ? '<div class="log-list">' + list.map(function (e) {
        var who = e.actor ? '<strong>' + esc(e.actor) + '</strong>' + (e.device ? ' on ' + esc(e.device) : '') + ', ' : '';
        return '<div class="log-item"><span class="log-dot" style="background:' + (TARGET_COLORS[e.target] || 'var(--gray-dim)') + '"></span><div>' +
          '<div class="log-text">' + esc(e.text) + '</div><div class="log-meta">' + who + esc(Hub.fmtTime(e.time)) + '</div></div></div>';
      }).join('') + '</div>' : '<p class="note">No activity yet.</p>') +
      '<p class="field-hint" style="margin-top:16px">Each file keeps its latest ' + V.LOG_CAP + ' entries. Unpublished edits show here once they are published.</p>';
  };
  M.action('updates-filter', function (el) { updatesFilter = el.getAttribute('data-v'); M.render(); });

  // ---------- Settings ----------
  var settingsUnlocked = false;
  M.settingsHtml = function () {
    var s = M.settings();
    var tokenTail = s && s.token ? s.token.slice(-4) : '';
    var h = '<div class="settings-block"><div class="section-title">Your name</div>' +
      '<p class="note">Shown in Updates next to each change you make from this browser.</p>' +
      '<div class="inline-form"><input class="input" id="set-name" type="text" value="' + esc(Hub.managerName()) + '" placeholder="e.g. Hunter G.">' +
      '<button class="btn btn-secondary" type="button" data-act="save-name">Save name</button></div><p class="msg" id="name-msg"></p></div>';

    h += '<div class="settings-block"><div class="section-title">GitHub connection</div>' +
      (s ? '<p class="note">Publishing to <strong>' + esc(s.username + '/' + s.repo) + '</strong> with a token ending in <code>' + esc(tokenTail) + '</code> (' + esc(s.source) + ').</p>'
         : '<p class="note">Not connected. Publishing is off until a token is added.</p>') +
      '<div class="inline-form"><button class="btn btn-secondary" type="button" data-act="check-conn"' + (s && !Hub.preview ? '' : ' disabled') + '>Check connection</button></div><p class="msg" id="conn-msg"></p>';
    if (!settingsUnlocked) {
      h += '<div class="field" style="margin-top:14px"><label class="field-label" for="set-unlock">Enter the manager password again to change the connection</label>' +
        '<div class="inline-form"><input class="input" id="set-unlock" type="password" autocomplete="current-password"><button class="btn btn-secondary" type="button" data-act="unlock-settings">Unlock</button></div>' +
        '<p class="field-error" id="unlock-err"></p></div>';
    } else {
      h += '<div style="margin-top:14px"><div class="field-row">' + field('gh-user', 'GitHub username', input('gh-user', s ? s.username : 'HunterG-vendo')) +
        field('gh-repo', 'Repository', input('gh-repo', s ? s.repo : 'Amazon-Ads-Team-Tools')) + '</div>' +
        field('gh-token', 'Access token', input('gh-token', '', 'Paste a new token to replace the current one', 'password'),
          'Use a fine-grained token limited to this one repository with Contents set to Read and write. Saving here affects this browser only.') +
        '<div class="inline-form"><button class="btn btn-primary" type="button" data-act="save-gh">Save for this browser</button>' +
        '<button class="btn btn-secondary" type="button" data-act="copy-config">Copy GH_CONFIG line for index.html</button>' +
        (Hub.store.get('pltfrm_gh') ? '<button class="btn btn-danger" type="button" data-act="clear-gh">Use the built-in connection</button>' : '') + '</div>' +
        '<p class="msg" id="gh-msg"></p><p class="field-hint">To change the connection for everyone, copy the GH_CONFIG line, replace the matching line in index.html, and upload it under Upload, Site code.</p></div>';
    }
    h += '</div>';

    h += '<div class="settings-block"><div class="section-title">Manager password</div>' +
      '<p class="note">This changes the password on this browser only. Everyone else keeps the shared password.</p>' +
      '<div class="field-row">' + field('pw-new', 'New password', input('pw-new', '', '', 'password')) + field('pw-confirm', 'Type it again', input('pw-confirm', '', '', 'password')) + '</div>' +
      field('pw-cur', 'Current password', input('pw-cur', '', '', 'password')) +
      '<button class="btn btn-secondary" type="button" data-act="change-pw">Change password</button><p class="msg" id="pw-msg"></p></div>';
    return h;
  };
  function msg(id, text, ok) { var el = modalEl.querySelector('#' + id); if (el) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'bad'); } }
  M.action('save-name', function () {
    var n = Hub.setManagerName(modalEl.querySelector('#set-name').value);
    if (!n) { msg('name-msg', 'Type your name first.', false); return; }
    msg('name-msg', 'Saved. Your next changes will show as ' + n + '.', true);
  });
  M.action('check-conn', function (el) {
    el.disabled = true; msg('conn-msg', 'Checking…', true);
    M.checkConnection().then(function (r) {
      el.disabled = false;
      msg('conn-msg', r.canPush ? 'Connected to ' + r.fullName + '. This token can publish.' : 'Connected to ' + r.fullName + ', but this token cannot publish (no write access).', r.canPush);
    }, function (e) { el.disabled = false; msg('conn-msg', e.message, false); });
  });
  M.action('unlock-settings', function () {
    if (modalEl.querySelector('#set-unlock').value === getPassword()) { settingsUnlocked = true; M.render(); }
    else modalEl.querySelector('#unlock-err').textContent = 'That password is not right.';
  });
  M.action('save-gh', function () {
    var user = modalEl.querySelector('#gh-user').value.trim(), repo = modalEl.querySelector('#gh-repo').value.trim();
    var token = modalEl.querySelector('#gh-token').value.trim() || (M.settings() || {}).token || '';
    if (!user || !repo || !token) { msg('gh-msg', 'Fill in the username, repository and token.', false); return; }
    Hub.store.set('pltfrm_gh', JSON.stringify({ username: user, repo: repo, token: token }));
    M.sha = {}; M.synced = false;
    msg('gh-msg', 'Saved for this browser. Reloading the latest files…', true);
    M.sync().then(function () { M.render(); });
  });
  M.action('clear-gh', function (el) {
    if (!M.confirmClick(el, 'Click again to switch')) return;
    Hub.store.remove('pltfrm_gh'); M.sha = {}; M.synced = false;
    M.sync().then(function () { M.render(); }); M.render();
  });
  M.action('copy-config', function () {
    var s = M.settings(); if (!s) return;
    var token = modalEl.querySelector('#gh-token') && modalEl.querySelector('#gh-token').value.trim() || s.token;
    var line = 'var GH_CONFIG = ' + JSON.stringify({ username: modalEl.querySelector('#gh-user').value.trim() || s.username, repo: modalEl.querySelector('#gh-repo').value.trim() || s.repo, filepath: 'index.html', token: encodeToken(token) }) + ';';
    Hub.copyText(line).then(function (ok) { msg('gh-msg', ok ? 'Copied. Paste it over the GH_CONFIG line in index.html.' : 'Your browser blocked copying.', ok); });
  });
  M.action('change-pw', function () {
    var cur = modalEl.querySelector('#pw-cur').value, n = modalEl.querySelector('#pw-new').value, c = modalEl.querySelector('#pw-confirm').value;
    if (cur !== getPassword()) { msg('pw-msg', 'The current password is not right.', false); return; }
    if (n.length < 4) { msg('pw-msg', 'Use at least 4 characters.', false); return; }
    if (n !== c) { msg('pw-msg', 'The two new passwords do not match.', false); return; }
    Hub.store.set('pltfrm_pw', n);
    ['pw-cur', 'pw-new', 'pw-confirm'].forEach(function (id) { modalEl.querySelector('#' + id).value = ''; });
    msg('pw-msg', 'Password changed for this browser.', true);
  });

  // ---------- start ----------
  function start() {
    var btn = document.getElementById('open-manager-btn');
    if (btn) btn.addEventListener('click', M.open);
  }
  if (document.readyState === 'complete') start(); else document.addEventListener('DOMContentLoaded', start);
})();
