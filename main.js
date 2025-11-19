document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const body = document.body;
  const navbar = document.querySelector('.navbar');
  const root = document.documentElement;
  const navbarLogo = document.getElementById('navbar-logo');
  const heroLogo = document.getElementById('hero-logo');
  const footerLogo = document.getElementById('footer-logo');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  // --- Theme Toggle ---
  const updateThemeIcon = () => {
    if (body.classList.contains('light-mode')) {
      themeIcon.classList.replace('bi-sun', 'bi-moon');
      themeIcon.style.color = '#000';
    } else {
      themeIcon.classList.replace('bi-moon', 'bi-sun');
      themeIcon.style.color = '#fff';
    }
  };

  const updateLogo = () => {
    const light = 'assets/wabog_name_logo_light.webp';
    const dark = 'assets/wabog_name_logo.webp';
    const src = body.classList.contains('light-mode') ? light : dark;
    
    if (navbarLogo) navbarLogo.src = src;
    if (heroLogo) heroLogo.src = src;
    if (footerLogo) footerLogo.src = src;
  };

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('light-mode');
      updateThemeIcon();
      updateLogo();
      updateNavbarHeight();
      syncScrollState();
    });
  }

  // --- Navbar & Scroll ---
  const updateNavbarHeight = () => {
    if (!navbar) return;
    const navHeight = navbar.getBoundingClientRect().height;
    root.style.setProperty('--navbar-height', `${navHeight}px`);
  };

  const syncScrollState = () => {
    updateNavbarHeight();
    const isScrolled = window.scrollY > 10;
    if (navbar) navbar.classList.toggle('scrolled', isScrolled);
    if (mobileMenu) mobileMenu.classList.toggle('scrolled', isScrolled);
  };

  window.addEventListener('scroll', syncScrollState);
  window.addEventListener('resize', updateNavbarHeight);

  // --- Mobile Menu ---
  if (mobileMenuToggle && mobileMenu) {
    const mobileMenuIcon = mobileMenuToggle.querySelector('span');
    const setMenuIcon = (isOpen) => {
      if (!mobileMenuIcon) return;
      mobileMenuIcon.classList.remove(isOpen ? 'bi-list' : 'bi-x');
      mobileMenuIcon.classList.add(isOpen ? 'bi-x' : 'bi-list');
    };

    const closeMenu = () => {
      mobileMenu.classList.remove('open');
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
      setMenuIcon(false);
    };

    mobileMenuToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = mobileMenu.classList.toggle('open');
      mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
      setMenuIcon(isOpen);
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', (event) => {
      if (!mobileMenu.contains(event.target) && !mobileMenuToggle.contains(event.target)) {
        closeMenu();
      }
    });
  }

  // --- Initialization ---
  updateThemeIcon();
  updateLogo();
  updateNavbarHeight();
  syncScrollState();
});
