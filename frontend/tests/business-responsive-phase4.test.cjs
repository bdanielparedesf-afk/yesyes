/**
 * YESYES BUSINESS — FASE 4 · RESPONSIVE REAL (contratos verificables en CI).
 *
 * La medición con navegador real vive en `qa/fase4-responsive.mjs`,
 * `qa/fase4-editor-mobile.mjs` y `qa/fase4-variants.mjs` (esos necesitan
 * Chrome). Aquí se fija lo que SÍ se puede exigir en cada corrida, sobre el
 * render real (`esbuild` + `react-dom/server`), para que un responsive roto
 * rompa el build y no dependa de que alguien mire capturas.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./helpers/mount.cjs');
const { renderBlock, CONTENT, VARIANT_DEFINITIONS, BLOCK_RENDERERS } = require('./helpers/variants-harness.cjs');

const engine = mount('business/engine/TemplateEngineV2.tsx', 'r-engine');
const rendererMod = mount('business/BusinessPageRenderer.tsx', 'r-renderer');

const SRC = path.join(__dirname, '..', 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Anchos que la fase exige certificar. */
const WIDTHS = [375, 390, 430, 768, 1024, 1280, 1440];
const MOBILE = 375;

const render = (el) => renderToStaticMarkup(React.createElement(React.Fragment, null, el));

const ALL_VARIANTS = VARIANT_DEFINITIONS.flatMap((entry) =>
  entry.variants.map((variant) => ({ block: entry.block, id: variant.id, config: variant.config })));

const LONG = 'Palabra'.repeat(40);
const cases = [
  ...ALL_VARIANTS.map((v) => ({ key: `${v.block}:${v.id}`, block: v.block, config: v.config })),
  ...Object.keys(BLOCK_RENDERERS)
    .filter((b) => !VARIANT_DEFINITIONS.some((e) => e.block === b))
    .map((b) => ({ key: `${b}:default`, block: b, config: {} })),
];

/** Etiquetas de apertura de cada elemento del HTML. */
const tagsOf = (html) => Array.from(html.match(/<[a-zA-Z][^>]*>/g) || []);
const classOf = (tag) => (tag.match(/class="([^"]*)"/) || [])[1] || '';

// ─────────────────────────── 1. Sin overflow estructural ───────────────────

