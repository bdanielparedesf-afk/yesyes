/**
 * FASE 4 · AUDITORÍA DE VARIANTES (parte 1: markup real de cada variante).
 *
 * Renderiza con `renderToStaticMarkup` CADA bloque × CADA variante del catálogo
 * real del backend (`VARIANT_DEFINITIONS`) usando el MISMO renderer que la
 * página (`BLOCK_RENDERERS`), y escribe el HTML en `qa/f4-variants/cases.json`.
 * Después `fase4-variants.mjs` lo mide en un navegador real, en los 7 anchos.
 *
 * El contenido es el de la clínica real (fixtures compartidas de Fase A) pero
 * con TEXTO EXTREMO opcional para detectar desbordes por cadenas largas.
 */
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
// React vive en frontend/node_modules: se resuelve desde ahí para no duplicar copia.
const frontendRequire = createRequire(path.join(__dirname, '..', 'frontend', 'package.json'));
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const React = frontendRequire('react');
const { BUSINESS, CONTENT, VARIANT_DEFINITIONS, renderBlock, BLOCK_RENDERERS } = require(
  path.join(__dirname, '..', 'frontend', 'tests', 'helpers', 'variants-harness.cjs'),
);

/** Variante de contenido: textos absurdamente largos (stress real de wrap). */
const LONG = {
  ...CONTENT,
  services: CONTENT.services.map((s, i) => (i === 0 ? { ...s, name: 'Consulta Veterinaria Integral Y Desparasitación Con Reanimación', description: 'x'.repeat(220) } : s)),
  products: CONTENT.products.map((p, i) => (i === 0 ? { ...p, name: 'Alimento Premium Super Premium Para Cachorros Y Gatos De Todas Las Razas', shortDescription: 'y'.repeat(180) } : p)),
  testimonials: CONTENT.testimonials.map((t, i) => (i === 0 ? { ...t, content: 'z'.repeat(260), name: 'María González Fernández de la Barra' } : t)),
  faqs: CONTENT.faqs.map((f, i) => (i === 0 ? { ...f, question: '¿Cuánto tarda la respuesta?', answer: 'w'.repeat(300) } : f)),
  promotions: CONTENT.promotions.map((o) => ({ ...o, title: 'Promoción Megalarboreana Inverosímil', description: 'v'.repeat(160) })),
  team: CONTENT.team.map((m) => ({ ...m, name: 'Dra. Camila Rojas De La Fuente', role: 'Médica veterinaria especialista encardiología', bio: 'u'.repeat(200) })),
};

const outDir = path.join(__dirname, 'f4-variants');
fs.mkdirSync(outDir, { recursive: true });

function renderWithContext(ctx, block, config) {
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null,
      renderBlock(block, config)),
  );
}

const cases = [];
for (const def of VARIANT_DEFINITIONS) {
  for (const variant of def.variants) {
    const key = `${def.block}:${variant.id}`;
    const normal = renderWithContext(CONTENT, def.block, { ...variant.config });
    const long = renderWithContext(LONG, def.block, { ...variant.config });
    const sinImagen = renderWithContext({ ...CONTENT, gallery: [], media: [], services: CONTENT.services.map((s) => ({ ...s, image: '' })), products: CONTENT.products.map((p) => ({ ...p, image: '' })), team: CONTENT.team.map((m) => ({ ...m, photo: '' })) }, def.block, { ...variant.config });
    const vacio = renderWithContext({ ...CONTENT, services: [], products: [], properties: [], gallery: [], testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [], media: [] }, def.block, { ...variant.config });
    cases.push({ key, block: def.block, variant: variant.id, normal, long, sinImagen, vacio });
  }
}
// Bloques SIN catálogo de variantes: se miden igual (no se pueden declarar variantes).
const conVariantes = new Set(VARIANT_DEFINITIONS.map((v) => v.block));
for (const block of Object.keys(BLOCK_RENDERERS)) {
  if (conVariantes.has(block)) continue;
  cases.push({ key: `${block}:default`, block, variant: 'default', normal: renderWithContext(CONTENT, block, {}), long: renderWithContext(LONG, block, {}), sinImagen: renderWithContext(CONTENT, block, {}), vacio: renderWithContext({ ...CONTENT, services: [], products: [], properties: [], gallery: [], testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [], media: [] }, block, {}) });
}

fs.writeFileSync(path.join(outDir, 'cases.json'), JSON.stringify(cases));
console.log(`casos: ${cases.length} · bloques con variantes: ${conVariantes.size} · bloques sin variantes: ${cases.filter((c) => c.variant === 'default').length}`);
