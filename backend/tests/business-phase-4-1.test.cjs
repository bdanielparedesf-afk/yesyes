/**
 * YESYES BUSINESS â€” FASE 4.1: Integracion definitiva + editor visual +
 * sistema de multiples disenos.
 *
 * Estos tests cubren la REGLA FUNDAMENTAL de la fase:
 *
 *   EDITOR_ALLOWED === MANIFEST_ALLOWED === BACKEND_ALLOWED === RENDERER_SUPPORTED
 *
 * y el requisito de que cambiar de diseno NO PIERDA CONTENIDO.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const engine = require('../src/template-engine/index.ts');
const blocks = require('../src/template-engine/block-registry.ts');
const variants = require('../src/template-engine/variant-registry.ts');
const designs = require('../src/template-engine/design-registry.ts');
const renderPlan = require('../src/template-engine/render-plan.ts');

const ROOT = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const template = (code, category, style, capabilities) => ({
  templateId: `tpl-${code}`,
  code,
  name: code,
  category,
  style,
  capabilities,
});

/** Manifest de un negocio con contenido, como quedaria tras editar. */
const manifestConContenido = () => {
  const design = designs.designFromTemplate(template('PETS_01', 'PET', 'Amigable', ['HERO', 'SERVICES', 'GALLERY']));
  const manifest = designs.manifestFromDesign(design, { instanceId: 'site-test', businessName: 'Clinica Vet' });
  const hero = manifest.sections.find((section) => section.id === 'inicio');
  hero.blocks[0].config = { headline: 'Clinica Veterinaria', ctaLabel: 'Agendar hora' };
  const services = manifest.sections.find((section) => section.id === 'services');
  services.blocks[0].config = { title: 'Consultas', limit: 6 };
  return manifest;
};

// â”€â”€ REGLA FUNDAMENTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('paridad: toda variante declarada tiene implementacion real', () => {
  assert.deepStrictEqual(variants.findVariantsWithoutImplementation(), [],
    'no se puede ofrecer una variante que el renderer no compone');
});

test('paridad: toda variante pertenece a un bloque del BlockRegistry', () => {
  for (const entry of variants.VARIANT_DEFINITIONS) {
    assert.ok(blocks.getBlock(entry.block), `la variante de "${entry.block}" no tiene bloque`);
    assert.ok(entry.variants.length > 0, `${entry.block} no declara variantes`);
  }
});

test('paridad: el renderer unico compone cada bloque con variantes', () => {
  const blocksFile = read('frontend/src/business/engine/blocks.tsx');
  for (const block of Object.keys(variants.implementedVariantIds())) {
    assert.ok(blocksFile.includes(block), `el renderer unico no compone ${block}`);
  }
});

test('paridad: las secciones agregables del backend tienen bloque real', () => {
  for (const [capability, mapped] of Object.entries(designs.CAPABILITY_TO_BLOCKS)) {
    for (const block of mapped) {
      assert.ok(blocks.getBlock(block)?.renderInV2,
        `la capacidad ${capability} ofrece "${block}" y ese bloque no se puede renderizar`);
    }
  }
});

test('paridad: el frontend llama a las rutas de diseÃ±o del backend', () => {
  const routes = read('backend/src/routes/index.ts');
  assert.ok(routes.includes('designRoutes'), 'las rutas de diseÃ±o deben estar montadas');
  const service = read('frontend/src/services/business.ts');
  for (const call of ['getBusinessDesigns', 'applyBusinessDesign', 'setBusinessBlockVariant', 'addBusinessSection', 'updateBusinessSections']) {
    assert.ok(service.includes(call), `falta el servicio ${call}`);
  }
});

// â”€â”€ DISEÃ‘OS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('disenos: cada rubro produce al menos un diseÃ±o vÃ¡lido', () => {
  for (const category of ['PET', 'BARBER', 'FOOD', 'FLOWERS', 'REAL_ESTATE', 'PHOTO', 'HAIR', 'BOUTIQUE']) {
    const design = designs.designFromTemplate(template(`${category}_01`, category, 'Editorial', ['HERO', 'CTA', 'FOOTER']));
    const manifest = designs.manifestFromDesign(design, { instanceId: `site-${category}`, businessName: 'Negocio' });
    const plan = renderPlan.resolveRenderPlan(manifest);
    assert.deepStrictEqual(plan.warnings, [], `${category} genero avisos: ${plan.warnings.join('; ')}`);
    assert.ok(plan.sections.length > 0, `${category} no genero secciones`);
  }
});

