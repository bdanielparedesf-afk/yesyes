const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Business V3 registra templates dedicados y fallback seguro', () => {
  const registry = read('business/registry.tsx');
  for (const code of ['FOOD_01', 'BOUTIQUE_01', 'PHOTO_01', 'BEAUTY_01', 'DETAILING_01', 'CLEANING_01', 'MECHANIC_01', 'TUTORING_01', 'CONSTRUCTION_01']) assert.ok(registry.includes(code));
  assert.match(registry, /return Generic/);
});

test('el renderer prioriza templates dedicados y filtra contenido por secciones', () => {
  const renderer = read('business/BusinessPageRenderer.tsx');
  const registry = read('business/registry.tsx');
  assert.ok(renderer.indexOf('if (dedicated)') < renderer.indexOf('if (isSpecializedCategory'));
  assert.match(registry, /normalizeTemplateCode/);
  assert.match(registry, /DEDICATED_TEMPLATE_CODES/);
  assert.match(registry, /trim\(\)\.toUpperCase\(\)/);
  assert.match(renderer, /EditorialModules/);
  assert.match(renderer, /enabled\.has\('TESTIMONIALS'\)/);
});

test('el renderer normaliza el alias legacy de flores y expone el renderer dedicado', () => {
  const registry = read('business/registry.tsx');
  const renderer = read('business/BusinessPageRenderer.tsx');
  assert.match(registry, /FLORES_01: 'FLOWERS_01'/);
  assert.match(renderer, /data-business-renderer="dedicated"/);
  assert.match(renderer, /data-business-template-normalized/);
  assert.match(renderer, /data-business-resolved-template/);
});

test('editor visual usa debounce, retry y confirmación de template', () => {
  const design = read('business/dashboard/DesignSection.tsx');
  assert.match(design, /setTimeout\(\(\) => persist\(next\), 800\)/);
  assert.match(design, /Reintentar guardado/);
  assert.match(design, /window\.confirm/);
});

test('catálogo Business no consulta productos globales', () => {
  const service = read('services/business.ts');
  assert.match(service, /Catálogo propio del Business/);
  assert.doesNotMatch(service, /\/api\/products.*business/i);
});
