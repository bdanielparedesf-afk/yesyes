const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('labels visibles centralizados en español', () => {
  const labels = read('business/businessLabels.ts');
  for (const value of ['Floristería', 'Barbería', 'Peluquería', 'Beauty y bienestar', 'Cafetería', 'Restaurante', 'Uñas', 'Gimnasio y fitness', 'Automotriz', 'Inmobiliaria', 'Servicios profesionales']) assert.ok(labels.includes(value));
  assert.ok(labels.includes("DRAFT: 'Borrador'"));
});

test('BusinessShell, contacto y preview usan arquitectura dedicada', () => {
  const page = read('pages/MiNegocio.tsx');
  const shell = read('business/BusinessShell.tsx');
  const sections = read('business/components/BusinessSections.tsx');
  assert.ok(page.includes('BusinessShell'));
  assert.ok(page.includes('BusinessPageRenderer'));
  assert.ok(page.includes('preview={preview}'));
  assert.ok(sections.includes('ContactSection'));
  assert.doesNotMatch(page, /BusinessLayout|WhatsAppButton|LEAD_TYPES/);
  assert.ok(shell.includes('Vista previa'));
});

test('página pública usa un payload agregado y no consultas paralelas', () => {
  const page = read('pages/MiNegocio.tsx');
  assert.ok(page.includes('getPublicPage(slug)'));
  assert.doesNotMatch(page, /Promise\.all/);
  assert.doesNotMatch(page, /getPublicServices|getPublicProducts|getPublicProperties|getPublicGallery|getPublicContent/);
});

test('sistema visual, assets y presets por rubro existen', () => {
  for (const file of ['visual/visualTokens.ts','visual/backgrounds.ts','visual/typography.ts','visual/effects.ts','visual/spacing.ts','visual/shadows.ts','visual/templateVisuals.ts','assets/index.ts']) assert.ok(fs.existsSync(path.join(root, 'business', file)));
  const design = read('business/dashboard/DesignSection.tsx');
  for (const label of ['Diseños recomendados', 'Personalizar colores', 'Ambiente y tipografía', 'Vista previa']) assert.ok(design.includes(label));
});

test('Business permanece aislado del catálogo Store', () => {
  const service = read('services/business.ts');
  assert.ok(service.includes('/businesses/${businessId}/products'));
  assert.doesNotMatch(service, /\/api\/products|Store Product|priceSync/);
});

test('selección de rubro usa tarjetas visuales y textos en español', () => {
  const dashboard = read('pages/BusinessDashboard.tsx');
  assert.ok(dashboard.includes('¿Qué tipo de negocio tienes?'));
  assert.ok(dashboard.includes('categoryDescription(code)'));
  assert.ok(dashboard.includes('aria-pressed={category === code}'));
});

test('preview del editor actualiza el renderer sin esperar el autoguardado', () => {
  const design = read('business/dashboard/DesignSection.tsx');
  const page = read('pages/MiNegocio.tsx');
  assert.ok(design.includes('YESYES_BUSINESS_PREVIEW'));
  assert.ok(design.includes('publishPreview(next)'));
  assert.ok(page.includes("addEventListener('message'"));
  assert.ok(page.includes('BusinessPageRenderer'));
});

test('presets comprehensively modifican la identidad visual', () => {
  const tokens = read('business/visual/visualTokens.ts');
  for (const token of ['typography:', 'background:', 'shadow:', 'sectionSpacing:', 'buttonStyle:', 'cardStyle:']) assert.ok(tokens.includes(token));
});

test('assets temáticos resuelven todos los grupos canónicos', () => {
  const assets = read('business/assets/index.ts');
  for (const group of ['FLOWERS', 'BARBER', 'HAIR', 'BEAUTY', 'CAFE', 'FOOD', 'BAKERY', 'NAILS', 'PET', 'FITNESS', 'AUTO', 'REAL_ESTATE', 'BOUTIQUE', 'PHOTO', 'PRO']) assert.ok(assets.includes(`${group}:`));
  assert.ok(assets.includes('onError') === false);
  assert.ok(read('business/components/index.tsx').includes('onError'));
});