test('disenos: el manifest generado es vÃ¡lido y renderizable de verdad', () => {
  const design = designs.designFromTemplate(template('PETS_01', 'PET', 'CinemÃ¡tico', ['HERO', 'SERVICES', 'GALLERY', 'CTA']));
  const manifest = designs.manifestFromDesign(design, { instanceId: 'site-x', businessName: 'Clinica' });
  const result = engine.validateTemplateManifest(manifest);
  assert.deepStrictEqual(result.errors, []);
  const plan = renderPlan.resolveRenderPlan(manifest);
  assert.strictEqual(plan.legacy, false, 'el sitio nuevo no debe caer en la via legacy');
  const ids = plan.sections.map((section) => section.id);
  assert.ok(ids.includes('inicio'), 'debe existir la portada');
  assert.ok(ids.includes('pie'), 'debe existir el pie');
});

test('disenos: el nombre mostrado es humano y nunca un codigo tecnico', () => {
  const design = designs.designFromTemplate(template('PETS_01', 'PET', 'Amigable', ['HERO']));
  assert.ok(design.label.includes('Cuidado de mascotas'), `el nombre debe traer el rubro: ${design.label}`);
  assert.ok(!/PETS_01|LAYOUT_|_0\d/.test(design.label), `el nombre no puede ser un codigo: ${design.label}`);
});

test('disenos: el catalogo deduplica disenos con la misma identidad visual', () => {
  const rows = [
    template('PETS_01', 'PET', 'Amigable', ['HERO', 'SERVICES']),
    template('PETS_02', 'PET', 'Amigable', ['HERO', 'SERVICES']),
    template('PETS_03', 'PET', 'CinemÃ¡tico', ['HERO', 'SERVICES']),
  ];
  const list = designs.designsForCategory(rows, 'PET');
  assert.strictEqual(list.length, 2, 'dos plantillas identicas deben colapsar en un diseno');
  assert.strictEqual(new Set(list.map((design) => design.layout)).size, 2);
});

// â”€â”€ NO PERDIDA DE CONTENIDO (requisito central) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('no-perdida: cambiar de diseÃ±o conserva TODO el contenido configurado', () => {
  const before = manifestConContenido();
  const target = designs.designFromTemplate(template('PETS_02', 'PET', 'CinemÃ¡tico', ['HERO', 'SERVICES', 'GALLERY']));
  const after = designs.applyDesignChange(before, target);

  assert.notStrictEqual(after.layout, before.layout, 'el diseÃ±o debe cambiar de verdad');

  const heroAfter = after.sections.find((section) => section.id === 'inicio');
  assert.strictEqual(heroAfter.blocks[0].config.ctaLabel, 'Agendar hora', 'el CTA escrito por el usuario debe sobrevivir');
  assert.strictEqual(heroAfter.blocks[0].config.headline, 'Clinica Veterinaria', 'el titulo debe sobrevivir');

  const servicesAfter = after.sections.find((section) => section.id === 'services');
  assert.strictEqual(servicesAfter.blocks[0].config.title, 'Consultas', 'el contenido de servicios debe sobrevivir');
  assert.strictEqual(servicesAfter.blocks[0].config.limit, 6, 'la configuracion del bloque debe sobrevivir');
});

test('no-perdida: el bloque que el diseÃ±o nuevo no contempla se conserva', () => {
  const before = manifestConContenido();
  const target = designs.designFromTemplate(template('PETS_09', 'PET', 'Minimal', ['HERO', 'SERVICES']));
  const after = designs.applyDesignChange(before, target);

  const surviving = after.sections.flatMap((section) => section.blocks.map((block) => block.block));
  for (const block of before.sections.flatMap((section) => section.blocks.map((entry) => entry.block))) {
    assert.ok(surviving.includes(block), `el bloque ${block} se perdio al cambiar de diseÃ±o`);
  }
});

test('no-perdida: applyDesignChange no borra la config de ningun bloque', () => {
  const before = manifestConContenido();
  const target = designs.designFromTemplate(template('PETS_07', 'PET', 'Bento', ['HERO', 'SERVICES', 'GALLERY']));
  const after = designs.applyDesignChange(before, target);
  for (const section of after.sections) {
    for (const block of section.blocks) {
      const previous = before.sections
        .flatMap((entry) => entry.blocks)
        .find((entry) => entry.instanceId === block.instanceId);
      if (!previous) continue;
      for (const [key, value] of Object.entries(previous.config)) {
        assert.deepStrictEqual(block.config[key], value, `la clave ${key} del bloque ${block.block} se perdio`);
      }
    }
  }
});

test('no-perdida: applyDesignChange no muta el manifest original', () => {
  const before = manifestConContenido();
  const snapshot = JSON.stringify(before);
  designs.applyDesignChange(before, designs.designFromTemplate(template('PETS_08', 'PET', 'Editorial', ['HERO'])));
  assert.strictEqual(JSON.stringify(before), snapshot, 'el manifest de entrada no puede mutarse');
});

