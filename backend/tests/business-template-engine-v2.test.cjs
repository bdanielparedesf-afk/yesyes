/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 (Fase 3) â€” Suite de tests.
 *
 * Cubre lo exigido por la fase: BlockRegistry, LayoutRegistry, validación de
 * manifest, versionado, compatibilidad legacy, template â†’ site instance,
 * aislamiento entre instancias, capacidades por rubro, fallback, renderer
 * único y persistencia.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const blocks = require('../src/template-engine/block-registry.ts');
const layouts = require('../src/template-engine/layout-registry.ts');
const manifest = require('../src/template-engine/template-manifest.ts');
const siteInstance = require('../src/template-engine/site-instance.ts');
const engine = require('../src/template-engine/render-plan.ts');
const capabilities = require('../src/template-engine/capabilities.ts');
const index = require('../src/template-engine/index.ts');

/** Manifest base válido, reutilizado por los tests. */
const validManifest = () => ({
  templateId: 'master-barber-01',
  templateVersion: 1,
  manifestVersion: 1,
  businessCategory: 'BARBER',
  style: 'Premium',
  layout: 'dark-premium',
  sections: [
    { id: 'inicio', label: 'Inicio', order: 0, blocks: [{ block: 'Hero', instanceId: 'inicio-hero', config: { headline: 'Barbería' } }] },
    { id: 'servicios', label: 'Servicios', order: 10, blocks: [{ block: 'Services', instanceId: 'servicios-lista' }] },
    { id: 'cierre', label: 'Cierre', order: 90, blocks: [{ block: 'Footer', instanceId: 'cierre-footer' }] },
  ],
  capabilities: ['SERVICES', 'BOOKING', 'WHATSAPP'],
  theme: { palette: { primary: '#111827', background: '#ffffff', text: '#111827', accent: '#b08d57' }, radius: 'soft', mode: 'dark', headingFont: 'serif', bodyFont: 'sans' },
  navigation: { enabled: true, style: 'sticky', links: [{ label: 'Inicio', anchor: 'inicio' }] },
  media: { requiredMedia: ['image'], video: { allowed: true, autoplayRequiresMuted: true, maxAutoplayDurationSec: 12, posterRequired: true, disableAutoplayOnReducedMotion: true } },
  seo: { titleTemplate: 'Barbería', description: 'Barbería en Santiago', ogImageRequired: false, noIndexPreview: true },
  availableActions: ['whatsapp', 'booking'],
  legacy: false,
});

// â”€â”€ BlockRegistry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('BlockRegistry: catálogo único con identidad estable', () => {
  assert.ok(blocks.BLOCK_DEFINITIONS.length >= 25, 'debe existir el catálogo de bloques base');
  const ids = blocks.BLOCK_IDS;
  assert.strictEqual(new Set(ids).size, ids.length, 'no puede haber ids de bloque duplicados');
  const required = ['Hero', 'HeroVideo', 'Text', 'Image', 'ImageGallery', 'Video', 'VideoGallery', 'Button', 'CTA', 'Products', 'ProductFeatured', 'Properties', 'PropertyFeatured', 'Booking', 'Services', 'Testimonials', 'Team', 'FAQ', 'Contact', 'WhatsApp', 'Map', 'SocialLinks', 'LeadForm', 'Promotions', 'Footer'];
  for (const id of required) assert.ok(ids.includes(id), `falta el bloque ${id}`);
});

test('BlockRegistry: ninguna responsabilidad duplicada', () => {
  const duplicates = blocks.findDuplicateResponsibilities();
  assert.deepStrictEqual(duplicates, [], `bloques duplicados: ${JSON.stringify(duplicates)}`);
});

test('BlockRegistry: cada bloque declara schema, capacidades y responsive', () => {
  for (const block of blocks.BLOCK_DEFINITIONS) {
    assert.ok(block.responsibility, `${block.id} sin responsabilidad declarada`);
    assert.ok(block.media, `${block.id} sin requisito de medios`);
    assert.ok(block.responsive && block.responsive.mobile, `${block.id} sin comportamiento mobile`);
    assert.ok(block.responsive.reducedMotion, `${block.id} sin política de movimiento reducido`);
    assert.ok(Array.isArray(block.configSchema), `${block.id} sin schema de configuración`);
    assert.strictEqual(block.renderInV2, true, `${block.id} no debe ofrecerse sin implementación real`);
  }
});

