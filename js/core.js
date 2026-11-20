/* PLTFRM Team Tools: core. Loads the data files, routes between tabs and holds shared helpers. */
(function () {
  'use strict';
  var V = window.HubValidate;

  var Hub = window.Hub = {
    data: {},          // target id -> file object ({ file, items, log, ... } or config)
    loadErrors: {},    // target id -> message
    loaded: false,
    preview: !!window.HUB_INLINE_DATA,
    tabs: {},          // route id -> tab definition
    TAB_ORDER: ['amc', 'apps', 'skills', 'resources'],   // header buttons; the home page is reached from the logo
    HOME: 'home',
    view: {},          // per-tab UI state (search, filters)
    route: { tab: 'amc', sub: '' },
    _handlers: {}
  };

  // ---------- events ----------
  Hub.on = function (evt, fn) { (Hub._handlers[evt] = Hub._handlers[evt] || []).push(fn); };
  Hub.emit = function (evt, arg) { (Hub._handlers[evt] || []).forEach(function (fn) { try { fn(arg); } catch (e) { console.error(e); } }); };

  // ---------- text helpers ----------
  Hub.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  Hub.inlineCode = function (s) { return Hub.esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); };
  Hub.paragraphs = function (text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + Hub.inlineCode(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  };
  // "Label: rest of line" -> bold label, as in the original library
  Hub.splitItem = function (s) {
    s = String(s || ''); var i = s.indexOf(': ');
    return i > 0 && i < 70 ? [s.slice(0, i), s.slice(i + 2)] : [s, ''];
  };
  Hub.listItemHtml = function (s) {
    var p = Hub.splitItem(s);
    return p[1] ? '<strong>' + Hub.inlineCode(p[0]) + ':</strong> ' + Hub.inlineCode(p[1]) : Hub.inlineCode(p[0]);
  };
  Hub.slug = function (s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  };
  Hub.uid = function (prefix) { return (prefix || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  Hub.fmtDate = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  Hub.fmtTime = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return Hub.fmtDate(iso) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };
  Hub.hostOf = function (url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  Hub.hexAlpha = function (hex, a) {
    var h = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return 'rgba(255,255,255,' + a + ')';
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  };
  Hub.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  // ---------- base64 that is safe for binary files and UTF-8 text ----------
  Hub.bytesToB64 = function (bytes) {
    var bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };
  Hub.b64ToBytes = function (b64) {
    var bin = atob(String(b64 || '').replace(/\s+/g, '')), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  Hub.utf8ToB64 = function (text) { return Hub.bytesToB64(new TextEncoder().encode(text)); };
  Hub.b64ToUtf8 = function (b64) { return new TextDecoder('utf-8').decode(Hub.b64ToBytes(b64)); };

  Hub.download = function (filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  };

  Hub.copyText = function (text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  };

  var toastTimer = null;
  Hub.toast = function (msg, isError) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.toggle('is-error', !!isError); el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, isError ? 6000 : 2800);
  };

  // ---------- browser storage ----------
  // Some viewers (sandboxed frames, strict privacy modes) block localStorage and throw on access.
  // Fall back to memory so the page keeps working; settings then last until the page closes.
  var memStore = {};
  Hub.store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return k in memStore ? memStore[k] : null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memStore[k] = String(v); } },
    remove: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* blocked */ } delete memStore[k]; }
  };

  // ---------- who is making changes ----------
  Hub.managerName = function () { return (Hub.store.get('pltfrm_manager_name') || '').trim(); };
  Hub.setManagerName = function (n) { n = String(n || '').trim(); if (n) Hub.store.set('pltfrm_manager_name', n); return n; };
  Hub.deviceTag = function () {
    var ua = navigator.userAgent || '', browser = 'Browser', os = '';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\//.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
    if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Mac OS X/.test(ua)) os = 'Mac';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Linux/.test(ua)) os = 'Linux';
    return os ? browser + ' on ' + os : browser;
  };

  // ---------- icons ----------
  Hub.icon = function (name) {
    var p = {
      search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
      external: '<path d="M7 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9"/><path d="M9.5 2.5h4v4M13.5 2.5L8 8"/>',
      download: '<path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5"/><path d="M2.5 13.5h11"/>',
      copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2"/>',
      chevron: '<path d="M6 3.5L10.5 8 6 12.5"/>',
      back: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
      close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
      check: '<path d="M3 8.5l3.2 3.2L13 5"/>',
      skill: '<path d="M8 1.8l1.5 4.7 4.7 1.5-4.7 1.5L8 14.2l-1.5-4.7L1.8 8l4.7-1.5z"/>',
      filter: '<path d="M2.5 4h11M4.5 8h7M6.5 12h3"/>'
    }[name] || '';
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };

  // ---------- AMC categories and their icons ----------
  // Line icons on a 24px grid. Categories store the icon id; unknown ids fall back to "tag".
  Hub.CAT_ICONS = {
    'people-plus': { label: 'New customers', body: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 19c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/><path d="M19 7v6M16 10h6"/>' },
    'path': { label: 'Path', body: '<circle cx="5" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="19" cy="8" r="2"/><path d="M6.4 7.6l4.4 8.6M13.3 16.4l4.6-6.6"/>' },
    'trend': { label: 'Trend', body: '<path d="M4 19h16"/><path d="M5 15l4.5-4.5 3.5 3L19 7"/><path d="M15 7h4v4"/>' },
    'list': { label: 'List', body: '<path d="M5 7h14M5 12h14M5 17h9"/>' },
    'tag': { label: 'Tag', body: '<path d="M4 12.5V5a1 1 0 011-1h7.5L20 11.5 12.5 19z"/><circle cx="8.5" cy="8.5" r="1.3"/>' },
    'bars': { label: 'Bar chart', body: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx=".6"/><rect x="10.5" y="6" width="3" height="11" rx=".6"/><rect x="15.5" y="9" width="3" height="8" rx=".6"/>' },
    'pie': { label: 'Share', body: '<path d="M12 3.5a8.5 8.5 0 108.5 8.5H12z"/><path d="M15 3.9a8.5 8.5 0 015.1 5.1H15z"/>' },
    'repeat': { label: 'Repeat', body: '<path d="M17 4l3 3-3 3"/><path d="M20 7H8a4 4 0 00-4 4v1"/><path d="M7 20l-3-3 3-3"/><path d="M4 17h12a4 4 0 004-4v-1"/>' },
    'clock': { label: 'Timing', body: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>' },
    'calendar': { label: 'Calendar', body: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>' },
    'cart': { label: 'Purchases', body: '<path d="M3.5 4.5h2.2l2.1 10h10.4l1.8-7H7"/><circle cx="9.5" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/>' },
    'dollar': { label: 'Revenue', body: '<path d="M12 3.5v17"/><path d="M16 7.5c-.8-1.3-2.2-2-4-2-2.4 0-4 1.2-4 3s1.6 2.6 4 3.2 4 1.4 4 3.3-1.6 3-4 3c-1.9 0-3.4-.8-4.2-2.2"/>' },
    'target': { label: 'Targeting', body: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>' },
    'funnel': { label: 'Funnel', body: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>' },
    'layers': { label: 'Layers', body: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>' },
    'search': { label: 'Search terms', body: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>' },
    'tv': { label: 'DSP and video', body: '<rect x="3.5" y="5" width="17" height="11.5" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>' },
    'star': { label: 'Highlights', body: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>' }
  };
  Hub.catIconSvg = function (iconId, cls) {
    var ic = Hub.CAT_ICONS[iconId] || Hub.CAT_ICONS.tag;
    return '<svg class="' + (cls || 'cat-icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic.body + '</svg>';
  };
  Hub.amcCategories = function () { var c = Hub.data.config; return c && Array.isArray(c.amcCategories) ? c.amcCategories : []; };
  Hub.categoryIcon = function (name) {
    var key = String(name || '').toLowerCase(), hit = null;
    Hub.amcCategories().forEach(function (c) { if (String(c.name).toLowerCase() === key) hit = c.icon; });
    return hit || (key === 'other' ? 'list' : 'tag');
  };

  // ---------- tags ----------
  Hub.tagList = function () { var c = Hub.data.config; return c && Array.isArray(c.tags) ? c.tags : []; };
  Hub.tagColor = function (name) {
    var key = String(name || '').toLowerCase(), hit = null;
    Hub.tagList().forEach(function (t) { if (String(t.name).toLowerCase() === key) hit = t.color; });
    return hit;
  };
  Hub.tagHtml = function (name) { return '<span class="tag">' + Hub.esc(name) + '</span>'; };
  Hub.tagsHtml = function (tags) {
    return Array.isArray(tags) && tags.length ? '<div class="tags">' + tags.map(Hub.tagHtml).join('') + '</div>' : '';
  };

  // ---------- finding items across tabs, and what this browser opened recently ----------
  Hub.TYPE_LABEL = { 'amc-queries': 'AMC Query', 'apps': 'App', 'skills': 'Skill', 'resources': 'Resource' };
  Hub.findItem = function (target, id) {
    return Hub.items(target).filter(function (x) { return String(x.id) === String(id); })[0] || null;
  };
  var RECENT_KEY = 'pltfrm_recent', RECENT_MAX = 12;
  Hub.noteOpened = function (target, id) {
    if (!target || !id) return;
    var list = Hub.recentList().filter(function (r) { return !(r.target === target && r.id === String(id)); });
    list.unshift({ target: target, id: String(id), at: Date.now() });
    Hub.store.set(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  };
  Hub.recentList = function () {
    try { var v = JSON.parse(Hub.store.get(RECENT_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  };

  // ---------- data ----------
  Hub.items = function (target) { var d = Hub.data[target]; return d && Array.isArray(d.items) ? d.items : []; };
  Hub.setData = function (target, obj) {
    Hub.data[target] = obj; delete Hub.loadErrors[target];
    Hub.renderNav(); Hub.render({ keepScroll: true }); Hub.updateFooter();
    Hub.emit('datachange', target);
  };

  function loadOne(target) {
    var t = V.TARGETS[target];
    if (Hub.preview) {
      var inl = window.HUB_INLINE_DATA[target];
      if (inl) { Hub.data[target] = inl; } else { Hub.loadErrors[target] = t.file + ' is not in this preview.'; }
      return Promise.resolve();
    }
    return fetch(t.path + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('the server answered ' + r.status + (r.status === 404 ? ' (file not found)' : ''));
        return r.text();
      })
      .then(function (text) {
        var p = V.parseJson(text);
        if (!p.ok) throw new Error('the file is not valid JSON. ' + p.error);
        var obj = p.value;
        if (t.kind === 'data' && (!obj || !Array.isArray(obj.items))) throw new Error('the file has no "items" list');
        if (t.kind === 'config' && (!obj || !Array.isArray(obj.tags))) throw new Error('the file has no "tags" list');
        Hub.data[target] = Hub.preferPending(target, obj);
      })
      .catch(function (e) {
        Hub.loadErrors[target] = 'Could not load ' + t.file + ': ' + (e && e.message || e) + '.';
        console.error(Hub.loadErrors[target]);
      });
  }
  // ---------- staying up to date ----------
  // GitHub Pages takes about a minute to rebuild after a publish. The person who published keeps a copy
  // of what they published (for 20 minutes) and sees it until the live file catches up, so a refresh
  // right after publishing never looks like the change was lost.
  var PENDING_MS = 20 * 60 * 1000;
  Hub.notePublished = function (target, obj) {
    var rec = { at: Date.now(), updatedAt: obj.updatedAt || '' }, json = JSON.stringify(obj);
    if (json.length < 2.5e6) rec.obj = obj;
    try { Hub.store.set('pltfrm_pending_' + target, JSON.stringify(rec)); } catch (e) { /* too large for storage */ }
  };
  Hub.preferPending = function (target, live) {
    var raw = Hub.store.get('pltfrm_pending_' + target); if (!raw) return live;
    var rec = null; try { rec = JSON.parse(raw); } catch (e) { rec = null; }
    if (!rec || Date.now() - rec.at > PENDING_MS || String(live && live.updatedAt || '') >= String(rec.updatedAt || '')) {
      Hub.store.remove('pltfrm_pending_' + target);   // the live site has caught up (or the note is old)
      return live;
    }
    return rec.obj || live;
  };
  function managerOpen() { return !!(Hub.manager && Hub.manager.isOpen && Hub.manager.isOpen()); }
  function busy() {
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && document.getElementById('app').contains(a)) return true;
    return !!document.querySelector('[data-role="filter-panel"]:not([hidden])');
  }
  // Re-reads every data file and updates the page in place when something changed.
  Hub.refreshData = function () {
    if (Hub.preview || !Hub.loaded) return Promise.resolve(false);
    if (managerOpen() || busy()) { Hub._refreshWaiting = true; return Promise.resolve(false); }
    Hub._refreshWaiting = false;
    var targets = ['config'].concat(V.DATA_TARGETS), changed = [];
    return Promise.all(targets.map(function (t) {
      return fetch(V.TARGETS[t].path + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : null; }).then(function (text) {
        if (!text) return;
        var p = V.parseJson(text); if (!p.ok) return;
        var obj = Hub.preferPending(t, p.value);
        if (JSON.stringify(obj) !== JSON.stringify(Hub.data[t])) { Hub.data[t] = obj; delete Hub.loadErrors[t]; changed.push(t); }
      }).catch(function () { /* offline for a moment: try again next time */ });
    })).then(function () {
      if (!changed.length || managerOpen()) return false;
      Hub.renderNav(); Hub.render({ keepScroll: true }); Hub.updateFooter();
      changed.forEach(function (t) { Hub.emit('datachange', t); });
      Hub.toast('Updated with the latest changes');
      return true;
    });
  };
  // Detects a new version of the site code (index.html carries HUB_BUILD) and offers a refresh.
  Hub.checkCode = function () {
    if (Hub.preview || !window.HUB_BUILD) return Promise.resolve(false);
    return fetch('index.html?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var m = html.match(/var HUB_BUILD = '([^']+)'/);
      if (!m || m[1] === window.HUB_BUILD) return false;
      Hub.codeUpdated = true;
      var bar = document.getElementById('update-bar'); if (bar) bar.hidden = false;
      return true;
    }).catch(function () { return false; });
  };
  var lastCheck = 0;
  function checkNow(force) {
    if (document.visibilityState === 'hidden') return;
    if (!force && Date.now() - lastCheck < 20000) return;
    lastCheck = Date.now();
    Hub.refreshData(); Hub.checkCode();
  }
  Hub.startFreshness = function () {
    if (Hub.preview) return;
    setInterval(function () { checkNow(true); }, 90000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      // Coming back to a page that has newer code: reload it, unless Manage Page is open
      if (Hub.codeUpdated && !managerOpen()) { location.reload(); return; }
      checkNow(false);
    });
    window.addEventListener('focus', function () { checkNow(false); });
    // A refresh skipped while you were typing or had a menu open runs as soon as you are done
    document.addEventListener('focusout', function () { if (Hub._refreshWaiting) setTimeout(function () { Hub.refreshData(); }, 300); });
    Hub.on('managerclosed', function () { if (Hub._refreshWaiting) Hub.refreshData(); });
  };

  Hub.load = function () {
    var targets = ['config'].concat(V.DATA_TARGETS);
    return Promise.all(targets.map(loadOne)).then(function () { Hub.loaded = true; });
  };
  Hub.latestUpdate = function () {
    var best = '';
    Object.keys(Hub.data).forEach(function (k) { var u = Hub.data[k] && Hub.data[k].updatedAt; if (u && u > best) best = u; });
    return best;
  };
  Hub.updateFooter = function () {
    var el = document.getElementById('footer-updated'); if (!el) return;
    var u = Hub.latestUpdate(); el.textContent = u ? 'Last updated ' + Hub.fmtDate(u) : '';
  };

  // ---------- tabs and routing ----------
  Hub.registerTab = function (def) { Hub.tabs[def.id] = def; };
  // The current route lives in memory and is mirrored to the address bar when the browser allows it.
  // Sandboxed viewers block following "#" links, so internal links are handled here instead.
  Hub._hash = null;
  Hub.currentHash = function () {
    if (Hub._hash !== null) return Hub._hash;
    try { return location.hash || ''; } catch (e) { return ''; }
  };
  Hub.parseHash = function () {
    var h = Hub.currentHash().replace(/^#\/?/, '');
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    var parts = h.split('/'), tab = parts[0], sub = parts.slice(1).join('/');
    if (!Hub.tabs[tab]) { tab = Hub.HOME; sub = ''; }
    return { tab: tab, sub: sub };
  };
  Hub.go = function (hash) {
    hash = hash.charAt(0) === '#' ? hash : '#' + hash;
    Hub._hash = hash;
    try { if (location.hash !== hash) history.pushState(null, '', hash); } catch (e) { /* address bar not available here */ }
    Hub.render();
  };
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.target === '_blank') return;
    e.preventDefault();
    Hub.go(a.getAttribute('href'));
  });

  Hub.renderNav = function () {
    var nav = document.getElementById('site-tabs'); if (!nav) return;
    nav.innerHTML = Hub.TAB_ORDER.filter(function (id) { return Hub.tabs[id]; }).map(function (id) {
      var t = Hub.tabs[id];
      var cur = Hub.route.tab === id ? ' aria-current="page"' : '';
      return '<a class="site-tab" href="#' + id + '"' + cur + '>' + Hub.esc(t.label) + '</a>';
    }).join('');
  };

  Hub.render = function (opts) {
    opts = opts || {};
    var prev = Hub.route;
    Hub.route = Hub.parseHash();
    Hub.renderNav();
    var app = document.getElementById('app'); if (!app) return;
    if (!Hub.loaded) { app.innerHTML = '<div class="state-msg">Loading tools…</div>'; return; }
    var tab = Hub.tabs[Hub.route.tab];
    app.className = 'page tab-' + tab.id;
    document.title = tab.id === Hub.HOME ? 'PLTFRM Team Tools' : tab.label + ' | PLTFRM Team Tools';
    if (Hub.loadErrors[tab.target]) {
      app.innerHTML = '<div class="tab-head"><h1>' + Hub.esc(tab.label) + '</h1></div><div class="state-msg"><strong>This tab could not load.</strong><br>' +
        Hub.esc(Hub.loadErrors[tab.target]) + '<br>Refresh the page. If it keeps happening, a manager can re-upload the file from Manage Page, Upload.</div>';
    } else {
      try { tab.render(app, Hub.route.sub); }
      catch (e) {
        console.error(e);
        app.innerHTML = '<div class="state-msg"><strong>Something went wrong showing this tab.</strong><br>' + Hub.esc(e.message) + '</div>';
      }
    }
    var moved = prev.tab !== Hub.route.tab || prev.sub !== Hub.route.sub;
    if (moved && !opts.keepScroll) window.scrollTo(0, 0);
  };

  // ---------- Filters dropdown (shared by every tab) ----------
  // groups: [{ key, label, mode: 'any' | 'all', options: [{ value, count }] }]
  // sel: { key: [selected values] } kept in the tab's view state so choices survive re-renders.
  Hub.filterCount = function (sel) { var n = 0; Object.keys(sel || {}).forEach(function (k) { n += sel[k].length; }); return n; };
  // One dropdown button per group (e.g. "Categories" and "Tags"), each with its own panel.
  Hub.filterHtml = function (groups, sel) {
    return groups.filter(function (g) { return g.options.length; }).map(function (g) {
      var picked = sel[g.key] || [], n = picked.length;
      return '<div class="filter-wrap" data-role="filter" data-group="' + Hub.esc(g.key) + '">' +
        '<button class="filter-btn' + (n ? ' is-active' : '') + '" type="button" data-role="filter-toggle" data-filter="' + Hub.esc(g.key) + '" aria-expanded="false" aria-haspopup="true">' +
          Hub.esc(g.label) + (n ? '<span class="filter-n">' + n + '</span>' : '') + Hub.icon('chevron').replace('<svg', '<svg class="filter-caret"') + '</button>' +
        '<div class="filter-panel" data-role="filter-panel" hidden>' +
          (g.hint ? '<div class="filter-hint">' + Hub.esc(g.hint) + '</div>' : '') +
          g.options.map(function (o) {
            return '<button class="filter-option" type="button" role="menuitemcheckbox" data-group="' + Hub.esc(g.key) + '" data-value="' + Hub.esc(o.value) + '" aria-checked="' + (picked.indexOf(o.value) !== -1) + '">' +
              '<span class="check">' + Hub.icon('check') + '</span><span class="label">' + Hub.esc(o.value) + '</span><span class="n">' + o.count + '</span></button>';
          }).join('') +
          '<div class="filter-foot"><button class="btn btn-secondary btn-small" type="button" data-role="filter-clear"' + (n ? '' : ' disabled') + '>Clear</button>' +
          '<button class="btn btn-primary btn-small" type="button" data-role="filter-done">Done</button></div>' +
        '</div></div>';
    }).join('');
  };
  // Wires every dropdown inside `root`. onChange() redraws results; button labels update here.
  Hub.wireFilter = function (root, groups, sel, onChange) {
    var wraps = root.querySelectorAll('[data-role="filter"]');
    wraps.forEach(function (wrap) {
      var key = wrap.getAttribute('data-group');
      var g = groups.filter(function (x) { return x.key === key; })[0]; if (!g) return;
      var btn = wrap.querySelector('[data-role="filter-toggle"]'), panel = wrap.querySelector('[data-role="filter-panel"]');
      function setOpen(open) {
        if (open) wraps.forEach(function (w) { if (w !== wrap) { var p = w.querySelector('[data-role="filter-panel"]'); p.hidden = true; w.querySelector('[data-role="filter-toggle"]').setAttribute('aria-expanded', 'false'); } });
        panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
        if (!open) return;
        // Open toward whichever side has room so the panel never runs off the screen
        panel.style.left = '0'; panel.style.right = 'auto';
        var r = panel.getBoundingClientRect();
        if (r.right > window.innerWidth - 12) { panel.style.left = 'auto'; panel.style.right = '0'; }
      }
      function refresh() {
        var n = (sel[key] || []).length;
        btn.classList.toggle('is-active', n > 0);
        btn.innerHTML = Hub.esc(g.label) + (n ? '<span class="filter-n">' + n + '</span>' : '') + Hub.icon('chevron').replace('<svg', '<svg class="filter-caret"');
        wrap.querySelector('[data-role="filter-clear"]').disabled = !n;
      }
      btn.addEventListener('click', function () { setOpen(panel.hidden); });
      panel.addEventListener('click', function (e) {
        var opt = e.target.closest('.filter-option');
        if (opt) {
          var v = opt.getAttribute('data-value');
          var arr = sel[key] = sel[key] || [], i = arr.indexOf(v);
          if (i === -1) arr.push(v); else arr.splice(i, 1);
          opt.setAttribute('aria-checked', String(i === -1));
          refresh(); onChange(); return;
        }
        if (e.target.closest('[data-role="filter-clear"]')) {
          sel[key] = [];
          panel.querySelectorAll('.filter-option').forEach(function (o) { o.setAttribute('aria-checked', 'false'); });
          refresh(); onChange(); btn.focus(); return;
        }
        if (e.target.closest('[data-role="filter-done"]')) { setOpen(false); btn.focus(); }
      });
    });
  };
  // One listener closes any open filter panel when you click elsewhere on the page
  document.addEventListener('mousedown', function (e) {
    document.querySelectorAll('[data-role="filter"]').forEach(function (w) {
      if (!w.contains(e.target)) {
        var p = w.querySelector('[data-role="filter-panel"]');
        if (p && !p.hidden) { p.hidden = true; w.querySelector('[data-role="filter-toggle"]').setAttribute('aria-expanded', 'false'); }
      }
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('[data-role="filter-panel"]').forEach(function (p) {
      if (p.hidden) return;
      p.hidden = true;
      var b = p.parentNode.querySelector('[data-role="filter-toggle"]');
      b.setAttribute('aria-expanded', 'false'); b.focus();
    });
  });
  // Shared matching: 'any' groups need one of the picks, 'all' groups need every pick
  Hub.matchFilters = function (groups, sel, valuesFor) {
    return groups.every(function (g) {
      var picks = sel[g.key] || []; if (!picks.length) return true;
      var have = valuesFor(g.key);
      return g.mode === 'all' ? picks.every(function (p) { return have.indexOf(p) !== -1; }) : picks.some(function (p) { return have.indexOf(p) !== -1; });
    });
  };
  Hub.countValues = function (items, fn) {
    var counts = {}, order = [];
    items.forEach(function (it) { fn(it).forEach(function (v) { if (!(v in counts)) { counts[v] = 0; order.push(v); } counts[v]++; }); });
    return order.map(function (v) { return { value: v, count: counts[v] }; });
  };

  // ---------- shared card-tab renderer (Apps, Skills, Resources) ----------
  Hub.viewState = function (id) { return Hub.view[id] = Hub.view[id] || { q: '', sort: 'default', filters: { tags: [] } }; };

  // opts: { tab, target, title, intro, placeholder, cardHtml(item), gridClass, onClick(item, el) }
  Hub.renderCardTab = function (app, opts) {
    var st = Hub.viewState(opts.tab);
    var items = Hub.items(opts.target);
    var tagOpts = Hub.countValues(items, function (it) { return it.tags || []; });
    tagOpts.sort(function (a, b) { return a.value.localeCompare(b.value); });
    var groups = [{ key: 'tags', label: 'Tags', hint: 'Shows items that have every tag you pick', mode: 'all', options: tagOpts }];
    st.filters.tags = (st.filters.tags || []).filter(function (t) { return tagOpts.some(function (o) { return o.value === t; }); });

    app.innerHTML =
      '<div class="tab-head"><h1>' + Hub.esc(opts.title) + '</h1></div>' +
      '<div class="toolbar">' +
        '<label class="search-wrap">' + Hub.icon('search') + '<input class="search-input" type="search" data-role="q" placeholder="' + Hub.esc(opts.placeholder) + '" value="' + Hub.esc(st.q) + '" aria-label="Search"></label>' +
        Hub.filterHtml(groups, st.filters) +
        '<select class="select" data-role="sort" aria-label="Sort">' +
          [['default', 'Default order'], ['alpha', 'A to Z'], ['alpha-desc', 'Z to A'], ['author', 'By author']].map(function (o) {
            return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') +
        '</select><span class="result-count" data-role="count"></span>' +
      '</div>' +
      '<div class="' + (opts.gridClass || 'card-grid') + '" data-role="grid"></div>';

    var grid = app.querySelector('[data-role="grid"]');
    function draw() {
      var q = st.q.trim().toLowerCase();
      var list = items.filter(function (it) {
        if (!Hub.matchFilters(groups, st.filters, function () { return it.tags || []; })) return false;
        if (!q) return true;
        return [it.name, it.desc, it.author, (it.tags || []).join(' '), Hub.hostOf(it.url)].join(' ').toLowerCase().indexOf(q) !== -1;
      });
      if (st.sort === 'alpha') list.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      else if (st.sort === 'alpha-desc') list.sort(function (a, b) { return String(b.name).localeCompare(String(a.name)); });
      else if (st.sort === 'author') list.sort(function (a, b) { return String(a.author || '').localeCompare(String(b.author || '')); });
      app.querySelector('[data-role="count"]').textContent = list.length === items.length ? items.length + ' total' : list.length + ' of ' + items.length;
      if (!items.length) { grid.innerHTML = '<div class="state-msg">Nothing here yet. Managers can add ' + Hub.esc(opts.title.toLowerCase()) + ' from Manage Page.</div>'; return; }
      if (!list.length) { grid.innerHTML = '<div class="state-msg">No ' + Hub.esc(opts.title.toLowerCase()) + ' match. Clear the search or filters to see everything.</div>'; return; }
      grid.innerHTML = list.map(opts.cardHtml).join('');
    }
    app.querySelector('[data-role="q"]').addEventListener('input', function () { st.q = this.value; draw(); });
    app.querySelector('[data-role="sort"]').addEventListener('change', function () { st.sort = this.value; draw(); });
    Hub.wireFilter(app, groups, st.filters, draw);
    grid.addEventListener('click', function (e) {
      var el = e.target.closest('[data-id]'); if (el) Hub.noteOpened(opts.target, el.getAttribute('data-id'));
    });
    if (opts.onClick) grid.addEventListener('click', function (e) {
      var el = e.target.closest('[data-id]'); if (!el) return;
      var id = el.getAttribute('data-id');
      var it = items.filter(function (x) { return String(x.id) === id; })[0];
      if (it) opts.onClick(it, el);
    });
    draw();
  };

  // ---------- modal ----------
  var lastFocus = null;
  Hub.openModal = function (html, opts) {
    opts = opts || {};
    var root = document.getElementById('modal-root');
    lastFocus = document.activeElement;
    root.innerHTML = '<div class="overlay" data-role="overlay"><div class="modal' + (opts.className ? ' ' + opts.className : '') + '" role="dialog" aria-modal="true">' +
      '<button class="modal-close" type="button" data-role="close" aria-label="Close">' + Hub.icon('close') + '</button>' + html + '</div></div>';
    document.body.classList.add('no-scroll');
    var overlay = root.querySelector('[data-role="overlay"]');
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && !opts.sticky) Hub.closeModal(); });
    overlay.querySelectorAll('[data-role="close"]').forEach(function (b) { b.addEventListener('click', function () { Hub.closeModal(); }); });
    var focusEl = overlay.querySelector('[data-autofocus]') || overlay.querySelector('.modal button:not([data-role="close"]), .modal input');
    if (focusEl) setTimeout(function () { focusEl.focus(); }, 30);
    Hub._modalOnClose = opts.onClose || null;
    return overlay.querySelector('.modal');
  };
  Hub.closeModal = function () {
    if (Hub._modalBeforeClose && Hub._modalBeforeClose() === false) return;
    var root = document.getElementById('modal-root');
    root.innerHTML = ''; document.body.classList.remove('no-scroll');
    var cb = Hub._modalOnClose; Hub._modalOnClose = null; Hub._modalBeforeClose = null;
    if (cb) cb();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('modal-root').innerHTML) Hub.closeModal();
  });

  // ---------- skills: download the stored file byte for byte ----------
  Hub.skillFileName = function (item) {
    var n = V.normalizeFileName(item.skillFileName || '');
    return n || Hub.slug(item.name) + '.skill';
  };
  Hub.downloadSkill = function (item) {
    if (!item.skillData) return false;
    Hub.download(Hub.skillFileName(item), new Blob([Hub.b64ToBytes(item.skillData)], { type: 'application/zip' }));
    return true;
  };
  Hub.openSkill = function (item) {
    Hub.noteOpened('skills', item.id);
    var hasFile = !!item.skillData, link = V.isHttpUrl(item.url) ? item.url : '';
    var html =
      '<div class="modal-kicker">' + Hub.icon('skill').replace('<svg', '<svg width="13" height="13"') + 'Claude skill</div>' +
      '<h2>' + Hub.esc(item.name) + '</h2>' +
      (item.desc ? '<p class="lead">' + Hub.esc(item.desc) + '</p>' : '') +
      (item.author ? '<p class="meta">By <strong>' + Hub.esc(item.author) + '</strong></p>' : '') +
      '<ol class="steps">' +
        '<li>' + (hasFile ? 'Click <strong>Download skill file</strong> to save the <code>.skill</code> file.' : 'Click <strong>Open skill file</strong> to get the <code>.skill</code> file.') + '</li>' +
        '<li>Open Claude and go to your <strong>Projects</strong>.</li>' +
        '<li>Drag the file in, or use <strong>Add content</strong> to import it.</li>' +
        '<li>The skill is then available in that project.</li>' +
      '</ol>' +
      '<div class="modal-actions">' +
        (hasFile ? '<button class="btn btn-primary" type="button" data-role="dl">' + Hub.icon('download') + 'Download skill file</button>' : '') +
        (link ? '<a class="btn ' + (hasFile ? 'btn-secondary' : 'btn-primary') + '" href="' + Hub.esc(link) + '" target="_blank" rel="noopener">' + Hub.icon('external') + 'Open skill file</a>' : '') +
        (!hasFile && !link ? '<p class="note">This skill has no file or link yet. A manager can add one from Manage Page.</p>' : '') +
        '<button class="btn btn-secondary" type="button" data-role="close">Close</button>' +
      '</div>';
    var m = Hub.openModal(html);
    var dl = m.querySelector('[data-role="dl"]');
    if (dl) dl.addEventListener('click', function () { Hub.downloadSkill(item); Hub.toast('Downloaded ' + Hub.skillFileName(item)); });
  };

  // ---------- boot ----------
  // The old single-file site cached tools in the browser. That data is no longer used; clear it once.
  ['pltfrm_tools', 'pltfrm_cats', 'pltfrm_betas', 'pltfrm_updates', 'pltfrm_v'].forEach(function (k) { Hub.store.remove(k); });

  function boot() {
    if (Hub.preview) { var pn = document.getElementById('preview-note'); if (pn) pn.hidden = false; }
    Hub.route = Hub.parseHash();
    Hub.renderNav();
    Hub.load().then(function () {
      Hub.render();
      Hub.updateFooter();
      Hub.emit('loaded');
      Hub.startFreshness();
    });
    function fromAddressBar() { try { Hub._hash = location.hash || ''; } catch (e) { return; } Hub.render(); }
    window.addEventListener('hashchange', fromAddressBar);
    window.addEventListener('popstate', fromAddressBar);
  }
  // Wait for DOMContentLoaded: it fires only after every deferred tab script has registered.
  if (document.readyState === 'complete') setTimeout(boot, 0);
  else document.addEventListener('DOMContentLoaded', boot);
})();
