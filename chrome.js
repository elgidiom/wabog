/* Header compartido: píldora de vidrio al hacer scroll y menú Recursos. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  /* ---------- Header: píldora de vidrio al hacer scroll + menú Recursos ---------- */
  const nav = $('.lp-nav');
  if (nav) {
    const sync = () => nav.classList.toggle('is-scrolled', window.scrollY > 10);
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }
  const dd = $('#resources-dd');
  const ddBtn = $('#resources-toggle');
  const ddMenu = $('#resources-menu');
  if (dd && ddBtn && ddMenu) {
    let closeTimer = 0;
    const setOpen = (open) => {
      clearTimeout(closeTimer);
      dd.dataset.open = String(open);
      ddBtn.setAttribute('aria-expanded', String(open));
    };
    const isOpen = () => dd.dataset.open === 'true';
    ddBtn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!isOpen()); });
    // En escritorio también abre al pasar el cursor, con una pequeña tolerancia al salir.
    const hoverable = window.matchMedia('(hover: hover)').matches;
    if (hoverable) {
      dd.addEventListener('mouseenter', () => setOpen(true));
      dd.addEventListener('mouseleave', () => { closeTimer = setTimeout(() => setOpen(false), 160); });
    }
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); ddBtn.focus(); } });
    window.addEventListener('scroll', () => { if (isOpen()) setOpen(false); }, { passive: true });
  }
})();