test('BlockRegistry: el video está soportado desde el inicio', () => {
  for (const id of ['HeroVideo', 'Video', 'VideoGallery']) {
    const block = blocks.getBlock(id);
    assert.strictEqual(block.media.kind, 'video', `${id} debe declarar medios de video`);
    assert.strictEqual(block.media.requiresPoster, true, `${id} exige poster`);
    assert.strictEqual(block.responsive.reducedMotion, 'disable-autoplay', `${id} debe respetar movimiento reducido`);
  }
});

// â”€â”€ LayoutRegistry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('LayoutRegistry: los 16 layouts de la fase existen', () => {
  const required = ['editorial', 'luxury', 'cinematic', 'minimal', 'bento', 'asymmetric', 'gallery-first', 'video-first', 'commerce-first', 'portfolio', 'immersive', 'corporate', 'organic', 'dark-premium', 'magazine', 'modern-commerce'];
  for (const id of required) assert.ok(layouts.hasLayout(id), `falta el layout ${id}`);
  assert.strictEqual(layouts.LAYOUT_IDS.length, required.length);
});

test('LayoutRegistry: los layouts son realmente distintos entre sí', () => {
  const fingerprints = layouts.LAYOUT_IDS.map((id) => layouts.layoutFingerprint(id));
  assert.strictEqual(new Set(fingerprints).size, fingerprints.length, 'hay layouts con la misma composición');
  assert.notStrictEqual(layouts.layoutFingerprint('__desconocido__'), layouts.layoutFingerprint('editorial'));
});

test('LayoutRegistry: ningún layout referencia bloques inexistentes', () => {
  assert.deepStrictEqual(layouts.findUnknownPreferredBlocks(), []);
});

test('LayoutRegistry: el layout cambia composición, no solo color', () => {
  const structures = new Set();
  for (const id of layouts.LAYOUT_IDS) {
    const definition = layouts.getLayout(id);
    structures.add(`${definition.structure.container}|${definition.grid.desktopColumns}|${definition.density}|${definition.textImageRelation}`);
  }
  assert.strictEqual(structures.size, layouts.LAYOUT_IDS.length, 'cada layout debe tener estructura propia');
});

// â”€â”€ Manifest: validación en backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('manifest: un manifest válido se acepta', () => {
  const result = manifest.validateTemplateManifest(validManifest());
  assert.strictEqual(result.valid, true, `errores: ${JSON.stringify(result.errors)}`);
});

test('manifest: se rechazan bloques inventados por el frontend', () => {
  const input = validManifest();
  input.sections[0].blocks[0].block = 'BloqueQueNoExiste';
  const result = manifest.validateTemplateManifest(input);
  assert.strictEqual(result.valid, false);
  assert.match(JSON.stringify(result.errors), /BlockRegistry/);
});

test('manifest: se rechazan layouts inventados', () => {
  const input = validManifest();
  input.layout = 'mismo-template-otro-color';
  assert.strictEqual(manifest.validateTemplateManifest(input).valid, false);
});

test('manifest: se rechazan capabilities inventadas', () => {
  const input = validManifest();
  input.capabilities = ['CAPACIDAD_FICTICIA'];
  assert.strictEqual(manifest.validateTemplateManifest(input).valid, false);
});

test('manifest: se rechazan rubros desconocidos', () => {
  const input = validManifest();
  input.businessCategory = 'RUBRO_INVENTADO';
  assert.strictEqual(manifest.validateTemplateManifest(input).valid, false);
});

test('manifest: se rechazan instanceId duplicados', () => {
  const input = validManifest();
  input.sections[1].blocks[0].instanceId = 'inicio-hero';
  const result = manifest.validateTemplateManifest(input);
  assert.strictEqual(result.valid, false);
  assert.match(JSON.stringify(result.errors), /duplicado/);
});

