/* PLTFRM Team Tools: Apps tab. Browser tools that open in a new tab. */
(function () {
  'use strict';
  var Hub = window.Hub;
  Hub.registerTab({
    id: 'apps', target: 'apps', label: 'Apps', accent: 'var(--app-color)',
    render: function (app) {
      Hub.renderCardTab(app, {
        tab: 'apps', target: 'apps', title: 'Apps',
        intro: 'Browser tools built by the team. Each one opens in a new tab.',
        placeholder: 'Search apps',
        cardHtml: function (it) {
          return '<a class="tool-card" href="' + Hub.esc(it.url) + '" target="_blank" rel="noopener">' +
            '<div class="card-top"><div class="card-name">' + Hub.esc(it.name) + '</div><span class="card-icon">' + Hub.icon('external') + '</span></div>' +
            (it.desc ? '<div class="card-desc">' + Hub.esc(it.desc) + '</div>' : '') +
            (it.author ? '<div class="card-author">By <span>' + Hub.esc(it.author) + '</span></div>' : '') +
            (it.tags && it.tags.length ? '<div class="card-foot">' + Hub.tagsHtml(it.tags) + '</div>' : '') +
            '</a>';
        }
      });
    }
  });
})();
