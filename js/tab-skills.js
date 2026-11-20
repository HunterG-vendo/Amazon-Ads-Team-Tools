/* PLTFRM Team Tools: Skills tab. Claude .skill files the team can download. */
(function () {
  'use strict';
  var Hub = window.Hub;
  Hub.registerTab({
    id: 'skills', target: 'skills', label: 'Skills', accent: 'var(--skill-color)',
    render: function (app) {
      Hub.renderCardTab(app, {
        tab: 'skills', target: 'skills', title: 'Skills',
        intro: 'Claude skills you can download and add to a Claude project.',
        placeholder: 'Search skills',
        cardHtml: function (it) {
          return '<button class="tool-card" type="button" data-id="' + Hub.esc(it.id) + '">' +
            '<div class="card-top"><div class="card-name">' + Hub.esc(it.name) + '</div><span class="card-icon">' + Hub.icon(it.skillData ? 'download' : 'external') + '</span></div>' +
            (it.desc ? '<div class="card-desc">' + Hub.esc(it.desc) + '</div>' : '') +
            (it.author ? '<div class="card-author">By <span>' + Hub.esc(it.author) + '</span></div>' : '') +
            (it.tags && it.tags.length ? '<div class="card-foot">' + Hub.tagsHtml(it.tags) + '</div>' : '') +
            '</button>';
        },
        onClick: function (it) { Hub.openSkill(it); }
      });
    }
  });
})();