test('manifest: se rechazan ids de sección duplicados', () => {
  const input = validManifest();
  input.sections[1].id = 'inicio';
  assert.strictEqual(manifest.validateTemplateManifest(input).valid, false);
});

test('manifest: el backend valida los tipos, no confía en el JSON', () => {
  const input = validManifest();
  input.templateVersion = 'uno';
  assert.strictEqual(manifest.validateTemplateManifest(input).valid, false);
});

// â”€â”€ Versionado y compatibilidad â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('versionado: la versión actual es estable y exportada', () => {
  assert.strictEqual(manifest.CURRENT_MANIFEST_VERSION, 1);
  assert.strictEqual(manifest.SUPPORTED_MANIFEST_VERSION, 1);
});

test('versionado: un manifest sin manifestVersion no es compatible', () => {
  const input = validManifest();
  delete input.manifestVersion;
  const result = manifest.checkManifestCompatibility(input);
  assert.strictEqual(result.compatible, false);
  assert.match(result.reason, /versionado/);
});

test('versionado: un manifest del futuro se rechaza, no se adivina', () => {
  const input = validManifest();
  input.manifestVersion = 99;
  const result = manifest.checkManifestCompatibility(input);
  assert.strictEqual(result.compatible, false);
  assert.match(result.reason, /migraci/);
  assert.strictEqual(manifest.migrateManifest(input), null);
});

test('versionado: migrar un manifest válido lo devuelve en la versión actual', () => {
  const migrated = manifest.migrateManifest(validManifest());
  assert.ok(migrated);
  assert.strictEqual(migrated.manifestVersion, 1);
});

// â”€â”€ Compatibilidad legacy (los 97 templates V3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('legacy: el manifest de compatibilidad se marca legacy y conserva el código V3', () => {
  const built = siteInstance.legacyTemplateManifest({ code: 'flowers_01', name: 'Floristería', category: 'FLOWERS', capabilities: ['CATALOG'] });
  assert.strictEqual(built.legacy, true);
  assert.strictEqual(built.legacyTemplateCode, 'FLOWERS_01');
  assert.strictEqual(siteInstance.requiresLegacyRenderer(built), true);
  assert.strictEqual(siteInstance.legacyCodeOf(built), 'FLOWERS_01');
});

test('legacy: un manifest V2 no se confunde con uno legacy', () => {
  assert.strictEqual(siteInstance.requiresLegacyRenderer(validManifest()), false);
  assert.strictEqual(siteInstance.legacyCodeOf(validManifest()), null);
});

test('legacy: los templates V3 siguen renderizando por la vía de compatibilidad', () => {
  const legacyCodes = ['HAIR_01', 'BARBER_01', 'BAKERY_04', 'FLOWERS_01', 'REAL_ESTATE_04', 'FOOD_01', 'BOUTIQUE_01', 'PHOTO_01', 'PRO_01', 'PET_SIGNATURE_EDITORIAL'];
  for (const code of legacyCodes) {
    const built = siteInstance.legacyTemplateManifest({ code, name: code, category: 'HAIR' });
    const plan = engine.resolveRenderPlan(built);
    assert.strictEqual(plan.legacy, true, `${code} debe seguir por la vía legacy`);
    assert.strictEqual(plan.legacyTemplateCode, code.toUpperCase());
    assert.strictEqual(plan.layout, null, 'un manifest legacy no decide composición V2');
  }
});

test('legacy: un negocio V3 obtiene instancia sin tocar su template', () => {
  const master = siteInstance.legacyTemplateManifest({ code: 'BAKERY_01', name: 'Panadería', category: 'BAKERY' });
  const result = siteInstance.createSiteInstance({ masterManifest: master, businessCategory: 'BAKERY', instanceId: 'site-b1' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.manifest.legacy, true);
  assert.strictEqual(result.manifest.legacyTemplateCode, 'BAKERY_01');
});

// â”€â”€ template â†’ site instance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('instancia: se crea una instancia independiente desde el master', () => {
  const created = siteInstance.createSiteInstance({ masterManifest: validManifest(), businessCategory: 'BARBER', instanceId: 'site-abc' });
  assert.strictEqual(created.ok, true, `errores: ${JSON.stringify(created.errors)}`);
  assert.strictEqual(created.manifest.templateId, 'site-abc');
  assert.strictEqual(created.manifest.businessCategory, 'BARBER');
});