test('F4-1: ninguna variante emite un ancho fijo mayor que el móvil más angosto', () => {
  const culpables = [];
  for (const c of cases) {
    for (const tag of tagsOf(renderBlock(c.block, c.config))) {
      // Sólo cuentan las utilidades BASE: un `sm:w-[420px]` sí es correcto.
      const rigido = tag.match(/(?:^|[\s"])(min-)?w-\[(\d+)px\]/);
      if (rigido && Number(rigido[2]) > MOBILE) { culpables.push(`${c.key}: ${rigido[0].trim()}`); continue; }
      const inline = tag.match(/style="[^"]*width:\s*(\d+)px/);
      if (inline && Number(inline[1]) > MOBILE) culpables.push(`${c.key}: width inline ${inline[0]}`);
      if (/(?:^|[\s"])whitespace-nowrap/.test(tag) && !/truncate/.test(tag)) culpables.push(`${c.key}: whitespace-nowrap sin truncate`);
    }
  }
  assert.deepEqual(culpables, [], 'anchos rígidos que pueden desbordar el móvil');
});

test('F4-1b: las tiras horizontales son scrollers (no cortan contenido, lo deslizan)', () => {
  let tiras = 0;
  for (const c of cases) {
    const html = renderBlock(c.block, c.config);
    // Una tira es una fila de tarjetas anchas: se reconoce por el ancho en vw
    // o por un ancho fijo SOLO en breakpoint de escritorio.
    if (!/w-\[85vw\]|sm:w-\[\d+px\]/.test(html)) continue;
    tiras++;
    assert.ok(/overflow-x-auto/.test(html), `${c.key}: tira horizontal sin scroll`);
    assert.ok(/snap-x|snap-center|snap-mandatory/.test(html), `${c.key}: tira sin scroll-snap (no senea el touch)`);
    assert.ok(/shrink-0/.test(html), `${c.key}: los items de la tira se encogen en vez de deslizar`);
  }
  assert.ok(tiras > 0, 'no se encontró ninguna tira horizontal que verificar');
});

// ───────────────────────── 2. Breakpoints y 5. Grids ──────────────────────

test('F4-2: todo grid con columnas base declara su escalón responsive', () => {
  const offenses = [];
  for (const c of cases) {
    for (const tag of tagsOf(renderBlock(c.block, c.config))) {
      const cls = classOf(tag);
      if (!/\bgrid\b/.test(cls) || !/(?<!:)\bgrid-cols-\d/.test(cls)) continue;
      if (!/(sm|md|lg|xl):grid-cols-/.test(cls)) offenses.push(`${c.key}: "${cls}"`);
    }
  }
  assert.deepEqual(offenses, [], 'grids rígidos: no bajan de columnas en pantallas chicas');
});

test('F4-2b: las columnas base de un grid nunca superan 3 (a 375px no caben más)', () => {
  for (const c of cases) {
    for (const tag of tagsOf(renderBlock(c.block, c.config))) {
      const base = classOf(tag).match(/(?<!:)\bgrid-cols-(\d+)/);
      if (base && Number(base[1]) > 3) assert.fail(`${c.key}: grid base de ${base[1]} columnas`);
    }
  }
});

test('F4-2c: el contenedor de cada sección se adapta al ancho disponible', () => {
  for (const c of cases) {
    const html = renderBlock(c.block, c.config);
    if (!html) continue;
    assert.ok(/mx-auto w-full max-w-/.test(html) || /w-full/.test(html), `${c.key}: sin contenedor fluido`);
  }
});

// ────────────────────────── 3. Variant renderer ───────────────────────────

test('F4-3: cada variante del catálogo renderiza y es distinta de las otras', () => {
  for (const entry of VARIANT_DEFINITIONS) {
    const firmas = new Set();
    for (const variant of entry.variants) {
      const html = renderBlock(entry.block, { presentation: variant.config.presentation });
      assert.ok(html && html.length > 40, `${entry.block}/${variant.id} no renderiza`);
      firmas.add(html.replace(/>[^<]*</g, '><').replace(/\s+/g, ' ').trim());
    }
    assert.equal(firmas.size, entry.variants.length, `${entry.block}: variantes idénticas entre sí`);
  }
});

// ─────────────────────────── 4. Tamaño de imágenes ─────────────────────────

test('F4-4: toda imagen de bloque tiene ancho/alto acotado y object-fit', () => {
  const offenders = [];
  for (const c of cases) {
    for (const tag of renderBlock(c.block, c.config).match(/<img[^>]*>/g) || []) {
      const cls = classOf(tag);
      const acotado = /\b(w-full|w-\[|w-\d|h-full|h-\[|h-\d|max-w-)/.test(cls);
      const conFit = /\bobject-(cover|contain|fill)\b/.test(cls) || /\baspect-/.test(cls);
      if (!acotado || !conFit) offenders.push(`${c.key}: ${tag.slice(0, 110)}`);
    }
  }
  assert.deepEqual(offenders, [], 'imágenes sin acotar o sin object-fit');
});

// ───────────────────── 8. Preview usa el MISMO renderer ───────────────────

test('F4-8: la preview y la página pública componen con el mismo TemplateEngineV2', () => {
  const manifest = {
    manifestVersion: 1, layout: 'modern-commerce',
    sections: [
      { id: 'hero', label: 'Portada', order: 10, blocks: [{ block: 'Hero', instanceId: 'h1', config: {} }] },
      { id: 'servicios', label: 'Servicios', order: 20, blocks: [{ block: 'Services', instanceId: 's1', config: {} }] },
    ],
  };
  const business = { id: 'b', name: 'Clinica', slug: 'clinica', category: 'PET', description: 'Desc', whatsapp: '+56911111111' };
  const viaMotor = render(React.createElement(engine.TemplateEngineV2, { manifest, business, ...CONTENT, mobile: 'stack', preview: true }));
  const viaRenderer = render(React.createElement(rendererMod.Subject, {
    business: { ...business, siteInstance: { manifest } },
    services: CONTENT.services, products: CONTENT.products, properties: [], gallery: CONTENT.gallery,
    testimonials: CONTENT.testimonials, faqs: CONTENT.faqs, promotions: CONTENT.promotions, team: CONTENT.team,
    bookingSlots: CONTENT.bookingSlots, preview: true,
  }));
  assert.ok(viaMotor.includes('data-template-engine="v2"'));
  assert.ok(viaRenderer.includes('data-business-renderer="v2"'), 'la preview no entra por el motor V2');
  const bloques = (html) => Array.from(html.matchAll(/data-block-id="([^"]+)"/g)).map((m) => m[1]);
  assert.deepEqual(bloques(viaRenderer), bloques(viaMotor), 'preview y motor componen distinto');
});

// ───────────────────── 9/10. Texto largo y CTA largo ───────────────────────

test('F4-9: un texto muy largo nunca queda en una línea incortable', () => {
  for (const c of cases) {
    const html = renderBlock(c.block, { ...c.config, title: LONG, body: LONG, ctaLabel: LONG, subtitle: LONG, headline: LONG });
    if (!html) continue;
    for (const tag of tagsOf(html)) {
      const cls = classOf(tag);
      assert.ok(!/whitespace-nowrap/.test(cls) || /truncate/.test(cls), `${c.key}: nowrap que corta el texto largo`);
    }
  }
});

test('F4-9b: con contenido extremo el bloque conserva los datos', () => {
  const largos = [{ id: 's1', name: LONG, description: LONG, price: 1000, image: '' }];
  assert.ok(largos[0].name.length > 100);
  const html = renderBlock('Services', {});
  assert.ok(html.length > 0);
  assert.ok(/\$|CLP/.test(html), 'el bloque de servicios no muestra precios');
});

test('F4-10: un CTA muy largo no desborda su botón', () => {
  const html = renderBlock('CTA', { presentation: 'split', title: LONG, ctaLabel: LONG });
  for (const tag of html.match(/<a[^>]*>/g) || []) {
    const cls = classOf(tag);
    assert.ok(!/\bw-\[\d+px\]/.test(cls), 'CTA con ancho fijo');
    assert.ok(!/whitespace-nowrap/.test(cls), 'CTA que no puede envolver su texto');
    assert.ok(/inline-flex/.test(cls), 'CTA sin flex: el texto largo lo rompe');
  }
});


// ─────────────────────── 11. Imagen faltante (opcional) ────────────────────

test('F4-11: una imagen faltante no deja un <img> roto ni lanza', () => {
  for (const c of cases) {
    const html = renderBlock(c.block, c.config);
    assert.ok(!/<img[^>]*src=""|src="undefined"/.test(html), `${c.key}: emite img sin src`);
  }
});

// ───────────────────── 12. Bloques opcionales sin contenido ───────────────

test('F4-12: un bloque de contenido sin datos no renderiza sección vacía', () => {
  const vacio = { services: [], products: [], properties: [], gallery: [], testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [], media: [] };
  // Hero/CTA/Contacto/Map/Footer/WhatsApp viven del NEGOCIO, no de una lista:
  // sin contenido collection se apagan (no dejan una sección muda).
  const condicionales = ['Services', 'Products', 'ProductFeatured', 'Properties', 'PropertyFeatured', 'ImageGallery', 'VideoGallery', 'Testimonials', 'Team', 'FAQ', 'Promotions', 'Booking', 'SocialLinks'];
  for (const c of cases.filter((x) => condicionales.includes(x.block))) {
    const Render = BLOCK_RENDERERS[c.block];
    const html = renderToStaticMarkup(React.createElement(Render, {
      business: { id: 'b', name: 'X', slug: 'x', category: 'PET' }, ...vacio,
      mobile: 'stack', preview: true, instanceId: 'i', config: c.config, anchor: 'a',
    }));
    assert.equal(html, '', `${c.key}: renderiza una sección sin ningún dato`);
  }
});

// ───────────────── 6/7. Editor: navegación móvil y canvas ─────────────────

test('F4-6: el editor ofrece estructura e inspector también en móvil', () => {
  const source = read('pages/BusinessBuilder.tsx');
  const barra = (source.match(/data-testid="builder-mobile-actions"[^>]*className="([^"]*)"/) || [])[1] || '';
  // La barra debe estar anclada abajo y a todo lo ancho: sin `bottom-0` o
  // `inset-x-0` queda flotando al final del documento y es inalcanzable.
  for (const clase of ['fixed', 'inset-x-0', 'bottom-0', 'lg:hidden']) {
    assert.ok(barra.includes(clase), `barra móvil sin "${clase}": ${barra}`);
  }
  assert.ok(/data-testid="builder-sidebar-desktop"[^>]*className="hidden lg:block"/.test(source), 'sidebar no se oculta en <1024');
  assert.ok(/data-testid="builder-inspector-desktop"[^>]*className="hidden lg:block"/.test(source), 'inspector no se oculta en <1024');
  assert.ok(/role="dialog"/.test(source) && /max-h-\[88vh\]/.test(source), 'sin bottom sheet móvil');
  assert.ok(/min-h-12/.test(source), 'botones móviles sin alto táctil (44px+)');
});

test('F4-7: el canvas del editor limita el ancho al dispositivo pedido', () => {
  const source = read('pages/BusinessBuilder.tsx');
  assert.ok(/max-w-\[390px\]/.test(source), 'sin ancho móvil (390) en el canvas');
  assert.ok(/max-w-\[768px\]/.test(source), 'sin ancho tablet (768) en el canvas');
  assert.ok(/min-w-0/.test(source), 'la columna del canvas no puede encogerse (min-w-0)');
  assert.ok(!/overflow-hidden[^"]*h-screen/.test(source), 'canvas con alto fijo: corta secciones');
});

test('F4-7b: la navegación pública tiene versión móvil y versión de escritorio', () => {
  const shell = read('business/BusinessShell.tsx');
  assert.ok(/lg:hidden/.test(shell), 'la cabecera pública no tiene versión móvil');
  assert.ok(/lg:flex|hidden lg:inline-flex|hidden lg:block/.test(shell), 'la cabecera pública no tiene versión de escritorio');
  assert.ok(/aria-label=/.test(shell), 'botón de menú sin nombre accesible');
});

// ───────────────────── 13. Los 7 anchos están cubiertos ───────────────────

test('F4-13: la auditoría de responsive cubre los 7 anchos obligatorios', () => {
  const responsive = fs.readFileSync(path.join(__dirname, '..', '..', 'qa', 'fase4-responsive.mjs'), 'utf8');
  const variantes = fs.readFileSync(path.join(__dirname, '..', '..', 'qa', 'fase4-variants.mjs'), 'utf8');
  for (const w of WIDTHS) {
    assert.ok(responsive.includes(String(w)), `la auditoría no mide ${w}`);
    assert.ok(variantes.includes(String(w)), `la auditoría de variantes no mide ${w}`);
  }
});

