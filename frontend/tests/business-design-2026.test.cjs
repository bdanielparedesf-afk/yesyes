const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('labels visibles centralizados en español', () => {
  const labels = read('business/businessLabels.ts');
  const taxonomy = read('business/taxonomy.ts');
  for (const value of ['Floristería', 'Barbería', 'Peluquería', 'Cafetería', 'Restaurante', 'Uñas', 'Gimnasio y fitness', 'Mecánica y taller', 'Inmobiliaria', 'Consultoría y servicios profesionales']) assert.ok(taxonomy.includes(value), `taxonomy debe incluir ${value}`);
  assert.ok(labels.includes("DRAFT: 'Borrador'"));
  // La taxonomía es la única fuente: los labels se derivan, no se redeclaran.
  assert.ok(labels.includes("from './taxonomy'"));
  assert.doesNotMatch(labels, /HAIR:\s*'Peluquería'/);
});

test('selección de rubro vive en un único asistente, no duplicado en el panel', () => {
  const wizard = read('pages/BusinessWizard.tsx');
  const dashboard = read('pages/BusinessDashboard.tsx');
  // El asistente es el flujo único: rubro -> diseños -> vista previa -> datos -> crear.
  assert.ok(wizard.includes('groupedCategories()'));
  assert.ok(wizard.includes('DesignGallery'));
  assert.ok(wizard.includes('DesignFullPreview'));
  assert.ok(wizard.includes("getPublicTemplates"));
  assert.match(wizard, /const steps = \['Tipo de negocio', 'Diseño', 'Vista previa', 'Información básica', 'Revisión'\]/);
  // El panel solo lleva al asistente: no repite selector de rubro ni formulario de alta.
  assert.doesNotMatch(dashboard, /handleCreate/);
  assert.doesNotMatch(dashboard, /business-create-name/);
  assert.ok(dashboard.includes('groupedCategories()'));
  assert.ok(dashboard.includes('Crear página web'));
});

test('el flujo muestra diseños y vista previa antes de pedir los datos', () => {
  const wizard = read('pages/BusinessWizard.tsx');
  const designsAt = wizard.indexOf('{step === 1 && (');
  const previewAt = wizard.indexOf('{step === 2 && (');
  const dataAt = wizard.indexOf('{step === 3 && (');
  assert.ok(designsAt > -1 && previewAt > designsAt && dataAt > previewAt, 'el orden es rubro -> diseños -> vista previa -> datos');
  // Los datos del negocio solo bloquean el avance en su propio paso.
  assert.match(wizard, /const canContinue = step === 0 \? Boolean\(category\) : step === 1 \? Boolean\(designId\) : step === 3 \? form\.name\.trim\(\)\.length > 1 : true;/);
  // La creación ocurre en el último paso, con el botón de resumen.
  assert.ok(wizard.includes('Crear página') && wizard.includes('void submit()'));
});

test('la galería de diseños usa el renderer real y no muestra códigos técnicos', () => {
  const gallery = read('business/templates/DesignGallery.tsx');
  assert.ok(gallery.includes('BusinessPageRenderer'));
  assert.ok(gallery.includes('buildPreviewFixture'));
  assert.ok(gallery.includes('overflow-y-auto'), 'la vista previa completa debe ser scrolleable');
  assert.ok(gallery.includes("'Escritorio'") && gallery.includes("'Tableta'") && gallery.includes("'Móvil'"));
  assert.ok(gallery.includes('Ver página completa'));
  // Nunca se imprime el código de la plantilla ni capacidades crudas.
  assert.doesNotMatch(gallery, /\{design\.code\}/);
  assert.doesNotMatch(gallery, /capabilities\.join/);
});

test('el contenido de demostración es una única fuente compartida', () => {
  const fixture = read('business/fixtures/previewFixture.ts');
  const fixturePage = read('pages/BusinessFixturePage.tsx');
  assert.ok(fixture.includes('buildPreviewFixture'));
  assert.ok(fixturePage.includes('buildPreviewFixture'));
  assert.doesNotMatch(fixturePage, /const CATEGORIES = \[/, 'la lista de categorías no se duplica en la página de QA');
  assert.ok(fixturePage.includes('ALL_BUSINESS_CATEGORY_CODES'));
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

test('el panel no duplica el alta de negocios y el editor sigue en su ruta', () => {
  const dashboard = read('pages/BusinessDashboard.tsx');
  const config = read('business/dashboard/ConfigSection.tsx');
  // El alta vive solo en el asistente; el panel mantiene el CTA y la lista.
  assert.ok(dashboard.includes("navigate('/negocio/nuevo')"));
  assert.doesNotMatch(config, /const CATS = \[/, 'la lista de categorías se importa de la taxonomía');
  assert.ok(config.includes('BUSINESS_CATEGORY_CODES'));
  // Nombre legible en el selector de diseño: sin código ni capacidades crudas.
  assert.doesNotMatch(config, /\{t\.code\} · \{t\.capabilities\?\.join/);
  assert.ok(config.includes('t.label || templateLabel(t.code, t.name)'));
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

test('diseños firma cubren cada rubro y preservan la vista previa', () => {
  const signature = read('business/SignatureTemplate.tsx');
  const registry = read('business/registry.tsx');
  const seed = fs.readFileSync(path.join(root, '..', '..', 'backend', 'prisma', 'seed-business.ts'), 'utf8');
  const signatureUtils = read('business/signatureUtils.ts');
  assert.ok(signature.includes('signatureCategory'));
  assert.ok(signatureUtils.includes('signaturePrefix'));
  assert.ok(signature.includes('thematicAssets(category)'));
  assert.ok(registry.includes('isSignatureTemplate(code)'));
  assert.ok(seed.includes('SIGNATURE_VARIANTS'));
  assert.ok(seed.includes('SIGNATURE_CATEGORIES'));
  assert.ok(read('business/dashboard/DesignSection.tsx').includes('templateCode'));
  assert.ok(read('pages/MiNegocio.tsx').includes('event.data.templateCode'));
});

test('las 15 composiciones canónicas controlan navegación, hero, CTA y tratamiento visual', () => {
  const composition = read('business/industryComposition.ts');
  for (const code of ['FLOWERS_01','BARBER_01','HAIR_01','BEAUTY_01','CAFE_01','FOOD_01','BAKERY_01','NAILS_01','PETS_01','FITNESS_01','AUTO_01','REAL_ESTATE_01','BOUTIQUE_01','PHOTO_01','PRO_01']) assert.ok(composition.includes(code));
  for (const field of ['navigation:', 'hero:', 'layout:', 'cards:', 'cta:', 'imageTreatment:', 'mobileBehavior:', 'background:']) assert.ok(composition.includes(field));
  const shell = read('business/BusinessShell.tsx');
  assert.ok(shell.includes('getIndustryComposition'));
  assert.ok(shell.includes('Navegación principal'));
  assert.ok(shell.includes('Navegación móvil'));
});
