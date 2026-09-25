/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 (Fase 3) — tests del frontend.
 *
 * El frontend replica los registries y compone los bloques, pero NO es la
 * fuente de verdad ni el renderer. Estos tests lo verifican.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '../../frontend/src/business', relative), 'utf8');

const renderer = read('BusinessPageRenderer.tsx');
const blocks = read('engine/blocks.tsx');
const registries = read('engine/registries.ts');
const engine = read('engine/TemplateEngineV2.tsx');
const video = read('engine/BusinessVideo.tsx');

test('el renderer único sigue siendo BusinessPageRenderer y monta el motor V2', () => {
  assert.ok(renderer.includes('export default function BusinessPageRenderer'));
  assert.ok(renderer.includes('TemplateEngineV2'), 'debe montar el motor V2');
  assert.ok(renderer.includes('data-business-renderer="v2"'), 'debe marcar la vía V2 para QA');
});

test('el renderer conserva intacta la compatibilidad V3', () => {
  assert.ok(renderer.includes('hasDedicatedTemplate'));
  assert.ok(renderer.includes('isSpecializedCategory'));
  assert.ok(renderer.includes('resolveOrderedSections'));
  assert.ok(renderer.includes('resolveTemplate'));
  assert.ok(renderer.includes('EditorialModules'));
});

test('el manifest legacy nunca entra por la composición V2', () => {
  assert.match(renderer, /legacy === true[\s\S]{0,80}return null/, 'un manifest legacy debe seguir por la vía V3');
  assert.ok(renderer.includes('manifest.sections.length === 0'), 'sin secciones no hay composición V2');
});

test('el motor V2 no es un renderer alternativo', () => {
  assert.ok(!/export default/.test(engine), 'no puede tener export default');
  assert.ok(!engine.includes('createRoot'), 'no monta nada por su cuenta');
});

test('el motor V2 respeta secciones y bloques ocultos sin borrarlos', () => {
  assert.ok(engine.includes('if (section.hidden) return null'));
  assert.ok(engine.includes('!block.hidden'));
  assert.ok(engine.includes('hasRenderer(block.block)'), 'nunca renderiza un bloque sin implementación');
});

test('cada bloque expone identidad estable para el editor de Fase 4', () => {
  assert.ok(engine.includes('data-instance-id'), 'debe exponer instanceId');
  assert.ok(engine.includes('data-block-id'), 'debe exponer el id del bloque');
  assert.ok(engine.includes('data-block-section'), 'debe exponer la sección');
  assert.ok(engine.includes('data-section-order'), 'debe exponer el orden para reordenar');
});

test('el motor V2 implementa un renderer por cada bloque del catálogo', () => {
  const map = blocks.slice(blocks.indexOf('export const BLOCK_RENDERERS'));
  const required = ['Hero', 'HeroVideo', 'Text', 'Image', 'ImageGallery', 'Video', 'VideoGallery', 'Button', 'CTA', 'Products', 'ProductFeatured', 'Promotions', 'Properties', 'PropertyFeatured', 'Services', 'Booking', 'Testimonials', 'Team', 'FAQ', 'Contact', 'WhatsApp', 'Map', 'SocialLinks', 'LeadForm', 'Footer'];
  for (const id of required) {
    assert.ok(new RegExp(`(^|[\\s,{])${id}[,:\\s}]`, 'm').test(map), `falta renderer para ${id}`);
  }
});

test('el video se soporta de verdad: poster, autoplay mudo, loop, reduced-motion y fallback', () => {
  assert.ok(video.includes('prefers-reduced-motion'), 'debe respetar movimiento reducido');
  assert.ok(video.includes('autoPlay={shouldAutoplay}'));
  assert.ok(video.includes('muted={muted}'));
  assert.ok(video.includes('loop={Boolean(loop) && !reducedMotion}'));
  assert.ok(video.includes('poster={poster || undefined}'));
  assert.ok(video.includes('posterOnlyOnMobile'), 'debe tener fallback en mobile');
  assert.ok(video.includes('controls={controls}'), 'los controles son configurables');
  assert.ok(video.includes('onUnavailable'), 'debe avisar cuando no se puede reproducir');
});

test('los bloques de video no muestran un reproductor vacío', () => {
  assert.ok(blocks.includes("if (!video) return null"), 'sin medio no se muestra el bloque');
  assert.ok(blocks.includes('data-video-fallback="poster"') || video.includes('data-video-fallback="poster"'), 'debe caer al poster');
});

test('el frontend replica los ids del backend sin inventar bloques', () => {
  for (const id of ['Hero', 'HeroVideo', 'VideoGallery', 'Products', 'PropertyFeatured', 'LeadForm']) {
    assert.ok(registries.includes(`'${id}'`), `falta el bloque ${id} en la paridad`);
  }
  for (const id of ['bento', 'gallery-first', 'video-first', 'modern-commerce', 'dark-premium']) {
    assert.ok(registries.includes(`'${id}'`), `falta el layout ${id} en la paridad`);
  }
});

test('no se interpolan clases Tailwind construidas en runtime', () => {
  assert.ok(!/grid-cols-\$\{/.test(blocks), 'Tailwind no detecta clases interpoladas al purgar');
  assert.ok(blocks.includes('GALLERY_COLUMNS'), 'debe usar un mapa estático de clases');
  assert.ok(blocks.includes('PRODUCT_COLUMNS'));
  assert.ok(blocks.includes('SERVICE_COLUMNS'));
});

test('no existe un segundo renderer de página de negocio', () => {
  const root = path.join(__dirname, '../../frontend/src');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  const renderers = files.filter((file) => /export default function \w*Renderer\w*/.test(fs.readFileSync(file, 'utf8')));
  assert.equal(renderers.length, 1);
});
