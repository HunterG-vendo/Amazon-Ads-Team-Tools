/* PLTFRM Team Tools: Home page. The manager's featured picks, what you opened recently, and the four sections. */
(function () {
  'use strict';
  var Hub = window.Hub;

  var SECTIONS = [
    { route: 'amc', target: 'amc-queries', label: 'AMC Queries', noun: ['query', 'queries'], desc: 'Ready-to-run AMC SQL, each with an analyzer for the results.' },
    { route: 'apps', target: 'apps', label: 'Apps', noun: ['app', 'apps'], desc: 'Browser tools built by the team.' },
    { route: 'skills', target: 'skills', label: 'Skills', noun: ['skill', 'skills'], desc: 'Claude skills to download and add to a project.' },
    { route: 'resources', target: 'resources', label: 'Resources', noun: ['resource', 'resources'], desc: 'SOPs, playbooks and guides.' }
  ];

  function featuredList() {
    var c = Hub.data.config;
    return c && Array.isArray(c.featured) ? c.featured : [];
  }
  // Resolve {target, id} pairs to items that still exist (removed items are skipped)
  function resolve(list, max) {
    var out = [];
    list.forEach(function (f) {
      if (out.length >= max || !f) return;
      var it = Hub.findItem(f.target, f.id);
      if (it) out.push({ target: f.target, item: it });
    });
    return out;
  }

  function kicker(target) {
    var icon = target === 'amc-queries' ? Hub.catIconSvg('bars', 'cat-icon') : '';
    return '<div class="card-kicker">' + icon + Hub.esc(Hub.TYPE_LABEL[target]) + '</div>';
  }
  function cardHtml(r, compact) {
    var it = r.item, t = r.target;
    var name = t === 'amc-queries' ? it.title : it.name;
    var desc = t === 'amc-queries' ? it.summary : it.desc;
    var body = kicker(t) +
      '<div class="card-top"><div class="card-name">' + Hub.esc(name) + '</div><span class="card-icon">' +
        Hub.icon(t === 'amc-queries' ? 'chevron' : t === 'skills' ? (it.skillData ? 'download' : 'external') : 'external') + '</span></div>' +
      (!compact && desc ? '<div class="card-desc home-desc">' + Hub.esc(desc) + '</div>' : '') +
      (!compact && it.author ? '<div class="card-author">By <span>' + Hub.esc(it.author) + '</span></div>' : '');
    var cls = 'tool-card home-card' + (compact ? ' is-compact' : '');
    var data = ' data-target="' + t + '" data-id="' + Hub.esc(it.id) + '"';
    if (t === 'amc-queries') return '<a class="' + cls + '" href="#amc/' + encodeURIComponent(it.id) + '"' + data + '>' + body + '</a>';
    if (t === 'skills') return '<button class="' + cls + '" type="button"' + data + '>' + body + '</button>';
    return '<a class="' + cls + '" href="' + Hub.esc(it.url) + '" target="_blank" rel="noopener"' + data + '>' + body + '</a>';
  }

  function render(app) {
    var featured = resolve(featuredList(), 6);
    var recent = resolve(Hub.recentList(), 6);
    app.innerHTML =
      '<div class="tab-head"><h1>Team Tools</h1></div>' +
      '<section class="home-section"><div class="home-section-head"><h2>Featured</h2></div>' +
        (featured.length ? '<div class="card-grid" data-role="cards">' + featured.map(function (r) { return cardHtml(r, false); }).join('') + '</div>'
          : '<div class="state-msg" style="padding:24px 0">No featured tools yet. Managers can pick up to six in Manage Page, Home.</div>') +
      '</section>' +
      (recent.length ? '<section class="home-section"><div class="home-section-head"><h2>Recently opened</h2><span class="hint">On this browser</span></div>' +
        '<div class="resource-grid" data-role="cards">' + recent.map(function (r) { return cardHtml(r, true); }).join('') + '</div></section>' : '') +
      '<section class="home-section"><div class="home-section-head"><h2>Browse</h2></div><div class="browse-grid">' +
        SECTIONS.map(function (s) {
          var n = Hub.items(s.target).length;
          return '<a class="browse-card" href="#' + s.route + '"><div class="card-top"><div class="card-name">' + Hub.esc(s.label) + '</div><span class="card-icon">' + Hub.icon('chevron') + '</span></div>' +
            '<div class="card-desc">' + Hub.esc(s.desc) + '</div><div class="card-author">' + n + ' ' + (n === 1 ? s.noun[0] : s.noun[1]) + '</div></a>';
        }).join('') +
      '</div></section>';

    app.querySelectorAll('[data-role="cards"]').forEach(function (grid) {
      grid.addEventListener('click', function (e) {
        var el = e.target.closest('[data-target]'); if (!el) return;
        var t = el.getAttribute('data-target'), id = el.getAttribute('data-id');
        if (t === 'skills') { var it = Hub.findItem('skills', id); if (it) Hub.openSkill(it); return; }
        if (t !== 'amc-queries') Hub.noteOpened(t, id);   // queries are remembered when their page opens
      });
    });
  }

  Hub.registerTab({ id: 'home', label: 'Home', render: render });
})();
