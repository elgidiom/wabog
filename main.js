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

  // --- Attribution (UTM y click IDs) ---
  const ATTRIBUTION_KEY = 'wabog_attribution';
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const CLICK_ID_KEYS = ['gclid', 'fbclid', 'ttclid', 'msclkid'];
  const APP_URL_PREFIX = 'https://app.wabog.com';

  // Los UTM se comparan entre sí en los reportes, así que se normalizan.
  // Los click IDs son opacos y sensibles a mayúsculas: solo se recortan.
  const normalizeUtm = (value) => normalizeText(value).toLowerCase().slice(0, 200);
  const normalizeClickId = (value) => normalizeText(value).slice(0, 500);

  const readAttribution = () => {
    try {
      const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  };

  const saveAttribution = (value) => {
    try {
      window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
    } catch (error) {
      // Modo privado o almacenamiento lleno: la atribución no persiste y el
      // registro se contará como directo. Nunca debe romper la navegación.
    }
  };

  const readTouchFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const touch = {};

    UTM_KEYS.forEach((key) => {
      const value = normalizeUtm(params.get(key));
      if (value) touch[key] = value;
    });

    CLICK_ID_KEYS.forEach((key) => {
      const value = normalizeClickId(params.get(key));
      if (value) touch[key] = value;
    });

    return Object.keys(touch).length ? touch : null;
  };

  const captureAttribution = () => {
    const stored = readAttribution() || {};
    const touch = readTouchFromUrl();
    const now = new Date().toISOString();

    // La primera visita siempre deja rastro, aunque sea tráfico directo:
    // landing y referrer son datos reales, no atribución inventada.
    if (!stored.first_seen_at) {
      stored.first_seen_at = now;
      stored.landing_url = window.location.pathname;
      stored.referrer = document.referrer || '';
    }

    // El first-touch se sella en la primera visita atribuible, no en la
    // primera visita a secas: una llegada directa no debe gastarlo.
    if (touch) {
      const currentTouch = Object.assign({ seen_at: now }, touch);
      if (!stored.first) stored.first = currentTouch;
      stored.latest = currentTouch;
    }

    saveAttribution(stored);
    return stored;
  };

  // app.wabog.com es otro origen y no comparte localStorage con la landing.
  // La querystring del enlace es el unico vehiculo que cruza al registro.
  const decorateAppLinks = (attribution) => {
    const first = attribution.first;
    if (!first) return;

    const latest = attribution.latest || first;
    const latestDiffers = ['utm_source', 'utm_medium', 'utm_campaign']
      .some((key) => (latest[key] || '') !== (first[key] || ''));

    document.querySelectorAll(`a[href^="${APP_URL_PREFIX}"]`).forEach((link) => {
      let url;
      try {
        url = new URL(link.getAttribute('href'), window.location.href);
      } catch (error) {
        return;
      }

      UTM_KEYS.concat(CLICK_ID_KEYS).forEach((key) => {
        if (first[key]) url.searchParams.set(key, first[key]);
      });

      url.searchParams.set('wbg_first_seen', first.seen_at || attribution.first_seen_at);
      if (attribution.landing_url) url.searchParams.set('wbg_landing', attribution.landing_url);

      if (latestDiffers) {
        ['utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => {
          if (latest[key]) url.searchParams.set(`wbg_latest_${key.replace('utm_', '')}`, latest[key]);
        });
      }

      link.setAttribute('href', url.toString());
    });
  };

  loadGoogleAnalytics(hasValidGaId ? analyticsMeasurementId : '');
  initClickAnalytics();
  decorateAppLinks(captureAttribution());
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
    if (!themeIcon) return;
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

  // --- CTA fijo (solo movil) ---
  // Se muestra cuando los botones del hero salen de pantalla. El CSS lo
  // mantiene oculto por encima de 768px, asi que el observer solo tiene
  // efecto visible en movil.
  const initStickyCta = () => {
    const stickyCta = document.getElementById('sticky-cta');
    const heroButtons = document.querySelector('.hero-buttons');
    if (!stickyCta || !heroButtons) return;

    if (!('IntersectionObserver' in window)) {
      stickyCta.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        stickyCta.classList.toggle('is-visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });

    observer.observe(heroButtons);
  };

  initStickyCta();

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

  // --- Consulta de radicado por WhatsApp ---
  const syncProcessForm = document.getElementById('sync-process-form');
  const radicadoInput = document.getElementById('radicado-input');
  const leadPhoneInput = document.getElementById('lead-phone-input');
  const syncProcessSubmit = document.getElementById('sync-process-submit');
  const syncProcessError = document.getElementById('sync-process-error');
  const syncProcessSuccess = document.getElementById('sync-process-success');
  const successRadicadoNumber = document.getElementById('success-radicado-number');
  const syncProcessWebsite = document.getElementById('sync-process-website');
  const checksUrl = window.WABOG_RADICADO_DEMO_URL || '';
  const onlyDigits = (value) => (value || '').replace(/\D/g, '');
  const howWorksCircles = document.querySelectorAll('.how-works-circle');

  const activateStep = (stepIndex) => {
    howWorksCircles.forEach((circle, index) => {
      circle.classList.toggle('circle-active', index === stepIndex);
    });
  };

  const showProcessError = (message) => {
    if (!syncProcessError) return;
    syncProcessError.textContent = message;
    syncProcessError.hidden = !message;
  };

  if (radicadoInput) {
    radicadoInput.addEventListener('input', () => {
      radicadoInput.value = onlyDigits(radicadoInput.value).slice(0, 23);
      showProcessError('');
      activateStep(radicadoInput.value ? 0 : -1);
    });
  }

  if (leadPhoneInput) {
    leadPhoneInput.addEventListener('input', () => {
      leadPhoneInput.value = onlyDigits(leadPhoneInput.value).slice(0, 10);
      showProcessError('');
    });
  }

  if (syncProcessForm && radicadoInput && leadPhoneInput && syncProcessSubmit) {
    syncProcessForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const radicado = onlyDigits(radicadoInput.value);
      const phone = onlyDigits(leadPhoneInput.value);
      if (radicado.length !== 23) {
        showProcessError('El radicado debe tener 23 dígitos.');
        return;
      }
      if (!/^3\d{9}$/.test(phone)) {
        showProcessError('Ingresa un celular colombiano de 10 dígitos.');
        return;
      }
      if (!checksUrl) {
        showProcessError('La consulta no está disponible en este momento. Inténtalo más tarde.');
        return;
      }
      syncProcessSubmit.disabled = true;
      syncProcessSubmit.textContent = 'Enviando solicitud...';
      showProcessError('');
      try {
        const response = await fetch(checksUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            radicado,
            phone,
            attribution: readAttribution() || {},
            website: syncProcessWebsite ? syncProcessWebsite.value : ''
          })
        });
        if (!response.ok) {
          if (response.status === 429) throw new Error('Has alcanzado el límite de consultas. Inténtalo más tarde.');
          if (response.status === 422) {
            const error = await response.json();
            if (error.detail === 'source_not_supported') {
              throw new Error('Este radicado administrativo aún no está disponible en la prueba rápida.');
            }
          }
          throw new Error('No pudimos recibir la consulta. Inténtalo de nuevo.');
        }
        const result = await response.json();
        if (result.accepted !== true) throw new Error('No pudimos recibir la consulta. Inténtalo de nuevo.');
        trackEvent('radicado_check_requested', { radicado_length: String(radicado.length) });
        syncProcessForm.hidden = true;
        if (successRadicadoNumber) successRadicadoNumber.textContent = radicado;
        if (syncProcessSuccess) syncProcessSuccess.hidden = false;
        activateStep(1);
      } catch (error) {
        showProcessError(error.message || 'No pudimos recibir la consulta. Inténtalo de nuevo.');
      } finally {
        syncProcessSubmit.disabled = false;
        syncProcessSubmit.textContent = 'Enviar resultado a WhatsApp';
      }
    });
  }

  // --- FAQ Accordion ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    
    if (question && answer) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        
        // Close all other FAQ items
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
            const otherBtn = otherItem.querySelector('.faq-question');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });
        
        // Toggle current FAQ item
        if (isOpen) {
          item.classList.remove('active');
          question.setAttribute('aria-expanded', 'false');
          trackEvent('faq_close', { question: question.textContent.trim() });
        } else {
          item.classList.add('active');
          question.setAttribute('aria-expanded', 'true');
          trackEvent('faq_open', { question: question.textContent.trim() });
        }
      });
    }
  });

  // --- Pricing Toggle ---
  const pricingToggle = document.getElementById('pricing-toggle');
  const btnMonthly = document.getElementById('btn-monthly');
  const btnAnnual = document.getElementById('btn-annual');
  const proPrice = document.getElementById('pro-price');
  const teamPrice = document.getElementById('team-price');

  if (pricingToggle && btnMonthly && btnAnnual && proPrice) {
    const setPrice = (priceEl, period) => {
      if (period === 'annual') {
        priceEl.textContent = '';
        priceEl.appendChild(document.createTextNode(`$${priceEl.dataset.annualTotal} `));
        const spanYear = document.createElement('span'); spanYear.className = 'text-sm'; spanYear.textContent = '/ Año'; priceEl.appendChild(spanYear);
        const divMonth = document.createElement('div'); divMonth.style.cssText = 'font-size:16px;font-weight:400;opacity:0.9;margin-top:4px'; divMonth.textContent = `($${priceEl.dataset.annual} / Mes)`; priceEl.appendChild(divMonth);
      } else {
        priceEl.textContent = '';
        priceEl.appendChild(document.createTextNode(`$${priceEl.dataset.monthly} `));
        const spanMonth = document.createElement('span'); spanMonth.className = 'text-sm'; spanMonth.textContent = '/ Mes'; priceEl.appendChild(spanMonth);
      }
    };

    const setPricing = (period) => {
      if (period === 'annual') {
        pricingToggle.classList.add('annual-active');
        btnAnnual.classList.add('active');
        btnMonthly.classList.remove('active');
        setPrice(proPrice, 'annual');
        if (teamPrice) setPrice(teamPrice, 'annual');
        trackEvent('billing_toggle_change', { period: 'annual' });
      } else {
        pricingToggle.classList.remove('annual-active');
        btnMonthly.classList.add('active');
        btnAnnual.classList.remove('active');
        setPrice(proPrice, 'monthly');
        if (teamPrice) setPrice(teamPrice, 'monthly');
        trackEvent('billing_toggle_change', { period: 'monthly' });
      }
    };

    btnMonthly.addEventListener('click', () => setPricing('monthly'));
    btnAnnual.addEventListener('click', () => setPricing('annual'));
  }

  // --- Initialization ---
  updateThemeIcon();
  updateLogo();
  updateNavbarHeight();
  syncScrollState();
});