test('instancia: la copia es profunda, no una referencia al master', () => {
  const master = validManifest();
  const created = siteInstance.createSiteInstance({ masterManifest: master, businessCategory: 'BARBER', instanceId: 'site-deep' });
  created.manifest.sections[0].blocks[0].config.headline = 'CAMBIADO';
  assert.strictEqual(master.sections[0].blocks[0].config.headline, 'Barbería', 'el master no debe cambiar nunca');
});

// â”€â”€ Aislamiento entre instancias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('aislamiento: modificar una instancia NO toca el master ni a otra instancia', () => {
  const master = validManifest();
  const a = siteInstance.createSiteInstance({ masterManifest: master, businessCategory: 'BARBER', instanceId: 'site-a' });
  const b = siteInstance.createSiteInstance({ masterManifest: master, businessCategory: 'BARBER', instanceId: 'site-b' });
  a.manifest.sections[0].blocks[0].config.headline = 'Barbería A';
  b.manifest.sections[0].blocks[0].config.headline = 'Barbería B';
  assert.strictEqual(a.manifest.sections[0].blocks[0].config.headline, 'Barbería A');
  assert.strictEqual(b.manifest.sections[0].blocks[0].config.headline, 'Barbería B');
  assert.strictEqual(master.sections[0].blocks[0].config.headline, 'Barbería', 'el master queda intacto');
  assert.notStrictEqual(a.manifest.sections, b.manifest.sections);
  assert.notStrictEqual(a.manifest.sections[0].blocks, b.manifest.sections[0].blocks);
});

test('aislamiento: los overrides solo tocan config, orden y visibilidad', () => {
  const created = siteInstance.createSiteInstance({ masterManifest: validManifest(), businessCategory: 'BARBER', instanceId: 'site-ov' });
  const next = siteInstance.applyOverrides(created.manifest, { sections: { inicio: { hidden: true, blocks: { 'inicio-hero': { config: { headline: 'Nuevo' } } } } } });
  const section = next.sections.find((s) => s.id === 'inicio');
  assert.strictEqual(section.hidden, true);
  assert.strictEqual(section.blocks[0].config.headline, 'Nuevo');
  assert.strictEqual(section.blocks[0].block, 'Hero', 'la estructura es la identidad del diseño');
  assert.strictEqual(created.manifest.sections.find((s) => s.id === 'inicio').hidden, false, 'el original no se muta');
});

// â”€â”€ Capacidades por rubro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('rubros: un rubro de servicio no ofrece propiedades, pero si productos', () => {
  assert.strictEqual(capabilities.blockAllowedForCategory('Properties', 'BARBER'), false);
  // FASE 4.1: servicios y productos son capacidades INDEPENDIENTES. Este test
  // antes afirmaba false y por eso una peluqueria no podia vender su catalogo
  // aunque el usuario lo hubiera agregado. La regla nueva es explicita.
  assert.strictEqual(capabilities.blockAllowedForCategory('Products', 'BARBER'), true,
    'un negocio de servicio puede vender productos: los bloques no son excluyentes entre si');
  assert.strictEqual(capabilities.blockAllowedForCategory('Services', 'BARBER'), true);
  assert.strictEqual(capabilities.blockAllowedForCategory('Booking', 'BARBER'), true);
});

test('rubros: un rubro de servicio declara productos entre sus capacidades', () => {
  const profile = capabilities.industryProfileOf('BARBER');
  assert.ok(profile.capabilities.includes('PRODUCTS'), 'el perfil del rubro debe admitir el catalogo');
  assert.ok(!profile.forbiddenBlocks.includes('Products'), 'el catalogo no puede estar prohibido en servicios');
});

