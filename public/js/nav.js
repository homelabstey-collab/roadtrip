// Barre de navigation commune (logo van) + page active.
(function () {
  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const links = [
    { href: '/', label: 'Accueil', match: ['/', ''] },
    { href: '/voyage', label: 'Le voyage', match: ['/voyage'] },
    { href: '/suivi', label: 'Suivi live', match: ['/suivi'] },
    { href: '/budget', label: 'Budget', match: ['/budget'] },
  ];
  const isActive = (m) => m.some((x) => x === path || (x !== '/' && path.startsWith(x)));
  const html = `
    <div class="nav-inner">
      <a class="nav-brand" href="/">
        <img class="van-logo" src="/images/van.png" alt="">
        <span>Pyrénées · Van 2026</span>
      </a>
      <nav class="nav-links">
        ${links.map((l) => `<a href="${l.href}" class="${isActive(l.match) ? 'active' : ''}">${l.label}</a>`).join('')}
      </nav>
    </div>`;
  const el = document.createElement('header');
  el.className = 'nav';
  el.innerHTML = html;
  document.body.insertBefore(el, document.body.firstChild);
})();
