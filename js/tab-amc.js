/* PLTFRM Team Tools: AMC Queries tab. A library of AMC SQL with instructions for each query. */
(function () {
  'use strict';
  var Hub = window.Hub;
  var OTHER = 'Other';

  // Category icons come from the category list in config.json (managed under Tags & Categories)
  function catIcon(label) { return Hub.catIconSvg(Hub.categoryIcon(label)); }
  function catOf(q) { var t = String(q.type || '').trim(); return t || OTHER; }

  // Categories in use, in the order of the managed category list; Other always last
  function categories(items) {
    var counts = {};
    items.forEach(function (q) { var c = catOf(q); counts[c] = (counts[c] || 0) + 1; });
    var order = Hub.amcCategories().map(function (c) { return String(c.name).toLowerCase(); });
    return Object.keys(counts).sort(function (a, b) {
      var ia = order.indexOf(a.toLowerCase()), ib = order.indexOf(b.toLowerCase());
      return (a === OTHER) - (b === OTHER) || (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || counts[b] - counts[a] || a.localeCompare(b);
    }).map(function (c) { return { label: c, count: counts[c] }; });
  }

  // SQL parts: multi-part queries use sqlParts; single queries use sql
  function sqlParts(q) {
    var ps = Array.isArray(q.sqlParts) ? q.sqlParts.filter(function (p) { return p && p.sql; }) : [];
    return ps.length ? ps : [{ sql: q.sql || '' }];
  }
  Hub.amcSqlParts = sqlParts;

  // SQL highlighting, matching the original library's keyword list
  var KW = 'WITH|AS|SELECT|FROM|WHERE|AND|OR|NOT|IS|NULL|IN|GROUP|BY|ORDER|PARTITION|OVER|CASE|WHEN|THEN|ELSE|END|SUM|COUNT|DISTINCT|ROUND|CAST|DOUBLE|NULLIF|RANK|DATE_TRUNC|DESC|ASC|TRUE|FALSE|VALUES|JOIN|LEFT|RIGHT|INNER|OUTER|ON|UNION|ALL|HAVING|LIMIT|MAX|MIN|AVG|COALESCE|INTERVAL|BETWEEN|LIKE|ROW_NUMBER|DENSE_RANK|LAG|LEAD|FIRST_VALUE|EXTRACT|SECONDS_BETWEEN|DAYS_BETWEEN';
  var RE = new RegExp("(--[^\\n]*)|('(?:[^']|'')*'?)|\\b(" + KW + ")\\b|\\b(\\d+(?:\\.\\d+)?)\\b", 'gi');
  function hl(line) {
    var out = '', last = 0, m; RE.lastIndex = 0;
    while ((m = RE.exec(line))) {
      out += Hub.esc(line.slice(last, m.index));
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
      out += '<span class="' + cls + '">' + Hub.esc(m[0]) + '</span>';
      last = m.index + m[0].length;
      if (m[0].length === 0) RE.lastIndex++;
    }
    return out + Hub.esc(line.slice(last));
  }
  function renderSql(sql) {
    return String(sql || '').replace(/\s+$/, '').split('\n').map(function (l) { return '<span class="ln">' + (hl(l) || ' ') + '</span>'; }).join('');
  }

  function searchText(q) {
    return [q.title, q.summary, q.description, q.type, q.author, (q.tags || []).join(' ')].join(' ').toLowerCase();
  }

  // ---------- list ----------
  function renderList(app) {
    var st = Hub.view.amc = Hub.view.amc || { q: '', filters: { cat: [], tags: [] }, part: {} };
    st.filters = st.filters || { cat: [], tags: [] };
    var items = Hub.items('amc-queries');
    var catOpts = categories(items).map(function (c) { return { value: c.label, count: c.count }; });
    var tagOpts = Hub.countValues(items, function (q) { return q.tags || []; });
    tagOpts.sort(function (a, b) { return a.value.localeCompare(b.value); });
    var groups = [
      { key: 'cat', label: 'Categories', mode: 'any', options: catOpts },
      { key: 'tags', label: 'Tags', hint: 'Shows queries that have every tag you pick', mode: 'all', options: tagOpts }
    ];
    ['cat', 'tags'].forEach(function (k, i) {
      var opts = i === 0 ? catOpts : tagOpts;
      st.filters[k] = (st.filters[k] || []).filter(function (v) { return opts.some(function (o) { return o.value === v; }); });
    });

    app.innerHTML =
      '<div class="tab-head"><h1>AMC Queries</h1></div>' +
      '<div class="toolbar"><label class="search-wrap">' + Hub.icon('search') +
        '<input class="search-input" type="search" data-role="q" placeholder="Search queries, tables or tags" value="' + Hub.esc(st.q) + '" aria-label="Search queries"></label>' +
        Hub.filterHtml(groups, st.filters) +
        '<span class="result-count" data-role="count"></span></div>' +
      '<div class="card-grid" data-role="grid"></div>';

    var grid = app.querySelector('[data-role="grid"]');
    function draw() {
      var q = st.q.trim().toLowerCase();
      var list = items.filter(function (it) {
        var ok = Hub.matchFilters(groups, st.filters, function (key) { return key === 'cat' ? [catOf(it)] : (it.tags || []); });
        return ok && (!q || searchText(it).indexOf(q) !== -1);
      });
      app.querySelector('[data-role="count"]').textContent = list.length === items.length ? items.length + ' total' : list.length + ' of ' + items.length;
      if (!items.length) { grid.innerHTML = '<div class="state-msg">No queries yet. Managers can add one from Manage Page.</div>'; return; }
      if (!list.length) { grid.innerHTML = '<div class="state-msg">No queries match. Try a table name like conversions_all, or clear the search and filters.</div>'; return; }
      grid.innerHTML = list.map(function (it) {
        var nParts = sqlParts(it).length;
        var meta = [it.author ? 'By <span>' + Hub.esc(it.author) + '</span>' : '', nParts > 1 ? '<span>' + nParts + ' queries</span>, run in order' : ''].filter(Boolean).join('<br>');
        return '<a class="tool-card amc-card" href="#amc/' + encodeURIComponent(it.id) + '">' +
          '<div class="card-kicker">' + catIcon(catOf(it)) + Hub.esc(catOf(it)) + '</div>' +
          '<div class="card-top"><div class="card-name">' + Hub.esc(it.title) + '</div><span class="card-icon">' + Hub.icon('chevron') + '</span></div>' +
          (it.summary ? '<div class="card-desc amc-card-desc">' + Hub.esc(it.summary) + '</div>' : '<div class="card-desc"></div>') +
          (meta ? '<div class="card-author">' + meta + '</div>' : '') +
          (it.tags && it.tags.length ? '<div class="card-foot">' + Hub.tagsHtml(it.tags) + '</div>' : '') +
          '</a>';
      }).join('');
    }
    app.querySelector('[data-role="q"]').addEventListener('input', function () { st.q = this.value; draw(); });
    Hub.wireFilter(app, groups, st.filters, draw);
    draw();
  }

  // ---------- detail ----------
  function renderDetail(app, id) {
    var st = Hub.view.amc = Hub.view.amc || { q: '', filters: { cat: [], tags: [] }, part: {} };
    st.part = st.part || {};
    var q = Hub.items('amc-queries').filter(function (x) { return String(x.id) === id; })[0];
    if (!q) {
      app.innerHTML = '<div class="amc-detail"><a class="back-link" href="#amc">' + Hub.icon('back') + 'All queries</a>' +
        '<div class="state-msg"><strong>That query is not in the library.</strong><br>It may have been removed or renamed. Go back to the list to find it.</div></div>';
      return;
    }
    document.title = q.title + ' | AMC Queries';
    Hub.noteOpened('amc-queries', q.id);
    var parts = sqlParts(q);
    var pi = Math.min(st.part[q.id] || 0, parts.length - 1);
    var cat = catOf(q);

    function list(arr, ordered) {
      if (!Array.isArray(arr) || !arr.length) return '';
      var tag = ordered ? 'ol' : 'ul';
      return '<' + tag + ' class="doc-list">' + arr.map(function (s) { return '<li>' + Hub.listItemHtml(s) + '</li>'; }).join('') + '</' + tag + '>';
    }
    function sqlSection() {
      var p = parts[pi], multi = parts.length > 1;
      return '<section class="doc-section" data-role="sql">' +
        '<div class="sql-head"><h2>' + (multi ? 'SQL (' + parts.length + ' queries, run in order)' : 'SQL') + '</h2>' +
        '<button class="btn btn-primary" type="button" data-role="copy">' + Hub.icon('copy') + (multi ? 'Copy query ' + (pi + 1) : 'Copy SQL') + '</button></div>' +
        (multi ? '<div class="part-tabs">' + parts.map(function (x, i) {
          return '<button class="filter-chip" type="button" data-part="' + i + '" aria-pressed="' + (i === pi) + '">' + Hub.esc(x.name || 'Query ' + (i + 1)) + '</button>';
        }).join('') + '</div>' : '') +
        (multi && (p.note || p.file) ? '<p class="part-note">' + (p.note ? Hub.inlineCode(p.note) : '') +
          (p.file ? (p.note ? ' ' : '') + 'Save the result as <span class="file">' + Hub.esc(p.file) + '</span>.' : '') + '</p>' : '') +
        '<pre class="sql-block" id="sql-pre"><code>' + renderSql(p.sql) + '</code></pre></section>';
    }
    function exampleTable() {
      var ex = q.example;
      if (!ex || !Array.isArray(ex.columns) || !ex.columns.length || !Array.isArray(ex.rows) || !ex.rows.length) return '';
      return '<section class="doc-section"><h2>Example output</h2><div class="table-wrap"><table class="data-table"><thead><tr>' +
        ex.columns.map(function (c) { return '<th>' + Hub.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        ex.rows.map(function (r) { return '<tr>' + ex.columns.map(function (_, i) { return '<td>' + Hub.esc(r[i] == null ? '' : r[i]) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div></section>';
    }

    app.innerHTML = '<article class="amc-detail">' +
      '<a class="back-link" href="#amc">' + Hub.icon('back') + 'All queries</a>' +
      '<header class="amc-detail-head">' +
        '<div class="amc-cat">' + catIcon(cat) + Hub.esc(cat) + '</div>' +
        '<h1>' + Hub.esc(q.title) + '</h1>' +
        (q.summary ? '<p class="amc-lead">' + Hub.inlineCode(q.summary) + '</p>' : '') +
        '<div class="amc-meta">' +
          (q.author ? '<span>By <strong>' + Hub.esc(q.author) + '</strong></span>' : '') +
          (q.updatedAt ? '<span>Updated <strong>' + Hub.fmtDate(q.updatedAt) + '</strong></span>' : '') +
        '</div>' + Hub.tagsHtml(q.tags) +
        '<div class="amc-head-actions"><button class="btn btn-secondary" type="button" data-role="jump">' + Hub.icon('chevron').replace('<svg', '<svg style="transform:rotate(90deg)"') +
          (parts.length > 1 ? 'Go to the ' + parts.length + ' queries' : 'Go to SQL') + '</button></div>' +
      '</header>' +
      (q.description ? '<section class="doc-section"><h2>What it does</h2><div class="prose">' + Hub.paragraphs(q.description) + '</div></section>' : '') +
      sqlSection() +
      (q.howTo && q.howTo.length ? '<section class="doc-section"><h2>How to run it</h2>' + list(q.howTo, true) + '</section>' : '') +
      '<section class="doc-section" data-role="analyze-section"><h2>Analyze the output</h2>' +
        '<p class="part-note">After running the query in AMC, upload the CSV or paste the results to get headline numbers, a chart and grouped tables, with PDF and Excel downloads.</p>' +
        '<div data-role="analyzer"></div></section>' +
      (q.requirements && q.requirements.length ? '<section class="doc-section"><h2>What it needs</h2>' + list(q.requirements) + '</section>' : '') +
      (q.useCases && q.useCases.length ? '<section class="doc-section"><h2>Use cases</h2>' + list(q.useCases) + '</section>' : '') +
      exampleTable() +
    '</article>';

    app.querySelector('[data-role="jump"]').addEventListener('click', function () {
      app.querySelector('[data-role="sql"]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (Hub.Analyzer) Hub.Analyzer.mount(app.querySelector('[data-role="analyzer"]'), q);
    var sqlEl = app.querySelector('[data-role="sql"]');
    sqlEl.addEventListener('click', function (e) {
      var pb = e.target.closest('[data-part]');
      if (pb) {
        st.part[q.id] = pi = +pb.getAttribute('data-part');
        var fresh = document.createElement('div'); fresh.innerHTML = sqlSection();
        sqlEl.innerHTML = fresh.firstChild.innerHTML;
        return;
      }
      if (e.target.closest('[data-role="copy"]')) {
        var p = parts[pi], btn = e.target.closest('[data-role="copy"]');
        Hub.copyText(p.sql || '').then(function (ok) {
          if (ok) {
            Hub.toast(parts.length > 1 ? 'Copied ' + (p.name || 'query ' + (pi + 1)) : 'SQL copied');
            btn.classList.add('is-done');
            setTimeout(function () { btn.classList.remove('is-done'); }, 1600);
          } else {
            var pre = document.getElementById('sql-pre'), r = document.createRange();
            r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
            Hub.toast('Your browser blocked copying. The SQL is selected; press Ctrl+C or Cmd+C.', true);
          }
        });
      }
    });
  }

  Hub.registerTab({
    id: 'amc', target: 'amc-queries', label: 'AMC Queries', accent: 'var(--amc-color)',
    render: function (app, sub) { if (sub) renderDetail(app, sub); else renderList(app); }
  });
})();
