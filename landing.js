/* Interacciones propias del rediseño: calendario, menú Recursos,
   escala del dashboard, demo del agente y calculadora.
   La lógica de producción (analítica, UTM, probador de radicado, modal de
   lead, FAQ y precios) sigue en main.js. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

  /* ---------- Mini calendario (noviembre 2026) ---------- */
  const cal = $('#mini-cal');
  if (cal) {
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d) => {
      const el = document.createElement('div');
      el.className = 'dow';
      el.textContent = d;
      cal.appendChild(el);
    });
    for (let i = 0; i < 6; i++) cal.appendChild(document.createElement('div'));
    for (let d = 1; d <= 30; d++) {
      const el = document.createElement('div');
      el.className = 'day' + (d === 18 ? ' a' : d === 25 ? ' b' : '');
      el.textContent = String(d);
      if (d === 18 || d === 25) el.appendChild(document.createElement('i'));
      cal.appendChild(el);
    }
  }

  /* ---------- Escala del dashboard según el ancho de su columna ---------- */
  const wrap = $('#shot-wrap');
  const shot = $('#shot');
  if (wrap && shot) {
    const apply = () => {
      const s = wrap.clientWidth / 900;
      shot.style.transform = `scale(${s})`;
    };
    apply();
    if ('ResizeObserver' in window) new ResizeObserver(apply).observe(wrap);
    else window.addEventListener('resize', apply);
  }

  /* ---------- Demo de los agentes ---------- */
  const demo = $('#agent-demo');
  if (demo) {
    const TOTAL = 112;
    const ROWS = [
      { id: 'a1', found: 20, proc: 'Ejecutivo', rad: '2026-00418', juz: 'Juzgado 12 Civil',
        summary: 'Fija audiencia inicial para el 18 de noviembre, 9:00 a. m.',
        quote: 'Se fija el día dieciocho (18) de noviembre de dos mil veintiséis (2026), a las nueve de la mañana (9:00 a. m.), para llevar a cabo la audiencia inicial.',
        date: '10 de octubre', page: 2, action: 'agregar la audiencia a tu agenda' },
      { id: 'a2', found: 55, proc: 'Verbal', rad: '2025-01102', juz: 'Juzgado 3 Civil',
        summary: 'Corre traslado de las excepciones por 3 días',
        quote: 'Por secretaría córrase traslado a la parte demandante, por el término de tres (3) días, de las excepciones de mérito propuestas.',
        date: '10 de octubre', page: 1, action: 'agregar el término que vence el 16 de octubre' }
    ];
    const dot = $('#ag-dot'), text = $('#ag-text'), bar = $('#ag-bar');
    const count = $('#ag-count'), empty = $('#ag-empty'), cards = $('#ag-cards');
    let n = 0, timer = null;
    const decided = {};   // id -> 'ok' | 'no'
    const whyOpen = {};   // id -> boolean
    const shown = new Set();

    const mk = (tag, cls, txt) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (txt != null) el.textContent = txt;
      return el;
    };

    const renderCard = (r) => {
      let card = cards.querySelector(`[data-id="${r.id}"]`);
      const isNew = !card;
      if (isNew) { card = mk('div', 'ag-card'); card.dataset.id = r.id; }
      card.textContent = '';
      card.appendChild(mk('div', 'ag-meta', `${r.proc} · Rad. ${r.rad} · ${r.juz}`));
      card.appendChild(mk('div', 'ag-sum', r.summary));
      const act = mk('div', 'ag-act');
      act.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
      const span = document.createElement('span');
      span.appendChild(mk('strong', null, 'Qué harán:'));
      span.appendChild(document.createTextNode(' ' + r.action));
      act.appendChild(span);
      card.appendChild(act);

      const why = mk('button', 'ag-why', whyOpen[r.id] ? 'Ocultar de dónde salió' : '¿Por qué dice esto?');
      why.type = 'button';
      why.setAttribute('aria-expanded', String(!!whyOpen[r.id]));
      why.addEventListener('click', () => { whyOpen[r.id] = !whyOpen[r.id]; renderCard(r); });
      card.appendChild(why);

      if (whyOpen[r.id]) {
        const q = mk('div', 'ag-quote');
        q.appendChild(mk('p', null, `“${r.quote}”`));
        q.appendChild(mk('small', null, `Auto del ${r.date}, página ${r.page}`));
        card.appendChild(q);
      }

      const d = decided[r.id];
      if (!d) {
        const btns = mk('div', 'ag-btns');
        const ignore = mk('button', 'ag-btn ghost', 'Ignorar'); ignore.type = 'button';
        const ok = mk('button', 'ag-btn primary', 'Confirmar'); ok.type = 'button';
        ignore.addEventListener('click', () => { decided[r.id] = 'no'; renderCard(r); sync(); });
        ok.addEventListener('click', () => { decided[r.id] = 'ok'; renderCard(r); sync(); });
        btns.append(ignore, ok);
        card.appendChild(btns);
      } else {
        const done = mk('div', 'ag-done');
        done.style.color = d === 'no' ? '#6b7280' : '#15803d';
        done.appendChild(mk('i'));
        done.appendChild(document.createTextNode(d === 'no' ? 'Ignorado' : 'Agregado a tu agenda'));
        card.appendChild(done);
      }
      if (isNew) cards.prepend(card);
    };

    const sync = () => {
      const done = n >= TOTAL;
      dot.className = done ? 'done' : '';
      text.textContent = done
        ? 'Revisión de hoy completa · terminó a las 7:12 a. m.'
        : `Revisando ahora · proceso ${n} de ${TOTAL}`;
      bar.style.width = Math.round((n / TOTAL) * 100) + '%';
      ROWS.forEach((r) => { if (n >= r.found && !shown.has(r.id)) { shown.add(r.id); renderCard(r); } });
      const pending = ROWS.filter((r) => shown.has(r.id) && !decided[r.id]).length;
      count.hidden = pending === 0;
      count.textContent = String(pending);
      empty.hidden = shown.size > 0;
    };

    const tick = () => {
      if (n >= TOTAL) { clearInterval(timer); timer = null; }
      else { n = Math.min(TOTAL, n + 2); }
      sync();
    };

    const start = () => {
      clearInterval(timer);
      n = 0; shown.clear();
      Object.keys(decided).forEach((k) => delete decided[k]);
      Object.keys(whyOpen).forEach((k) => delete whyOpen[k]);
      cards.textContent = '';
      sync();
      if (reduced) { n = TOTAL; sync(); return; }
      timer = setInterval(tick, 120);
    };

    $('#ag-replay').addEventListener('click', start);
    sync();
    // Arranca cuando la tarjeta entra en pantalla.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
      }, { threshold: 0.35 });
      io.observe(demo);
    } else {
      start();
    }
  }

  /* ---------- Calculadora ---------- */
  const calcN = $('#calc-n'), calcM = $('#calc-m');
  if (calcN && calcM) {
    const outN = $('#calc-n-out'), outM = $('#calc-m-out');
    const hours = $('#calc-hours'), days = $('#calc-days'), plan = $('#calc-plan');
    let shownHours = null;
    let raf = 0;
    const tweenHours = (to, ms = 450) => {
      cancelAnimationFrame(raf);
      if (reduced || shownHours === null) { shownHours = to; hours.textContent = fmt(to); return; }
      const from = shownHours, t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        shownHours = from + (to - from) * e;
        hours.textContent = fmt(shownHours);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    window.__wabogCalcCountUp = () => { shownHours = 0; hours.textContent = '0'; tweenHours((Number(calcN.value) * Number(calcM.value) * 22) / 60, 1400); };
    const update = () => {
      const n = Number(calcN.value), m = Number(calcM.value);
      const h = (n * m * 22) / 60;
      outN.textContent = String(n);
      outM.textContent = m + ' min';
      tweenHours(h);
      days.textContent = `Son ${fmt(h / 8)} jornadas completas de 8 horas, cada mes.`;
      plan.textContent = n <= 50 ? 'Plan PRO · $55.000 / mes'
        : n <= 100 ? 'Plan TEAM · $110.000 / mes'
        : 'Plan ENTERPRISE · habla con ventas';
    };
    calcN.addEventListener('input', update);
    calcM.addEventListener('input', update);
    update();
  }

  /* ---------- Movimiento entre secciones ---------- */
  if (document.documentElement.classList.contains('js-motion')) {
    const root = document.documentElement;

    // Palabras: cada palabra de un título sube desde una máscara.
    const splitWords = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      let i = 0;
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.setAttribute('aria-hidden', 'true');
          const inner = document.createElement('i');
          inner.style.setProperty('--i', String(i++));
          inner.textContent = part;
          w.appendChild(inner);
          frag.appendChild(w);
        });
        node.parentNode.replaceChild(frag, node);
      });
      el.classList.add('words');
      // El texto original sigue disponible para lectores de pantalla.
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
        if (entry.target.id === 'calculadora' || entry.target.classList.contains('lp-calc-out')) {
          if (entry.target.classList.contains('lp-calc-out') && window.__wabogCalcCountUp) window.__wabogCalcCountUp();
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });

    const rv = (el, type = 'up', delay = 0) => {
      if (!el) return;
      el.setAttribute('data-rv', type);
      if (delay) el.style.setProperty('--d', delay + 's');
      io.observe(el);
    };
    const stagger = (list, type, step = 0.12, base = 0) => list.forEach((el, i) => rv(el, type, base + i * step));
    const all = (sel) => [...document.querySelectorAll(sel)];

    // Hero: entrada escalonada al cargar
    const h1 = $('.lp-hero h1');
    if (h1) { splitWords(h1); requestAnimationFrame(() => setTimeout(() => h1.classList.add('in'), 120)); }
    rv($('.lp-pill'), 'up', 0.1);
    rv($('.lp-hero-sub'), 'up', 0.55);
    rv($('.hero-buttons'), 'scale', 0.7);
    rv($('.lp-hero-note'), 'up', 0.9);

    // Títulos de sección
    all('.lp-h2').forEach((h) => { splitWords(h); io.observe(h); });
    all('.lp-section .lp-eyebrow').forEach((el) => rv(el, 'up', 0));
    all('.lp-section p.lp-sub').forEach((el) => rv(el, 'up', 0.25));

    // Paneles de fondo alterno
    all('.lp-section.alt').forEach((el) => io.observe(el));

    // Excel -> Wabog (coreografía)
    const compare = $('.lp-compare');
    if (compare) {
      all('.lp-compare .xl-row:not(.head)').forEach((el, i) => el.style.setProperty('--r', String(i)));
      $('.lp-compare .xl-row.head').style.setProperty('--r', '0');
      all('.lp-compare .shot .tr:not(.th)').forEach((el, i) => el.style.setProperty('--r', String(i)));
      all('.lp-compare .shot .pill').forEach((el, i) => el.style.setProperty('--r', String(i)));
      all('.lp-compare .lp-label').forEach((el, i) => rv(el, 'up', i * 1.1));
      const floats = all('.lp-compare .lp-float');
      floats.forEach((el, i) => rv(el, 'pop', i < 2 ? 1.6 + i * 0.3 : 2.9 + (i - 2) * 0.3));
      io.observe(compare);
      // Las cifras del dashboard cuentan hacia arriba cuando aparece
      const nums = all('.lp-compare .shot .sum b');
      const cio = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        cio.disconnect();
        nums.forEach((b) => {
          const to = Number(b.textContent), t0 = performance.now() + 1700;
          b.textContent = '0';
          const step = (now) => {
            if (now < t0) { requestAnimationFrame(step); return; }
            const k = Math.min(1, (now - t0) / 900);
            b.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      }, { threshold: 0.3 });
      cio.observe(compare);
    }

    // Agente
    stagger(all('.lp-agent-copy .lp-points li'), 'up', 0.14, 0.2);
    rv($('.lp-agent-copy > a'), 'up', 0.7);
    rv($('.lp-card-app'), 'right', 0.2);

    // Funciones: la tarjeta entra y dispara su propia animación interna
    all('.lp-feat').forEach((el, i) => rv(el, 'up', i * 0.15));
    all('#mini-cal .day').forEach((el, i) => el.style.setProperty('--i', String(i)));

    // Calculadora
    rv($('.lp-calc-in'), 'left', 0);
    rv($('.lp-calc-out'), 'right', 0.15);

    // Precios, FAQ y cierre (el pie queda estático, sin animaciones)
    rv($('.lp-pricing-toggle'), 'up', 0.35);
    all('.lp-plan').forEach((el, i) => rv(el, 'up', 0.1 + i * 0.16));
    rv($('.lp-faq-head'), 'left', 0);
    all('.faq-item').forEach((el, i) => rv(el, 'up', i * 0.09));
    rv($('.lp-cta'), 'scale', 0);

    // Hero: el contenido y el resplandor se mueven suave al hacer scroll
    const horizon = $('.lp-horizon');
    const heroBody = $('.lp-hero-body');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 1400);
        if (horizon) horizon.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0)`;
        if (heroBody) {
          heroBody.style.setProperty('--hy', (-y * 0.06).toFixed(1) + 'px');
          heroBody.style.setProperty('--ho', String(Math.max(0, 1 - y / 760)));
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
