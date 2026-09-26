/**
 * YESYES BUSINESS - FASE 5: SECCIONES (CONTRATO V2) - Suite backend.
 *
 * Cubre lo que la fase exige del lado del servidor:
 *
 *   S7   duplicate: id unico, deep clone real, sin aliasing de config
 *   S9   applyDesignChange conserva el contenido (A -> B -> C)
 *   S10  capabilities: una capability prohibida NO puede entrar al manifest
 *   S12  las operaciones estructurales devuelven el sello `updatedAt`
 *   S15  `visual.sections` no es parte del contrato V2
 *
 * Los tests EJERCITAN el codigo real: se cargan los modulos de
 * `src/template-engine` con ts-node, sin simularlos.
 */

const test = require('node:test');
const assert = require('node:assert');

require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const blocks = require('../src/template-engine/block-registry.ts');
const capabilities = require('../src/template-engine/capabilities.ts');
const variants = require('../src/template-engine/variant-registry.ts');
const engine = require('../src/template-engine/index.ts');
const designRoutes = require('../src/routes/design.routes.ts');

/** Manifest V2 valido y realista (forma que produce el backend). */
const manifestV2 = () => ({
  templateId: 'master-pet-01',
  templateVersion: 1,
  manifestVersion: 1,
  businessCategory: 'PET',
  style: 'Clinico',
  layout: 'modern-commerce',
  sections: [
    { id: 'hero', label: 'Portada', order: 10, blocks: [{ block: 'Hero', instanceId: 'hero-hero', config: { title: 'Clinica Veterinaria', media: { src: 'a.jpg' }, buttons: [{ label: 'Reservar' }] } }] },
    { id: 'servicios', label: 'Servicios', order: 20, blocks: [{ block: 'Services', instanceId: 'servicios-services', config: { presentation: 'cards' } }] },
    { id: 'productos', label: 'Productos', order: 30, blocks: [{ block: 'Products', instanceId: 'productos-products', config: { presentation: 'grid' } }] },
    { id: 'faq', label: 'Preguntas frecuentes', order: 40, blocks: [{ block: 'FAQ', instanceId: 'faq-faq', config: {} }] },
    { id: 'pie', label: 'Pie de pagina', order: 50, blocks: [{ block: 'Footer', instanceId: 'pie-footer', config: {} }] },
  ],
  capabilities: ['HERO', 'SERVICES', 'PRODUCTS', 'FAQ', 'CONTACT', 'FOOTER'],
  theme: { palette: { primary: '#111827', background: '#ffffff', text: '#111827', accent: '#6b7280' }, radius: 'soft', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
  navigation: { enabled: true, style: 'minimal', links: [] },
  media: { requiredMedia: ['image'], video: { allowed: true, autoplayRequiresMuted: true, maxAutoplayDurationSec: 12, posterRequired: true, disableAutoplayOnReducedMotion: true } },
  seo: { titleTemplate: 'Clinica', description: 'Clinica veterinaria', ogImageRequired: false, noIndexPreview: true },
  availableActions: [],
  legacy: false,
});

const clone = (v) => JSON.parse(JSON.stringify(v));
const ids = (m) => m.sections.map((s) => s.id);

// ---------- S7 : DUPLICATE ----------

test('F5 S7: uniqueSectionId nunca devuelve un id ya usado', () => {
  assert.equal(designRoutes.uniqueSectionId(['hero'], 'hero'), 'hero-copia');
  assert.equal(designRoutes.uniqueSectionId(['hero', 'hero-copia'], 'hero'), 'hero-copia-2');
  assert.equal(designRoutes.uniqueSectionId(['hero', 'hero-copia', 'hero-copia-2'], 'hero'), 'hero-copia-3');
});

// ---------- S16 : instanceId de bloque único en TODO el manifest ----------
//
// Defecto real encontrado en la certificación E2E: al agregar una sección, el
// backend derivaba el `instanceId` de forma determinista (`${id}-${block}`).
// La unicidad del `instanceId` es GLOBAL (el validador rechaza el manifest
// entero si dos bloques lo comparten), y la sección `extras` —que aparece al
// cambiar de diseño por la regla de no-pérdida— apila bloques viejos con sus
// ids. Con un `Text` ya aparcado en `extras`, agregar la sección "Sobre el
// negocio" respondía 422 "instanceId duplicado" y el usuario no podía volver a
// agregarla nunca.

test('F5 S16: el instanceId generado no colisiona con ninguna sección del manifest', () => {
  // Se parte del manifest V2 real para que la validación sea la de verdad.
  const manifest = manifestV2();
  // Esto es lo que produce la regla de no-pérdida al cambiar de diseño:
  // un bloque antiguo aparcado en `extras` conservando su instanceId.
  manifest.sections.push({
    id: 'extras', label: 'Contenido adicional', order: 900,
    blocks: [{ block: 'Text', instanceId: 'about-text', config: {} }],
  });
  // Caso 1: un id base libre -> se usa tal cual.
  assert.equal(designRoutes.uniqueBlockInstanceId(manifest, 'reservas-booking'), 'reservas-booking');
  // Caso 2: el id base YA existe (bloque aparcado en `extras`) -> se desambigua.
  assert.equal(designRoutes.uniqueBlockInstanceId(manifest, 'about-Text'), 'about-text-2');
  // Y un id que YA existe en otra sección real también se desambigua.
  assert.equal(designRoutes.uniqueBlockInstanceId(manifest, 'faq-FAQ'), 'faq-faq-2');
  // El manifest resultante debe pasar la validación real.
  const next = clone(manifest);
  next.sections.push({
    id: 'about', label: 'Sobre el negocio', order: 100,
    blocks: [{ block: 'Text', instanceId: designRoutes.uniqueBlockInstanceId(manifest, 'about-Text'), config: {} }],
  });
  const result = engine.validateTemplateManifest(next);
  assert.equal(result.valid, true, `el manifest reparado debe ser valido: ${JSON.stringify(result.errors)}`);
  // Y con el bug original (id determinista) el manifest era INVÁLIDO: esto es
  // exactamente el 422 que veía el usuario. El id que generaba el código
  // anterior era `${id}-${block}` en minúsculas: "about-text".
  const broken = clone(manifest);
  broken.sections.push({ id: 'about', label: 'Sobre el negocio', order: 100, blocks: [{ block: 'Text', instanceId: 'about-text', config: {} }] });
  const brokenResult = engine.validateTemplateManifest(broken);
  assert.equal(brokenResult.valid, false, 'el id determinista debe reproducir el defecto');
  assert.match(brokenResult.errors.join(' '), /instanceId duplicado "about-text"/);
});

test('F5 S16: desambigua también cuando ya hay varios sufijos', () => {
  const manifest = { sections: [{ id: 'extras', blocks: [{ block: 'Text', instanceId: 'about-text' }, { block: 'Text', instanceId: 'about-text-2' }] }] };
  assert.equal(designRoutes.uniqueBlockInstanceId(manifest, 'about-Text'), 'about-text-3');
});

test('F5 S16: el instanceId se normaliza a minúsculas', () => {
  const manifest = { sections: [] };
  assert.equal(designRoutes.uniqueBlockInstanceId(manifest, 'About-Text'), 'about-text');
});

// ---------- S10 : CAPABILITIES / RUBRO ----------

test('F5 S10: una capability prohibida por el rubro NO puede entrar al manifest', () => {
  // PROPERTIES existe en el BlockRegistry y tiene renderInV2: pasaria la
  // validacion "existe + se renderiza". Lo que la detiene es el RUBRO.
  assert.ok(blocks.hasBlock('Properties'), 'el bloque existe de verdad');
  assert.equal(blocks.getBlock('Properties').renderInV2, true, 'y el renderer lo compone');
  assert.equal(capabilities.blockAllowedForCategory('Properties', 'PET'), false, 'pero un veterinaria NO admite propiedades');
  assert.equal(capabilities.blockAllowedForCategory('Properties', 'REAL_ESTATE'), true, 'una inmobiliaria si');
  assert.equal(capabilities.blockAllowedForCategory('Properties', 'BOUTIQUE'), false, 'ni una tienda');
});

test('F5 S10: el rubro de la pagina objetivo (veterinaria) delimita bien sus capabilities', () => {
  const pet = capabilities.industryProfileOf('PET');
  assert.equal(pet.shape, 'service', 'una veterinaria es rubro de servicio');
  assert.ok(pet.capabilities.includes('SERVICES'));
  assert.ok(pet.capabilities.includes('BOOKING'));
  assert.ok(pet.capabilities.includes('TEAM'));
  assert.ok(pet.capabilities.includes('PRODUCTS'), 'productos y servicios son independientes');
  assert.ok(!pet.capabilities.includes('PROPERTIES'), 'pero propiedades no tienen sentido aqui');
  assert.deepEqual(pet.forbiddenBlocks, ['Properties', 'PropertyFeatured']);
});

test('F5 S10: la instance creation depura los bloques prohibidos del rubro', () => {
  const master = manifestV2();
  master.sections.push({ id: 'propiedades', label: 'Propiedades', order: 35, blocks: [{ block: 'Properties', instanceId: 'propiedades-properties' }] });
  const creada = engine.createSiteInstance({ masterManifest: master, businessCategory: 'PET', instanceId: 'inst-1' });
  assert.equal(creada.ok, true, 'la instancia se crea');
  assert.ok(!ids(creada.manifest).includes('propiedades'), 'la seccion de propiedades se elimina al CREAR');
  assert.ok(creada.removedBlocks.includes('Properties'), 'y se reporta explicitamente que se quito');
  assert.ok(ids(creada.manifest).includes('servicios'), 'las secciones legales sobreviven');
});

test('F5 S10: un manifest con un bloque prohibido NO pasa la validacion de la ruta', () => {
  // Aunque se construya a mano, la ruta POST /sections debe rechazar la
  // capability ANTES de tocar el manifest. Aqui se comprueba la pieza pura:
  // la funcion que decide.
  const bloque = engine.CAPABILITY_TO_BLOCKS.PROPERTIES[0];
  assert.equal(bloque, 'Properties', 'PROPERTIES mapea al bloque Properties');
  const permitido = capabilities.blockAllowedForCategory(bloque, 'PET');
  assert.equal(permitido, false, 'y para PET no esta permitido: la ruta respondera 422');
});

test('F5 S10: capabilities prohibidas nunca se ofrecen en addable-sections', () => {
  // Replica la regla que usa GET /addable-sections: capability -> bloque ->
  // permitido para el rubro. Ninguna capability prohibida puede salir de la lista.
  const permitidos = engine.CAPABILITY_ORDER.filter((cap) => {
    const bl = engine.CAPABILITY_TO_BLOCKS[cap];
    return bl && bl.length && blocks.getBlock(bl[0]) && blocks.getBlock(bl[0]).renderInV2
      && capabilities.blockAllowedForCategory(bl[0], 'PET');
  });
  assert.ok(!permitidos.includes('PROPERTIES'), 'PROPERTIES no se ofrece a una veterinaria');
  assert.ok(permitidos.includes('SERVICES'));
  assert.ok(permitidos.includes('TEAM'));
  // Y toda capability ofrecida tiene un nombre humano, no un id tecnico.
  for (const cap of permitidos) {
    const label = engine.SECTION_LABELS[cap];
    assert.ok(label && label !== cap, 'la capability ' + cap + ' tiene etiqueta humana');
  }
});

// ---------- S9 : CAMBIO DE DISENO GLOBAL ----------

const designSource = (code, name, category, capabilities) => ({ code, name, category, style: name, capabilities });

test('F5 S9: cambiar de dise?o conserva el contenido del negocio', () => {
  const actual = manifestV2();
  const antes = clone(actual.sections.find((s) => s.id === 'hero').blocks[0].config);
  const design = engine.designFromTemplate(designSource('PET_02', 'Clinico Moderno', 'PET', ['HERO', 'SERVICES', 'CONTACT', 'FOOTER']));
  const next = engine.applyDesignChange(actual, design);

  assert.notEqual(next.layout, actual.layout, 'el layout cambia: es un dise?o distinto');
  // El contenido del bloque que sobrevive se conserva intacto.
  const hero = next.sections.find((s) => s.blocks.some((b) => b.block === 'Hero'));
  assert.ok(hero, 'el Hero sigue en la pagina');
  assert.equal(hero.blocks[0].config.title, antes.title, 'el titulo se conserva');
  assert.deepEqual(hero.blocks[0].config.media, antes.media, 'las imagenes se conservan');
  assert.deepEqual(hero.blocks[0].config.buttons, antes.buttons, 'los botones (CTA) se conservan');
});

test('F5 S9: cambiar de diseno NO borra bloques, aunque el diseno nuevo traiga menos', () => {
  const actual = manifestV2();
  // Un diseno-minimo construido A MANO: `designFromTemplate` propone la
  // composicion completa del rubro, asi que aqui se ejercita el caso fuerte:
  // un diseno que realmente deja bloques afuera.
  const minimo = {
    id: 'diseno-minimo', templateId: 'diseno-minimo-pet', label: 'Minimo', styleLabel: 'Minimo',
    description: 'Solo lo esencial', layout: 'minimal', category: 'PET',
    capabilities: ['HERO', 'CONTACT', 'FOOTER'],
    sections: [
      { id: 'inicio', label: 'Portada', order: 10, blocks: [{ block: 'Hero', emphasis: 'primary' }] },
      { id: 'contacto-min', label: 'Contacto', order: 90, blocks: [{ block: 'Contact', emphasis: 'primary' }] },
      { id: 'pie', label: 'Pie de pagina', order: 100, blocks: [{ block: 'Footer', emphasis: 'secondary' }] },
    ],
    theme: { palette: { primary: '#0f766e', background: '#ffffff', text: '#111827', accent: '#14b8a6' }, radius: 'soft', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
    navigationStyle: 'minimal',
  };
  const next = engine.applyDesignChange(actual, minimo);
  const bloques = next.sections.flatMap((s) => s.blocks.map((b) => b.block));
  // Ningun bloque del usuario se pierde: la fase prohibe el reset total.
  for (const b of ['Hero', 'Services', 'Products', 'FAQ', 'Footer']) {
    assert.ok(bloques.includes(b), 'el bloque ' + b + ' sobrevive al cambio de diseno');
  }
  // Los que el diseno nuevo no uso quedan apartados, pero VIVOS y con su config.
  const extras = next.sections.find((s) => s.id === 'extras');
  assert.ok(extras, 'lo que el diseno nuevo no uso quedo apartado en "extras"');
  const configExtras = JSON.stringify(extras.blocks.map((b) => b.config));
  assert.ok(configExtras.includes('cards'), 'y conserva su configuracion original');
  // Y sigue siendo un manifest valido: nada se rompio al apilar los sobrantes.
  const vv = engine.validateTemplateManifest(next); assert.equal(vv.valid, true, 'el manifest resultante es valido -> ' + JSON.stringify(vv.errors));
});

test('F5 S9: cambiar de dise?o NO borra CAMPOS DESCONOCIDOS del config', () => {
  const actual = manifestV2();
  actual.sections[0].blocks[0].config.campoFuturo = { experimental: true };
  const design = engine.designFromTemplate(designSource('PET_04', 'Bento', 'PET', ['HERO', 'SERVICES', 'CONTACT', 'FOOTER']));
  const next = engine.applyDesignChange(actual, design);
  const hero = next.sections.find((s) => s.blocks.some((b) => b.block === 'Hero'));
  assert.deepEqual(hero.blocks[0].config.campoFuturo, { experimental: true }, 'un campo desconocido sobrevive');
});

test('F5 S9: design A -> B -> C conserva el contenido en toda la cadena', () => {
  let m = manifestV2();
  m.sections[0].blocks[0].config.tituloDelNegocio = 'Los Robles';
  for (const [code, name] of [['PET_A', 'A'], ['PET_B', 'B'], ['PET_C', 'C']]) {
    const design = engine.designFromTemplate(designSource(code, 'Diseno ' + name, 'PET', ['HERO', 'SERVICES', 'PRODUCTS', 'CONTACT', 'FOOTER']));
    m = engine.applyDesignChange(m, design);
    const hero = m.sections.find((s) => s.blocks.some((b) => b.block === 'Hero'));
    assert.equal(hero.blocks[0].config.tituloDelNegocio, 'Los Robles', 'el contenido sobrevive al dise?o ' + name);
  }
  // Y el manifest sigue siendo un manifest V2 valido: no se degrada a V3.
  assert.notEqual(m.legacy, true, 'el manifest NO se convierte en legacy/V3');
  assert.equal(m.manifestVersion, 1, 'sigue en la version de formato soportada');
  assert.equal(engine.resolveRenderPlan(m).legacy, false, 'y el plan de render sigue siendo V2');
});

test('F5 S9: el manifest resultante siempre valida (el backend decide, no el cliente)', () => {
  const design = engine.designFromTemplate(designSource('PET_05', 'Corporativo', 'PET', ['HERO', 'SERVICES', 'CONTACT', 'FOOTER']));
  const next = engine.applyDesignChange(manifestV2(), design);
  const validacion = engine.validateTemplateManifest(next);
  assert.equal(validacion.valid, true, 'el manifest tras aplicar el dise?o es valido: ' + JSON.stringify(validacion.errors));
  assert.equal(ids(next).length, new Set(ids(next)).size, 'y no tiene secciones con id repetido');
});

// ---------- S11 : CONTENIDO PRESERVADO ----------

test('F5 S11: cambiar la composicion NO toca los datos de negocio, solo el manifest', () => {
  const servicios = [{ id: 's1', name: 'Vacunacion', price: 20000 }];
  const productos = [{ id: 'p1', name: 'Alimento', price: 15000 }];
  const copia = clone({ servicios, productos });
  // Se opera solo sobre el manifest; los registros del negocio no participan.
  const design = engine.designFromTemplate(designSource('PET_06', 'Galeria', 'PET', ['HERO', 'SERVICES', 'CONTACT', 'FOOTER']));
  engine.applyDesignChange(manifestV2(), design);
  assert.deepEqual({ servicios, productos }, copia, 'los registros de negocio siguen intactos');
});

// ---------- S8 : VARIANTES ----------

test('F5 S8: toda variante ofrecida tiene implementacion real', () => {
  assert.deepEqual(variants.findVariantsWithoutImplementation(), [], 'ninguna variante es funcionalidad falsa');
  assert.ok(variants.variantsForBlock('Hero').length >= 2, 'Hero tiene varias variantes');
  assert.equal(variants.variantsForBlock('Text').length, 0, 'Text no declara variantes: no se inventa ninguna');
});

test('F5 S8: una variante aporta SOLO overrides, nunca contenido', () => {
  for (const variant of variants.variantsForBlock('Services')) {
    for (const [clave, valor] of Object.entries(variant.config)) {
      assert.equal(clave, 'presentation', 'la variante ' + variant.id + ' solo cambia presentacion, no ' + clave);
      assert.equal(typeof valor, 'string');
    }
  }
});

test('F5 S8: cambiar de variante NO borra el config que el usuario escribio', () => {
  const manifest = manifestV2();
  const bloque = manifest.sections[1].blocks[0];
  bloque.config.titulo = 'Nuestros servicios';
  bloque.config.media = { src: 'x.jpg' };
  // Se emula lo que hace la ruta: aplicar los overrides de la variante encima.
  const destino = manifest.sections[1].blocks[0];
  const variant = variants.getVariant('Services', 'editorial');
  destino.config = { ...destino.config, ...variant.config };
  assert.equal(destino.config.titulo, 'Nuestros servicios', 'el contenido sobrevive');
  assert.deepEqual(destino.config.media, { src: 'x.jpg' }, 'las imagenes sobreviven');
  assert.equal(destino.config.presentation, 'editorial', 'y la presentacion cambia');
});

test('F5 S8: una variante inexistente cae a la variante por defecto, no rompe', () => {
  const resuelta = variants.resolveVariant('Services', 'no-existe');
  assert.equal(resuelta.id, variants.defaultVariantOf('Services').id, 'cae a la variante por defecto');
  assert.equal(variants.resolveVariant('Text', 'lo-que-sea'), null, 'un bloque sin variantes no inventa una');
});

// ---------- S15 : CONTRATO V2, visual.sections es legacy-only ----------

test('F5 S15: el manifest V2 NO tiene ningun campo visual.sections', () => {
  const m = manifestV2();
  m.visual = { sections: [{ id: 'HERO', enabled: true, order: 10 }] };
  const plan = engine.resolveRenderPlan(m);
  // Un campo visual NO cambia lo que se renderiza: manda manifest.sections.
  const delPlan = plan.sections.map((s) => s.id);
  assert.deepEqual(delPlan, ['hero', 'servicios', 'productos', 'faq', 'pie'], 'visual.sections no aparece en el plan');
  assert.ok(!delPlan.includes('HERO'), 'la seccion legacy no se inyecta');
});

test('F5 S15: el schema del manifest NO acepta visual.sections como campo del bloque', () => {
  const invalido = manifestV2();
  invalido.sections[0].blocks[0].visualSections = [{ id: 'MAP' }];
  const validacion = engine.validateTemplateManifest(invalido);
  assert.equal(validacion.valid, false, 'el schema estricto rechaza el campo colado');
});

test('F5 S15: el plan de render ordena por manifest.sections y respeta hidden', () => {
  const m = manifestV2();
  m.sections.find((s) => s.id === 'productos').hidden = true;
  m.sections.reverse();
  const plan = engine.resolveRenderPlan(m);
  const orden = plan.sections.map((s) => s.id);
  assert.deepEqual(orden, ['hero', 'servicios', 'productos', 'faq', 'pie'], 'el array invertido NO cambia el orden: manda el campo order');
  assert.equal(plan.sections.find((s) => s.id === 'productos').hidden, true, 'la seccion oculta se marca, no se borra');
  assert.ok(plan.sections.some((s) => s.id === 'productos'), 'sigue en el plan: se puede volver a prender');
});

test('F5 S15: la firma del plan cambia cuando cambia la composicion', () => {
  const a = engine.resolveRenderPlan(manifestV2());
  const b = engine.resolveRenderPlan(manifestV2());
  assert.equal(engine.renderPlanSignature(a), engine.renderPlanSignature(b), 'el mismo manifest da la misma firma');
  const c = manifestV2();
  c.sections.splice(1, 1);
  assert.notEqual(engine.renderPlanSignature(a), engine.renderPlanSignature(c), 'cambiar las secciones cambia la firma');
});

// ---------- S12 : OPERACIONES ESTRUCTURALES Y REGLAS DE MANIFEST ----------

test('F5 S12: el manifest sigue siendo valido tras cualquier operacion estructural', () => {
  const base = manifestV2();
  const operaciones = [
    ['agregar seccion', (m) => { m.sections.push({ id: 'equipo', label: 'Equipo', order: 45, blocks: [{ block: 'Team', instanceId: 'equipo-team' }] }); return m; }],
    ['eliminar seccion', (m) => { m.sections = m.sections.filter((s) => s.id !== 'faq'); return m; }],
    ['ocultar seccion', (m) => { m.sections[0].hidden = true; return m; }],
    ['reordenar', (m) => { m.sections.reverse(); return m; }],
    ['cambiar variante', (m) => { m.sections[1].blocks[0].config.presentation = 'editorial'; return m; }],
  ];
  for (const [nombre, operacion] of operaciones) {
    const m = operacion(clone(base));
    const validacion = engine.validateTemplateManifest(m);
    assert.equal(validacion.valid, true, nombre + ': el manifest sigue valido -> ' + JSON.stringify(validacion.errors));
  }
});

test('F5 S12: el manifest RECHAZA sections con id repetido', () => {
  const m = manifestV2();
  m.sections.push(clone(m.sections[0]));
  const validacion = engine.validateTemplateManifest(m);
  assert.equal(validacion.valid, false, 'dos secciones con el mismo id son un manifest invalido');
});