test('rubros: una inmobiliaria no ofrece catálogo de productos', () => {
  assert.strictEqual(capabilities.blockAllowedForCategory('Properties', 'REAL_ESTATE'), true);
  assert.strictEqual(capabilities.blockAllowedForCategory('Products', 'REAL_ESTATE'), false);
  assert.strictEqual(capabilities.blockAllowedForCategory('Booking', 'REAL_ESTATE'), false);
});

test('rubros: la instancia descarta bloques irrelevantes para el rubro', () => {
  const master = validManifest();
  master.sections[1].blocks = [{ block: 'Properties', instanceId: 'x-prop' }];
  const created = siteInstance.createSiteInstance({ masterManifest: master, businessCategory: 'BARBER', instanceId: 'site-pelu' });
  assert.ok(created.removedBlocks.includes('Properties'), 'debe reportar el bloque removido');
  const used = created.manifest.sections.flatMap((s) => s.blocks.map((b) => b.block));
  assert.ok(!used.includes('Properties'), 'no debe quedar un bloque irrelevante');
});

test('rubros: la instancia se adapta al rubro canónico desde un alias legacy', () => {
  const created = siteInstance.createSiteInstance({ masterManifest: validManifest(), businessCategory: 'AUTO', instanceId: 'site-alias' });
  assert.strictEqual(created.manifest.businessCategory, 'MECHANIC', 'AUTO colapsa a MECHANIC');
});

// â”€â”€ Fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('fallback: sin manifest se cae a la vía de compatibilidad', () => {
  for (const input of [null, undefined, {}, 'texto', 42]) {
    assert.strictEqual(engine.resolveRenderPlan(input).legacy, true, `entrada inválida ${JSON.stringify(input)}`);
  }
});

test('fallback: un manifest de versión futura no se renderiza a medias', () => {
  const input = validManifest();
  input.manifestVersion = 99;
  const plan = engine.resolveRenderPlan(input);
  assert.strictEqual(plan.legacy, true);
  assert.strictEqual(plan.sections.length, 0);
  assert.match(plan.warnings.join(' '), /incompatible/i);
});

test('fallback: un layout desconocido cae a compatibilidad', () => {
  const input = validManifest();
  input.layout = 'no-existe';
  const plan = engine.resolveRenderPlan(input);
  assert.strictEqual(plan.legacy, true);
  assert.ok(plan.warnings.length > 0);
});

// â”€â”€ Render plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('render plan: compone las secciones del manifest en orden', () => {
  const plan = engine.resolveRenderPlan(validManifest());
  assert.strictEqual(plan.legacy, false);
  assert.strictEqual(plan.layout.id, 'dark-premium');
  assert.deepStrictEqual(plan.sections.map((s) => s.id), ['inicio', 'servicios', 'cierre']);
  assert.strictEqual(plan.sections[0].blocks[0].block.id, 'Hero');
});

test('render plan: los bloques ocultos se marcan, no se borran', () => {
  const input = validManifest();
  input.sections[0].blocks[0].hidden = true;
  const plan = engine.resolveRenderPlan(input);
  assert.strictEqual(plan.sections[0].blocks[0].hidden, true);
  assert.strictEqual(plan.sections.length, 3, 'la sección sigue existiendo');
});

test('render plan: un bloque desconocido se ignora sin romper el sitio', () => {
  const input = validManifest();
  input.sections[0].blocks.push({ block: 'Inventado', instanceId: 'x', config: {} });
  const plan = engine.resolveRenderPlan(input);
  assert.ok(plan.warnings.some((w) => w.includes('Inventado')));
  assert.strictEqual(plan.sections[0].blocks.length, 1);
});

test('render plan: la firma cambia cuando cambia el diseño', () => {
  const before = engine.renderPlanSignature(engine.resolveRenderPlan(validManifest()));
  const changed = validManifest();
  changed.layout = 'bento';
  assert.notStrictEqual(before, engine.renderPlanSignature(engine.resolveRenderPlan(changed)));
});

// â”€â”€ Renderer único â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('renderer único: el motor no contiene JSX ni importa React', () => {
  const dir = path.join(__dirname, '../src/template-engine');
  for (const file of fs.readdirSync(dir)) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(!/from 'react'/.test(source), `${file} no debe importar react: el motor no renderiza`);
    assert.ok(!source.includes('<div'), `${file} no debe contener JSX: el motor solo resuelve el plan`);
  }
});

