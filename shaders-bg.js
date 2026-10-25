/* Fondos con shaders (WebGPU) para la landing.
   Si el navegador no soporta WebGPU, el usuario prefiere menos movimiento o la
   carga falla, no se descarga nada y queda el degradado CSS de `.shader-bg`. */

// Versión fija y un solo archivo (?bundle): el import dinámico no admite SRI,
// así que no usar rangos ni `latest`. Pesa ~720 KB comprimido: solo se pide
// cuando hay WebGPU y después de que la página cargó.
const SHADERS_URL = 'https://esm.sh/shaders@4.0.5/js?bundle&target=es2022';

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();

// Mezcla dos colores hex (t = peso de b): sirve para tonos más pálidos sin inventar hex nuevos.
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return '#' + h(r1 + (r2 - r1) * t) + h(g1 + (g2 - g1) * t) + h(b1 + (b2 - b1) * t);
};

const palette = () => ({
  primary100: token('--primary-100'),
  primary200: token('--primary-200'),
  primary300: token('--primary-300'),
  accent100: token('--accent-100'),
  accent200: token('--accent-200'),
  bg100: token('--bg-100'),
  bg200: token('--bg-200'),
});

// Cada preset devuelve el árbol de capas de `createShader`.
const PRESETS = {
  // Hero: malla clara de la paleta de marca (el texto es oscuro encima).
  hero: (c) => [
    {
      type: 'MeshGradient',
      props: {
        stops: [
          { color: c.bg100, position: 0 },
          { color: mix(c.primary300, c.bg100, 0.25), position: 0.4 },
          { color: mix(c.accent100, c.bg100, 0.78), position: 0.8 },
          { color: c.bg100, position: 1 },
        ],
        colorSpace: 'oklab',
        count: 4,
        smoothness: 2.8,
        swirl: 0.15,
        drift: 0.7,
        speed: 0.8,
      },
    },
    {
      type: 'CursorTrail',
      props: {
        colorA: mix(c.primary200, c.bg100, 0.5),
        colorB: mix(c.accent100, c.bg100, 0.5),
        radius: 1.2,
        length: 1.3,
        shrink: 0.6,
        softness: 0.7,
        opacity: 0.55,
      },
    },
  ],
  // Bloques azules con texto blanco: solo tonos profundos para mantener el contraste.
  cta: (c) => [
    {
      type: 'MeshGradient',
      props: {
        stops: [
          { color: c.accent200, position: 0 },
          { color: c.primary100, position: 0.5 },
          { color: c.primary200, position: 0.88 },
          { color: c.primary100, position: 1 },
        ],
        colorSpace: 'oklab',
        count: 5,
        smoothness: 2.6,
        swirl: 0.25,
        drift: 0.8,
        speed: 1.0,
      },
    },
  ],
  // Fondo muy tenue para la sección del agente (texto oscuro encima).
  soft: (c) => [
    {
      type: 'MeshGradient',
      props: {
        stops: [
          { color: c.bg200 || c.bg100, position: 0 },
          { color: c.primary300, position: 0.5 },
          { color: c.bg100, position: 1 },
        ],
        colorSpace: 'oklab',
        count: 4,
        smoothness: 2.8,
        swirl: 0.2,
        drift: 0.7,
        speed: 0.7,
      },
    },
  ],
  calc: (c) => [
    {
      type: 'MeshGradient',
      props: {
        stops: [
          { color: c.primary100, position: 0 },
          { color: c.accent200, position: 0.55 },
          { color: c.primary200, position: 0.95 },
        ],
        colorSpace: 'oklab',
        count: 4,
        smoothness: 2.6,
        swirl: 0.2,
        drift: 0.75,
        speed: 0.9,
      },
    },
  ],
};

async function webgpuAvailable() {
  if (!navigator.gpu) return false;
  try {
    return Boolean(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const targets = [...document.querySelectorAll('.shader-bg[data-shader]')];

async function start() {
  if (!targets.length || reducedMotion.matches || !(await webgpuAvailable())) return;

  // Esperar a que la página esté lista: los shaders no deben competir con el LCP.
  if (document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  }

  let lib;
  try {
    lib = await import(SHADERS_URL);
  } catch (err) {
    console.warn('[shaders-bg] no se pudo cargar la librería; se mantiene el fallback CSS', err);
    return;
  }

  const colors = palette();
  const live = new Map(); // elemento -> { canvas, instance }

  function unmount(el) {
    const entry = live.get(el);
    live.delete(el);
    el.classList.remove('is-live');
    if (!entry) return;
    entry.instance?.destroy();
    entry.canvas.remove();
  }

  async function mount(el) {
    if (live.has(el)) return;
    const build = PRESETS[el.dataset.shader];
    if (!build) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(canvas);
    live.set(el, { canvas, instance: null }); // reserva para no montar dos veces
    try {
      const instance = await lib.createShader(canvas, {
        components: build(colors),
        disableTelemetry: true, // no enviar datos de uso a shaders.com
      });
      if (instance.getFailureReason()) throw new Error(instance.getFailureReason());
      if (live.get(el)?.canvas === canvas) {
        live.get(el).instance = instance;
        el.classList.add('is-live'); // el canvas es transparente hasta su primer cuadro
      } else {
        instance.destroy(); // salió de pantalla mientras se inicializaba
      }
    } catch (err) {
      unmount(el);
      console.warn('[shaders-bg] fallo al montar', el.dataset.shader, err);
    }
  }

  // Montar solo lo que está cerca del viewport y liberar la GPU al salir.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) mount(entry.target);
        else unmount(entry.target);
      }
    },
    { rootMargin: '200px 0px' }
  );
  targets.forEach((el) => observer.observe(el));

  reducedMotion.addEventListener('change', (e) => {
    if (!e.matches) return;
    observer.disconnect();
    [...live.keys()].forEach(unmount);
  });
}

start();
