/* PLTFRM Team Tools: Resources tab. SOPs, playbooks and other guides. */
(function () {
  'use strict';
  var Hub = window.Hub;
  Hub.registerTab({
    id: 'resources', target: 'resources', label: 'Resources', accent: 'var(--resource-color)',
    render: function (app) {
      Hub.renderCardTab(app, {
        tab: 'resources', target: 'resources', title: 'Resources',
        intro: 'SOPs, playbooks and guides. Links open in SharePoint.',
        placeholder: 'Search resources',
        gridClass: 'resource-grid',
        cardHtml: function (it) {
          var host = Hub.hostOf(it.url);
          return '<a class="resource-card" href="' + Hub.esc(it.url) + '" target="_blank" rel="noopener" data-id="' + Hub.esc(it.id) + '">' +
            '<div class="resource-title">' + Hub.esc(it.name) + Hub.icon('external') + '</div>' +
            (host ? '<div class="resource-host">' + Hub.esc(host) + '</div>' : '') +
            (it.desc ? '<div class="resource-desc">' + Hub.esc(it.desc) + '</div>' : '') +
            '</a>';
        }
      });
    }
  });
})();