test('renderer único: existe UN solo renderer de página de negocio', () => {
  const root = path.join(__dirname, '../../frontend/src');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  const renderers = files.filter((file) => /export default function \w*Renderer\w*/.test(fs.readFileSync(file, 'utf8')));
  assert.strictEqual(renderers.length, 1, 'debe existir exactamente un renderer de página de negocio');
  assert.ok(renderers[0].endsWith('BusinessPageRenderer.tsx'), 'el renderer único es BusinessPageRenderer');
});

test('renderer único: el renderer conserva la vía V3 y monta el motor V2', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/BusinessPageRenderer.tsx'), 'utf8');
  assert.ok(source.includes('TemplateEngineV2'), 'el renderer único debe montar el motor V2');
  assert.ok(source.includes('hasDedicatedTemplate'), 'debe conservar la vía V3');
  assert.ok(source.includes('resolveTemplate'), 'debe conservar los templates legacy');
});

test('renderer único: el motor V2 no es un renderer alternativo', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/engine/TemplateEngineV2.tsx'), 'utf8');
  assert.ok(!/export default/.test(source), 'el motor V2 no es un renderer alternativo');
});

// â”€â”€ Paridad frontend/backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('paridad: el frontend replica exactamente los ids del backend', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/engine/registries.ts'), 'utf8');
  for (const id of blocks.BLOCK_IDS) assert.ok(frontend.includes(`'${id}'`), `el frontend no replica el bloque ${id}`);
  for (const id of layouts.LAYOUT_IDS) assert.ok(frontend.includes(`'${id}'`), `el frontend no replica el layout ${id}`);
});

test('paridad: el frontend implementa un renderer para cada bloque', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/engine/blocks.tsx'), 'utf8');
  const map = source.slice(source.indexOf('export const BLOCK_RENDERERS'));
  for (const id of blocks.BLOCK_IDS) {
    assert.ok(new RegExp(`(^|[\\s,{])${id}[,:\\s}]`, 'm').test(map), `el bloque ${id} no tiene renderer: sería funcionalidad falsa`);
  }
});

test('paridad: la versión de manifest coincide en backend y frontend', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/engine/registries.ts'), 'utf8');
  assert.ok(frontend.includes(`CURRENT_MANIFEST_VERSION = ${manifest.CURRENT_MANIFEST_VERSION}`));
});

test('video: el reproductor del frontend respeta poster, autoplay y reduced-motion', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/engine/BusinessVideo.tsx'), 'utf8');
  assert.ok(source.includes('prefers-reduced-motion'), 'debe respetar movimiento reducido');
  assert.ok(source.includes('poster'), 'debe mostrar el poster');
  assert.ok(source.includes('muted'), 'el autoplay exige muted');
  assert.ok(source.includes('posterOnlyOnMobile'), 'debe tener fallback para mobile');
  assert.ok(source.includes('onUnavailable'), 'debe reportar cuando el video no se puede reproducir');
});

// â”€â”€ Persistencia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('persistencia: el schema agrega las tablas V2', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  for (const model of ['model BusinessTemplateVersion', 'model BusinessSiteInstance', 'model BusinessSiteRevision', 'model BusinessMedia']) {
    assert.ok(schema.includes(model), `falta ${model}`);
  }
  assert.ok(schema.includes('templateVersions BusinessTemplateVersion[]'));
  assert.ok(schema.includes('siteInstance            BusinessSiteInstance?'));
  assert.ok(schema.includes('media                   BusinessMedia[]'));
});

