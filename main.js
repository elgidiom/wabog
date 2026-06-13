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

  // --- Sync Process + Lead Modal ---
  const syncProcessForm = document.getElementById('sync-process-form');
  const radicadoInput = document.getElementById('radicado-input');
  const syncProcessSubmit = document.getElementById('sync-process-submit');
  const syncProcessError = document.getElementById('sync-process-error');

  const leadModal = document.getElementById('lead-modal');
  const leadModalBackdrop = document.getElementById('lead-modal-backdrop');
  const leadModalClose = document.getElementById('lead-modal-close');
  const leadForm = document.getElementById('lead-form');
  const leadPhoneInput = document.getElementById('lead-phone-input');
  const leadSubmit = document.getElementById('lead-submit');
  const leadFormError = document.getElementById('lead-form-error');
  const leadFormSuccess = document.getElementById('lead-form-success');
  const leadWebhookUrl = 'https://microsaas-n8n.zhmeru.easypanel.host/webhook/4e3308ce-e721-4b19-80ff-2dbcebad56f4';
  let selectedRadicado = '';

  const onlyDigits = (value) => (value || '').replace(/\D/g, '');
  const wait = (milliseconds) => new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

  const howWorksCircles = document.querySelectorAll('.how-works-circle');
  const activateStep = (stepIndex) => {
    howWorksCircles.forEach((circle, index) => {
      if (index === stepIndex) {
        circle.classList.add('circle-active');
      } else {
        circle.classList.remove('circle-active');
      }
    });
  };
  const deactivateAllSteps = () => {
    howWorksCircles.forEach(circle => circle.classList.remove('circle-active'));
  };

  const showTextMessage = (element, message) => {
    if (!element) return;
    if (!message) {
      element.textContent = '';
      element.hidden = true;
      return;
    }
    element.textContent = message;
    element.hidden = false;
  };

  const openLeadModal = () => {
    if (!leadModal || !leadModalBackdrop) return;
    leadModal.hidden = false;
    leadModalBackdrop.hidden = false;
    body.classList.add('modal-open');
    if (leadPhoneInput) leadPhoneInput.focus();
  };

  const closeLeadModal = () => {
    if (!leadModal || !leadModalBackdrop) return;
    leadModal.hidden = true;
    leadModalBackdrop.hidden = true;
    body.classList.remove('modal-open');
  };

  const resetLeadFormState = () => {
    if (leadForm) leadForm.reset();
    showTextMessage(leadFormError, '');
    showTextMessage(leadFormSuccess, '');
    if (leadSubmit) {
      leadSubmit.disabled = false;
      leadSubmit.textContent = 'Probar gratis en Whatsapp';
    }
    if (radicadoInput && radicadoInput.value.length > 0) {
      activateStep(0);
    } else {
      deactivateAllSteps();
    }
  };

  const sendLeadToWebhook = async ({ radicado, number }) => {
    const response = await fetch(leadWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ radicado, number })
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }
  };

  const validateRadicado = (value) => {
    if (!value) return 'Ingresa un número de radicado.';
    if (value.length !== 23) return 'El radicado debe tener exactamente 23 dígitos.';
    return '';
  };

  const validatePhone = (value) => {
    if (!value) return 'Ingresa tu número de celular.';
    if (value.length !== 10) return 'El número debe tener 10 dígitos.';
    return '';
  };

  if (radicadoInput) {
    radicadoInput.addEventListener('input', () => {
      radicadoInput.value = onlyDigits(radicadoInput.value).slice(0, 23);
      selectedRadicado = '';
      showTextMessage(syncProcessError, '');
      if (radicadoInput.value.length > 0) {
        activateStep(0);
      } else {
        deactivateAllSteps();
      }
    });
  }

  if (leadPhoneInput) {
    leadPhoneInput.addEventListener('input', () => {
      leadPhoneInput.value = onlyDigits(leadPhoneInput.value).slice(0, 10);
      showTextMessage(leadFormError, '');
      showTextMessage(leadFormSuccess, '');
    });
  }

  if (syncProcessForm && syncProcessSubmit && radicadoInput) {
    syncProcessForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const radicado = onlyDigits(radicadoInput.value);
      const validationMessage = validateRadicado(radicado);
      if (validationMessage) {
        showTextMessage(syncProcessError, validationMessage);
        return;
      }

      activateStep(1);
      syncProcessSubmit.disabled = true;
      syncProcessSubmit.textContent = 'Buscando...';
      showTextMessage(syncProcessError, '');

      await wait(600);

      activateStep(2);
      selectedRadicado = radicado;
      syncProcessSubmit.disabled = false;
      syncProcessSubmit.textContent = 'Sincronizar';
      openLeadModal();
      trackEvent('process_lookup_success', {
        radicado_length: String(radicado.length)
      });
    });
  }

  if (leadForm && leadPhoneInput && leadSubmit) {
    leadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const phone = onlyDigits(leadPhoneInput.value);
      if (!selectedRadicado) {
        showTextMessage(leadFormError, 'Primero sincroniza un radicado válido.');
        return;
      }

      const validationMessage = validatePhone(phone);
      if (validationMessage) {
        showTextMessage(leadFormError, validationMessage);
        return;
      }

      leadSubmit.disabled = true;
      leadSubmit.textContent = 'Activando...';
      showTextMessage(leadFormError, '');
      showTextMessage(leadFormSuccess, '');

      try {
        await sendLeadToWebhook({
          radicado: selectedRadicado,
          number: `57${phone}`
        });

        showTextMessage(leadFormSuccess, 'Listo. Te notificaremos en WhatsApp cuando haya novedades del proceso.');
        trackEvent('whatsapp_lead_captured', {
          phone_length: String(phone.length)
        });
        leadSubmit.disabled = false;
        leadSubmit.textContent = 'Probar gratis en Whatsapp';
      } catch (error) {
        // Keep the modal open so the user can retry immediately.
        console.error('Webhook request failed', error);
        leadSubmit.disabled = false;
        leadSubmit.textContent = 'Probar gratis en Whatsapp';
        showTextMessage(leadFormError, 'No pudimos registrar tu número. Inténtalo de nuevo.');
      }
    });
  }

  if (leadModalClose) {
    leadModalClose.addEventListener('click', () => {
      closeLeadModal();
      resetLeadFormState();
    });
  }

  if (leadModalBackdrop) {
    leadModalBackdrop.addEventListener('click', () => {
      closeLeadModal();
      resetLeadFormState();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !leadModal || leadModal.hidden) return;
    closeLeadModal();
    resetLeadFormState();
  });

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

  // --- Initialization ---
  updateThemeIcon();
  updateLogo();
  updateNavbarHeight();
  syncScrollState();
});
