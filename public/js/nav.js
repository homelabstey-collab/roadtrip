// Barre de navigation commune (style "voyage" avec van) + page active.
(function () {
  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const links = [
    { href: '/', label: 'Accueil', match: ['/', ''] },
    { href: '/voyage', label: 'Le voyage', match: ['/voyage'] },
    { href: '/suivi', label: 'Suivi live', match: ['/suivi'] },
  ];
  const isActive = (m) => m.some((x) => x === path || (x !== '/' && path.startsWith(x)));

  // Petit van SVG (réutilisé sur la page suivi)
  const VAN = `<svg class="van-ico" viewBox="0 0 80 48" aria-hidden="true">
    <rect x="5" y="13" width="50" height="23" rx="5" fill="#2C6E94"/>
    <path d="M55 16 h9 l11 9 v11 h-20 z" fill="#3C5C47"/>
    <rect x="11" y="18" width="13" height="9" rx="2" fill="#cfe3ee"/>
    <rect x="28" y="18" width="13" height="9" rx="2" fill="#cfe3ee"/>
    <rect x="58" y="20" width="11" height="8" rx="2" fill="#cfe3ee"/>
    <rect x="5" y="30" width="50" height="3.5" fill="#BE3A2A"/>
    <circle cx="22" cy="38" r="6" fill="#212a20"/><circle cx="22" cy="38" r="2.4" fill="#cabfa6"/>
    <circle cx="60" cy="38" r="6" fill="#212a20"/><circle cx="60" cy="38" r="2.4" fill="#cabfa6"/>
  </svg>`;

  const html = `
    <div class="nav-inner">
      <a class="nav-brand" href="/">${VAN}<span>Pyrénées · Van 2026</span></a>
      <nav class="nav-links">
        ${links.map((l) => `<a href="${l.href}" class="${isActive(l.match) ? 'active' : ''}">${l.label}</a>`).join('')}
      </nav>
    </div>`;
  const el = document.createElement('header');
  el.className = 'nav';
  el.innerHTML = html;
  document.body.insertBefore(el, document.body.firstChild);
})();