test('persistencia: la migración V2 es aditiva (sin DROP ni borrados)', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260927090000_business_template_engine_v2/migration.sql'), 'utf8');
  // Se ignoran los comentarios: el SQL ejecutable es el que no puede destruir.
  const sql = raw.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  assert.ok(!/\bDROP\b/i.test(sql), 'la migración no puede hacer DROP');
  assert.ok(!/\bTRUNCATE\b/i.test(sql), 'la migración no puede truncar');
  assert.ok(!/DELETE\s+FROM/i.test(sql), 'la migración no puede borrar datos');
  assert.ok(!/ALTER\s+TABLE\s+\S+\s+ALTER\s+COLUMN/i.test(sql), 'la migración no puede alterar columnas existentes');
  for (const table of ['business_template_versions', 'business_site_instances', 'business_site_revisions', 'business_media']) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS "${table}"`), `falta la tabla ${table}`);
  }
});

test('persistencia: la migración de Fase 2 sigue intacta (compatibilidad V3)', () => {
  const phase2 = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260926090000_business_v5_fase2_ux_foundation/migration.sql'), 'utf8');
  assert.ok(phase2.includes('"style"'), 'la migración de fase 2 sigue agregando style');
  assert.ok(phase2.includes('"legacy"'), 'la migración de fase 2 sigue agregando legacy');
  assert.ok(!/DROP/i.test(phase2), 'la migración de fase 2 nunca fue destructiva');
});

test('persistencia: la instancia guarda historial y versión de template', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  assert.match(schema, /revisions\s+BusinessSiteRevision\[\]/, 'debe guardar revisiones');
  assert.ok(schema.includes('templateVersionId'), 'debe apuntar a la versión del template que eligió');
  assert.ok(schema.includes('legacyCompatibility'), 'debe registrar si usa compatibilidad V3');
});

test('persistencia: la migración V2 no toca el enum de categorías', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260927090000_business_template_engine_v2/migration.sql'), 'utf8');
  const sql = raw.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  assert.ok(!/BusinessCategoryCode/i.test(sql), 'no debe tocar el enum de categorías');
});

test('persistencia: los 97 templates V3 siguen soportados por la taxonomía', () => {
  const taxonomy = require('../src/utils/business-taxonomy.ts');
  assert.strictEqual(typeof taxonomy.isLegacyTemplate, 'function');
  assert.strictEqual(taxonomy.isLegacyTemplate({ code: 'FLOWERS_01', legacy: true }), true);
  assert.strictEqual(taxonomy.isLegacyTemplate({ code: 'FLOWERS_01', legacy: false }), false);
});

// â”€â”€ API del motor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('API: el motor valida el manifest en backend con ownership', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/template-engine.routes.ts'), 'utf8');
  assert.ok(routes.includes("router.post('/manifest/validate'"));
  assert.ok(routes.includes('validateTemplateManifest'), 'el backend valida, no el frontend');
  assert.ok(routes.includes("router.get('/registries'"));
  assert.ok(routes.includes("router.get('/industries/:category'"));
  assert.ok(routes.includes("router.post('/:id/site-instance'"));
  assert.ok(routes.includes('requireBusinessOwner'), 'las rutas de instancia exigen propiedad');
});

test('API: crear la instancia es idempotente y cada cambio abre una revisión', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/template-engine.routes.ts'), 'utf8');
  assert.ok(routes.includes('if (business.siteInstance)'), 'no debe recrear una instancia existente');
  assert.ok(routes.includes('businessSiteRevision.create'), 'cada cambio debe abrir una revisión');
});

test('API: las rutas del motor no reemplazan a las rutas V3 de negocio', () => {
  const indexRoutes = fs.readFileSync(path.join(__dirname, '../src/routes/index.ts'), 'utf8');
  assert.ok(indexRoutes.includes("router.use('/template-engine', templateEngineRoutes)"));
  assert.ok(indexRoutes.includes("router.use('/businesses', businessRoutes)"));
  assert.ok(indexRoutes.includes("router.use('/public/businesses', publicBusinessRoutes)"));
});

// â”€â”€ Barril â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('el motor se exporta por un único barril', () => {
  for (const symbol of ['BLOCK_DEFINITIONS', 'LAYOUT_DEFINITIONS', 'validateTemplateManifest', 'createSiteInstance', 'resolveRenderPlan', 'legacyTemplateManifest', 'industryProfileOf']) {
    assert.ok(index[symbol] !== undefined, `el barril debe exportar ${symbol}`);
  }
});