test('no-perdida: el manifest resultante sigue siendo valido para todo diseÃ±o', () => {
  const before = manifestConContenido();
  for (const style of ['Minimal', 'CinemÃ¡tico', 'Bento', 'Editorial', 'Organico', 'Comercio moderno']) {
    const target = designs.designFromTemplate(template('X_01', 'PET', style, ['HERO', 'SERVICES', 'GALLERY', 'FAQ']));
    const after = designs.applyDesignChange(before, target);
    const result = engine.validateTemplateManifest(after);
    assert.deepStrictEqual(result.errors, [], `el diseÃ±o ${style} produjo un manifest invalido`);
  }
});

// â”€â”€ VARIANTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('variantes: cambiar de variante no toca el contenido del bloque', () => {
  const design = designs.designFromTemplate(template('PET_01', 'PET', 'Editorial', ['HERO', 'SERVICES']));
  const manifest = designs.manifestFromDesign(design, { instanceId: 'site-v', businessName: 'Vet' });
  const services = manifest.sections.find((section) => section.id === 'services');
  services.blocks[0].config = { title: 'Mis servicios', limit: 12, showPrices: true };

  for (const variant of variants.variantsForBlock('Services')) {
    const next = JSON.parse(JSON.stringify(manifest));
    const target = next.sections.find((section) => section.id === 'services');
    target.blocks[0].config = { ...target.blocks[0].config, ...variant.config };
    assert.strictEqual(target.blocks[0].config.title, 'Mis servicios', `la variante ${variant.id} perdio el titulo`);
    assert.strictEqual(target.blocks[0].config.limit, 12, `la variante ${variant.id} perdio el limite`);
  }
});

test('variantes: la presentacion es la unica diferencia entre variantes', () => {
  for (const entry of variants.VARIANT_DEFINITIONS) {
    for (const variant of entry.variants) {
      const keys = Object.keys(variant.config);
      assert.deepStrictEqual(keys, ['presentation'],
        `la variante ${entry.block}/${variant.id} solo puede cambiar "presentation", no ${keys.join(',')}`);
    }
  }
});

test('variantes: las secciones clave tienen la composicion que pide la fase', () => {
  const required = {
    Hero: ['fullscreen', 'split', 'editorial', 'centered', 'cinematic'],
    Services: ['cards', 'editorial', 'split', 'bento'],
    Products: ['grid', 'featured', 'editorial', 'asymmetric', 'bento'],
    ImageGallery: ['masonry', 'grid', 'fullscreen', 'editorial', 'collage'],
    Testimonials: ['cards', 'slider', 'quote'],
    Team: ['grid', 'featured', 'editorial', 'cards'],
    FAQ: ['accordion', 'split', 'editorial'],
    CTA: ['fullscreen', 'split', 'image', 'minimal', 'premium'],
  };
  for (const [block, expected] of Object.entries(required)) {
    const ids = variants.variantsSupported(block);
    for (const variant of expected) {
      assert.ok(ids.includes(variant), `a ${block} le falta la variante ${variant}`);
    }
  }
});

// â”€â”€ SERVICIOS Y PRODUCTOS SON INDEPENDIENTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('servicios y productos coexisten: un negocio puede tener ambos', () => {
  const design = designs.designFromTemplate(template('PET_01', 'PET', 'Editorial', ['HERO', 'SERVICES', 'PRODUCTS', 'GALLERY']));
  const manifest = designs.manifestFromDesign(design, { instanceId: 'site-sp', businessName: 'Vet' });
  const ids = manifest.sections.map((section) => section.id);
  assert.ok(ids.includes('services'), 'los servicios deben existir');
  assert.ok(ids.includes('products'), 'los productos deben existir aunque haya servicios');
});

test('servicios y productos coexisten: tener productos NO oculta servicios', () => {
  const source = read('frontend/src/business/engine/blocks.tsx');
  assert.ok(!/products\.length\s*>\s*0[\s\S]{0,200}hide services/.test(source),
    'no se puede ocultar servicios por existir productos');
  const renderer = read('frontend/src/business/BusinessPageRenderer.tsx');
  assert.ok(!/products\.length\s*>\s*0\s*&&[\s\S]{0,120}services\s*=\s*\[\]/.test(renderer),
    'el renderer unico no puede vaciar servicios por existir productos');
});

// â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('cta: el renderer usa la fuente unica y no el texto hardcodeado del rubro', () => {
  const labels = read('frontend/src/business/businessLabels.ts');
  assert.ok(labels.includes('resolveBusinessCta'), 'debe existir la fuente unica de CTA');

  const blocksFile = read('frontend/src/business/engine/blocks.tsx');
  const heroBlock = blocksFile.slice(blocksFile.indexOf('function Hero('), blocksFile.indexOf('function HeroVideo('));
  assert.ok(heroBlock.includes('resolveBusinessCta'), 'el Hero debe usar la fuente unica de CTA');
  assert.ok(!/text\(config, 'ctaLabel', '[A-Za-zÃÃ‰ÃÃ“ÃšÃ¡Ã©Ã­Ã³Ãº]/.test(heroBlock), 'el Hero no puede hardcodear el texto del boton');

  const ctaBlock = blocksFile.slice(blocksFile.indexOf('function CTA('), blocksFile.indexOf('function Products('));
  assert.ok(ctaBlock.includes('resolveBusinessCta'), 'el bloque CTA debe usar la fuente unica');
});

