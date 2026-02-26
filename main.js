document.addEventListener('DOMContentLoaded', () => {
  const analyticsMeasurementId = window.WABOG_GA_MEASUREMENT_ID || '';
  const hasValidGaId = /^G-[A-Z0-9]+$/i.test(analyticsMeasurementId) && analyticsMeasurementId !== 'G-XXXXXXXXXX';

  const loadGoogleAnalytics = (measurementId) => {
    if (!measurementId || window.gtag) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', measurementId);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  };

  const trackEvent = (eventName, params = {}) => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, params);
  };

  const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const inferSectionName = (element) => {
    const container = element.closest('section, nav, footer');
    if (!container) return 'unknown';
    if (container.id) return container.id;
    if (container.classList && container.classList.length) return container.classList[0];
    return container.tagName.toLowerCase();
  };

  const getElementLabel = (element) => {
    const datasetLabel = normalizeText(element.dataset.analytics);
    if (datasetLabel) return datasetLabel;

    const ariaLabel = normalizeText(element.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;

    if (element.tagName === 'A') {
      const title = normalizeText(element.getAttribute('title'));
      if (title) return title;
    }

    return normalizeText(element.textContent) || element.id || element.className || element.tagName.toLowerCase();
  };

  const initClickAnalytics = () => {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('a, button, [role="button"]');
      if (!target) return;

      const href = target.tagName === 'A' ? target.getAttribute('href') || '' : '';
      const isOutbound = Boolean(href && /^(https?:)?\/\//i.test(href) && !href.includes(window.location.hostname));
      const eventName = target.dataset.analyticsEvent || (target.className.includes('btn') ? 'button_click' : 'link_click');

      trackEvent(eventName, {
        label: getElementLabel(target),
        section: inferSectionName(target),
        location: target.dataset.analyticsLocation || 'landing',
        href,
        outbound: isOutbound ? 'true' : 'false'
      });
    });
  };

  const initScrollAnalytics = () => {
    const milestones = [25, 50, 75, 100];
    const sent = new Set();

    const onScroll = () => {
      const scrollTop = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const percent = Math.round((scrollTop / docHeight) * 100);
      milestones.forEach((milestone) => {
        if (percent >= milestone && !sent.has(milestone)) {
          sent.add(milestone);
          trackEvent('scroll_depth', { percent: String(milestone) });
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  const initSectionViewAnalytics = () => {
    if (!('IntersectionObserver' in window)) return;

    const observedSections = document.querySelectorAll('section[id], .hero, .impact-section, .app-preview-section');
    const seen = new Set();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.4) return;
        const section = entry.target;
        const sectionName = section.id || (section.classList && section.classList[0]) || section.tagName.toLowerCase();
        if (seen.has(sectionName)) return;
        seen.add(sectionName);
        trackEvent('section_view', { section: sectionName });
      });
    }, { threshold: [0.4] });

    observedSections.forEach((section) => observer.observe(section));
  };

  loadGoogleAnalytics(hasValidGaId ? analyticsMeasurementId : '');
  initClickAnalytics();
  initScrollAnalytics();
  initSectionViewAnalytics();

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
      trackEvent('theme_toggle', {
        mode: body.classList.contains('light-mode') ? 'light' : 'dark'
      });
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
      trackEvent('mobile_menu_toggle', { state: isOpen ? 'open' : 'close' });
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