test('cta: la configuracion del usuario tiene prioridad sobre cualquier default', () => {
  const source = read('frontend/src/business/businessLabels.ts');
  const body = source.slice(source.indexOf('export function resolveBusinessCta'));
  const primaryIndex = body.indexOf('primaryLabel');
  const fallbackIndex = body.indexOf('options.fallback');
  assert.ok(primaryIndex >= 0 && primaryIndex < fallbackIndex,
    'lo configurado por el usuario debe evaluarse ANTES que el default');
});

// â”€â”€ DRAFT Y PUBLICADO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('draft/publicado: la pagina publica lee la revision publicada, no el borrador', () => {
  const routes = read('backend/src/routes/public-business.routes.ts');
  assert.ok(routes.includes('publishedManifestOf'), 'debe existir la resolucion del manifest publicado');
  assert.ok(routes.includes("reason: { startsWith: 'PUBLICADO' }"), 'debe leer la ultima revision publicada');
});

test('draft/publicado: la vista previa si lleva el borrador', () => {
  const routes = read('backend/src/routes/public-business.routes.ts');
  const preview = routes.slice(routes.indexOf('previewPayload'), routes.indexOf('/:slug/page'));
  assert.ok(preview.includes('siteInstance'), 'la vista previa debe llevar el manifest del borrador');
});

test('draft/publicado: publicar congela la revision del manifest', () => {
  const publish = read('backend/src/services/business-publish.service.ts');
  assert.ok(publish.includes('PUBLICADO'), 'publicar debe marcar la revision como publicada');
  assert.ok(publish.includes('businessSiteRevision.create'), 'publicar debe congelar el manifest');
});

test('draft/publicado: editar no escribe en la revision publicada', () => {
  const routes = read('backend/src/routes/design.routes.ts');
  assert.ok(!/startsWith: 'PUBLICADO'/.test(routes), 'el editor nunca escribe en la revision publicada');
  assert.ok(routes.includes('businessSiteRevision.create'), 'cada cambio de edicion abre su revision');
});

// â”€â”€ ERRORES EXPLICITOS, NUNCA SILENCIOSOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('sin borrado silencioso: agregar una seccion duplicada da error explicito', () => {
  const routes = read('backend/src/routes/design.routes.ts');
  assert.ok(routes.includes('res.status(409)'), 'debe responder con un error explicito, no con un bloque invisible');
});

test('sin borrado silencioso: una variante inexistente se rechaza', () => {
  const routes = read('backend/src/routes/design.routes.ts');
  assert.ok(routes.includes('no existe para'), 'una variante inventada debe rechazarse por nombre');
});

test('sin borrado silencioso: el backend revalida antes de guardar', () => {
  const routes = read('backend/src/routes/design.routes.ts');
  assert.ok(routes.includes('validateTemplateManifest'), 'el backend valida, el frontend propone');
  assert.ok(routes.includes('res.status(422)'), 'un manifest invalido no se guarda en silencio');
});

// â”€â”€ RENDERER UNICO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('renderer unico: editor, preview y publica usan el mismo componente', () => {
  assert.ok(read('frontend/src/pages/BusinessBuilder.tsx').includes('BusinessPageRenderer'), 'el editor usa el renderer unico');
  assert.ok(read('frontend/src/pages/MiNegocio.tsx').includes('BusinessPageRenderer'), 'la pagina publica usa el renderer unico');
});

test('renderer unico: sigue existiendo UN solo renderer de pagina de negocio', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, 'frontend', 'src'));
  const renderers = files.filter((file) => /export default function \w*Renderer\w*/.test(fs.readFileSync(file, 'utf8')));
  assert.strictEqual(renderers.length, 1, 'debe existir un solo renderer de pagina de negocio');
});

test('renderer unico: el manifest V2 ya no es codigo muerto', () => {
  for (const file of ['backend/src/routes/business.routes.ts', 'backend/src/routes/public-business.routes.ts']) {
    assert.ok(read(file).includes('siteInstance'), `${file} debe entregar el manifest al renderer`);
  }
  assert.ok(read('frontend/src/business/BusinessPageRenderer.tsx').includes('siteInstance'),
    'el renderer debe leer el manifest desde la instancia');
  assert.ok(read('backend/src/controllers/business.controller.ts').includes('ensureSiteInstance'),
    'crear una pagina debe materializar su manifest V2');
});

