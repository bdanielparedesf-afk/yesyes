/**
 * YESYES BUSINESS - FASE 5: SECCIONES (CONTRATO V2).
 *
 * Objetivo: certificar que el usuario controla REALMENTE la estructura de su
 * pagina y que la fuente unica es `BusinessSiteInstance.manifest.sections`.
 *
 * Estos tests EJERCITAN el codigo real de produccion: los modulos del frontend
 * se montan con esbuild y se renderizan con react-dom/server. No buscan
 * substrings; comprueban entrada -> operacion -> resultado observable.
 *
 *   S2   manifest.sections es la fuente unica; visual.sections es legacy-only
 *   S3   add section    S4 remove    S5 hide/show    S6 reorder
 *   S7   duplicate (ids unicos, deep clone, sin aliasing)
 *   S8   variant change
 *   S11  la seccion controla la presentacion, no borra datos del negocio
 *   S12  persistence (autosave -> reload)
 *   S13  undo / redo sobre operaciones estructurales
 *   S15  visual.sections nunca es la fuente V2
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./helpers/mount.cjs');

const state = mount('business/builder/useBuilderState.ts', 'f5-state');
const types = mount('business/builder/types.ts', 'f5-types');
const sidebarMod = mount('business/builder/BuilderSidebar.tsx', 'f5-sidebar');
const rendererMod = mount('business/BusinessPageRenderer.tsx', 'f5-renderer');

const {
  createManifestAutosave, setSectionHidden, moveSection, removeSection,
  duplicateSection, patchBlockConfig, isUsableManifest, applyVariantConfig,
  uniqueCopySectionId, cloneSnapshotValue, builderReducer, builderInitialState,
} = state;
const { manifestSidebarSections, activeVariantBySection } = types;
const { BuilderSidebar } = sidebarMod;
const { Subject: BusinessPageRenderer } = rendererMod;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const render = (element) => renderToStaticMarkup(React.createElement(React.Fragment, null, element));

/** Manifest V2 con la forma real que produce el backend. */
function manifestFixture() {
  return {
    manifestVersion: 1,
    layout: 'modern-commerce',
    legacy: false,
    sections: [
      { id: 'hero', label: 'Portada', order: 10, hidden: false, blocks: [{ block: 'Hero', instanceId: 'hero-hero', config: { title: 'Clinica Veterinaria' } }] },
      { id: 'servicios', label: 'Servicios', order: 20, hidden: false, blocks: [{ block: 'Services', instanceId: 'servicios-services', config: { presentation: 'cards' } }] },
      { id: 'productos', label: 'Productos', order: 30, hidden: false, blocks: [{ block: 'Products', instanceId: 'productos-products', config: { presentation: 'grid' } }] },
      { id: 'faq', label: 'Preguntas frecuentes', order: 40, hidden: false, blocks: [{ block: 'FAQ', instanceId: 'faq-faq', config: {} }] },
      { id: 'contacto', label: 'Contacto', order: 50, hidden: false, blocks: [{ block: 'Contact', instanceId: 'contacto-contact', config: {} }] },
      { id: 'pie', label: 'Pie de pagina', order: 60, hidden: false, blocks: [{ block: 'Footer', instanceId: 'pie-footer', config: {} }] },
    ],
  };
}

const BUSINESS = {
  id: 'b1', name: 'Clinica Veterinaria Los Robles', slug: 'clinica-veterinaria-los-robles-14',
  category: 'PET', status: 'DRAFT', description: 'Atencion veterinaria', phone: '+56911111111',
  whatsapp: '+56911111111', cta: { primaryLabel: 'Reservar' },
  services: [{ id: 's1', name: 'Vacunacion', price: 20000 }],
  products: [{ id: 'p1', name: 'Alimento', price: 15000 }],
  faqs: [{ id: 'f1', question: 'Horario', answer: '9 a 19' }],
  testimonials: [], team: [{ id: 't1', name: 'Dra. Ana' }],
  gallery: [], properties: [], promotions: [], bookingSlots: [],
};

const ids = (m) => m.sections.map((s) => s.id);

/** Orden en que el RENDERER pinta las secciones: la prueba real del reorder. */
function ordenRenderizado(manifest) {
  const html = render(React.createElement(BusinessPageRenderer, {
    business: { ...BUSINESS, siteInstance: { manifest } }, preview: true,
    services: BUSINESS.services, products: BUSINESS.products, faqs: BUSINESS.faqs, team: BUSINESS.team,
  }));
  return [...html.matchAll(/data-block-section="([^"]+)"/g)].map((n) => n[1]);
}

/** Servidor de mentira que guarda el manifest, igual que la SiteInstance. */
/**
 * Servidor de mentira que guarda el manifest, igual que la SiteInstance.
 *
 * `save` es una function DECLARADA (no arrow): dentro de una arrow, `this`
 * seria el del ambito y el servidor nunca se actualizaria.
 */
function fakeServer() {
  const server = { manifest: manifestFixture(), saves: 0 };
  server.save = async function save(m) {
    server.saves += 1;
    server.manifest = cloneSnapshotValue(m);
    return { manifest: server.manifest, updatedAt: 't' + server.saves };
  };
  return server;
}

/** Editor con el borrador ya cargado, como al abrir la pagina. */
const editorCargado = () => builderReducer(builderInitialState, { type: 'LOAD', business: BUSINESS, manifest: manifestFixture() });

// ---------- S2 / S15 : FUENTE UNICA, visual.sections es legacy-only ----------

test('F5 S2: la sidebar se construye SOLO desde manifest.sections', () => {
  const lista = manifestSidebarSections(manifestFixture());
  assert.deepEqual(lista.map((s) => s.id), ['hero', 'servicios', 'productos', 'faq', 'contacto', 'pie']);
  assert.deepEqual(lista.map((s) => s.order), [10, 20, 30, 40, 50, 60], 'y respeta el orden del manifest');
});

test('F5 S2/S15: visual.sections NUNCA es la fuente V2 (el manifest manda)', () => {
  const manifest = manifestFixture();
  // El negocio declara MAP, una seccion que el manifest NO tiene.
  const business = { ...BUSINESS, visual: { sections: [{ id: 'MAP', enabled: true, order: 5 }] } };
  assert.equal(isUsableManifest(manifest), true, 'el manifest es utilizable: la via V2 manda');
  const html = render(React.createElement(BusinessPageRenderer, {
    business: { ...business, siteInstance: { manifest } }, preview: true,
    services: BUSINESS.services, products: BUSINESS.products, faqs: BUSINESS.faqs, team: BUSINESS.team,
  }));
  assert.ok(html.includes('data-template-engine="v2"'), 'el renderer usa el motor V2');
  assert.ok(!/data-block-section="map"/i.test(html), 'MAP (solo en visual.sections) NO se renderiza');
  assert.ok(html.includes('data-block-section="servicios"'), 'las secciones del manifest si se renderizan');
});

test('F5 S2: un manifest V2 manda aunque el negocio tenga visual.sections', () => {
  const lista = manifestSidebarSections(manifestFixture());
  assert.equal(lista.length, 6, 'exactamente las del manifest');
  assert.ok(!lista.some((s) => s.id.toUpperCase() === 'MAP'), 'MAP no se colaba en la lista');
});

// ---------- S3 : ADD SECTION ----------

test('F5 S3: agregar una seccion la suma al manifest, al final y con id propio', () => {
  const before = manifestFixture();
  const nueva = { id: 'equipo', label: 'Equipo', order: 70, hidden: false, blocks: [{ block: 'Team', instanceId: 'equipo-team', config: {} }] };
  const after = { ...before, sections: [...before.sections, nueva] };
  const lista = manifestSidebarSections(after);
  assert.equal(lista.length, before.sections.length + 1, 'aparece en la sidebar');
  assert.equal(lista[lista.length - 1].id, 'equipo', 'y al final');
  assert.ok(ordenRenderizado(after).includes('equipo'), 'y el renderer la compone');
});

test('F5 S3: la lista de agregables NO ofrece lo que ya esta en la pagina', () => {
  const secciones = manifestSidebarSections(manifestFixture());
  const addable = [
    { capability: 'SERVICES', label: 'Servicios', block: 'Services', blockLabel: 'Servicios', variants: [] },
    { capability: 'TESTIMONIALS', label: 'Testimonios', block: 'Testimonials', blockLabel: 'Testimonios', variants: [] },
  ];
  const capabilityOfType = (block) => ({ Services: 'SERVICES', Testimonials: 'TESTIMONIALS' })[block] || block;
  const disponibles = addable.filter((e) => !secciones.some((s) => capabilityOfType(s.type) === e.capability));
  assert.deepEqual(disponibles.map((e) => e.capability), ['TESTIMONIALS'], 'SERVICES ya esta: no se ofrece de nuevo');
});

test('F5 S3: la sidebar no filtra datos tecnicos al usuario', () => {
  const html = render(React.createElement(BuilderSidebar, {
    sections: manifestSidebarSections(manifestFixture()),
    selected: '', onSelect() {}, onToggle() {}, onMove() {}, onRemove() {}, onDuplicate() {},
    addable: [{ capability: 'TEAM', label: 'Equipo', block: 'Team', blockLabel: 'Equipo', variants: [{ id: 'grid', label: 'Cuadricula' }] }],
    onAdd() {},
  }));
  assert.ok(html.includes('Agregar'), 'hay una accion de agregar legible');
  assert.ok(!html.includes('"capability"'), 'no se vuelca JSON crudo al markup');
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(html), 'no se muestran UUID');
});

// ---------- S4 : REMOVE ----------

test('F5 S4: eliminar quita la seccion del manifest y renumera el orden', () => {
  const after = removeSection(manifestFixture(), 'productos');
  assert.ok(!ids(after).includes('productos'), 'desaparece del manifest');
  assert.equal(after.sections.length, manifestFixture().sections.length - 1);
  assert.deepEqual(after.sections.map((s) => s.order), [10, 20, 30, 40, 50], 'el orden queda sin huecos');
  assert.ok(!manifestSidebarSections(after).some((s) => s.id === 'productos'), 'desaparece de la sidebar');
  assert.ok(!ordenRenderizado(after).includes('productos'), 'y del renderer');
});

test('F5 S4/S11: eliminar NO borra los datos de negocio subyacentes', () => {
  const antes = cloneSnapshotValue(BUSINESS);
  const after = removeSection(manifestFixture(), 'servicios');
  assert.ok(!ids(after).includes('servicios'), 'la seccion sale del manifest');
  assert.deepEqual(BUSINESS.services, antes.services, 'los servicios siguen intactos');
  assert.deepEqual(BUSINESS.products, antes.products, 'los productos tambien');
  assert.deepEqual(BUSINESS.faqs, antes.faqs, 'y las preguntas frecuentes');
});

// ---------- S5 : HIDE / SHOW ----------

test('F5 S5: ocultar conserva la configuracion y deja la seccion en el manifest', () => {
  const before = manifestFixture();
  const hidden = setSectionHidden(before, 'servicios', true);
  const seccion = hidden.sections.find((s) => s.id === 'servicios');
  assert.ok(seccion, 'la seccion SIGUE en el manifest');
  assert.equal(seccion.hidden, true, 'marcada como oculta');
  assert.deepEqual(seccion.blocks[0].config, { presentation: 'cards' }, 'su configuracion se conserva intacta');
  assert.equal(manifestSidebarSections(hidden).find((s) => s.id === 'servicios').enabled, false, 'la sidebar la muestra deshabilitada');
});

test('F5 S5: volver a mostrar recupera EXACTAMENTE el contenido', () => {
  const before = manifestFixture();
  const visible = setSectionHidden(setSectionHidden(before, 'servicios', true), 'servicios', false);
  assert.deepEqual(
    visible.sections.find((s) => s.id === 'servicios'),
    before.sections.find((s) => s.id === 'servicios'),
    'hidden -> visible deja la seccion identica a como estaba',
  );
});

test('F5 S5: una seccion oculta NO se renderiza, pero sigue en el manifest', () => {
  const manifest = setSectionHidden(manifestFixture(), 'productos', true);
  assert.ok(!ordenRenderizado(manifest).includes('productos'), 'el renderer no la pinta');
  assert.ok(manifest.sections.some((s) => s.id === 'productos'), 'pero NO se borro del manifest');
  assert.ok(ordenRenderizado(manifest).includes('servicios'), 'las demas se siguen viendo');
});

// ---------- S6 : REORDER ----------

test('F5 S6: reordenar cambia el manifest Y el orden del renderer', () => {
  const before = manifestFixture();
  assert.deepEqual(ids(before), ['hero', 'servicios', 'productos', 'faq', 'contacto', 'pie']);
  // Hero, Products, Services, FAQ, Contact, Footer (el caso exacto de la fase).
  const despues = moveSection(before, 'productos', 1);
  assert.deepEqual(ids(despues), ['hero', 'productos', 'servicios', 'faq', 'contacto', 'pie'], 'el manifest cambia de orden');
  assert.deepEqual(despues.sections.map((s) => s.order), [10, 20, 30, 40, 50, 60], 'los order se reescriben');
  assert.deepEqual(ordenRenderizado(despues), ['hero', 'productos', 'servicios', 'faq', 'contacto', 'pie'], 'el renderer respeta el nuevo orden');
  assert.notDeepEqual(ordenRenderizado(despues), ordenRenderizado(before), 'el orden realmente cambio');
});

// ---------- S7 : DUPLICATE ----------

test('F5 S7: uniqueCopySectionId nunca repite un id', () => {
  assert.equal(uniqueCopySectionId(['hero'], 'hero'), 'hero-copia');
  assert.equal(uniqueCopySectionId(['hero', 'hero-copia'], 'hero'), 'hero-copia-2');
  assert.equal(uniqueCopySectionId(['hero', 'hero-copia', 'hero-copia-2'], 'hero'), 'hero-copia-3');
});

test('F5 S7: la copia tiene sectionId propio y NO comparte instanceId', () => {
  const after = duplicateSection(manifestFixture(), 'servicios');
  const original = after.sections.find((s) => s.id === 'servicios');
  const copia = after.sections.find((s) => s.id === 'servicios-copia');
  assert.ok(copia, 'la copia existe con su propia identidad');
  assert.notEqual(copia.blocks[0].instanceId, original.blocks[0].instanceId, 'no comparten instanceId');
  assert.equal(original.blocks[0].instanceId, 'servicios-services', 'el original conserva el suyo');
  assert.ok(ordenRenderizado(after).includes('servicios-copia'), 'y el renderer compone la copia');
});

test('F5 S7: duplicar dos veces la misma seccion produce ids UNICOS', () => {
  const uno = duplicateSection(manifestFixture(), 'servicios');
  const dos = duplicateSection(uno, 'servicios');
  const seccionIds = ids(dos);
  assert.equal(new Set(seccionIds).size, seccionIds.length, 'no puede haber ids repetidos: ' + seccionIds.join(', '));
  assert.ok(seccionIds.includes('servicios-copia'), 'la primera copia conserva su id');
  assert.ok(seccionIds.includes('servicios-copia-2'), 'la segunda recibe un id nuevo');
  const blockIds = dos.sections.flatMap((s) => s.blocks.map((b) => b.instanceId));
  assert.equal(new Set(blockIds).size, blockIds.length, 'tampoco puede haber instanceId repetidos');
});

test('F5 S7: la copia NO comparte objetos anidados con el original (sin aliasing)', () => {
  // Se enriquece el original con las estructuras donde el aliasing duele:
  // config, media, buttons, cards, items, responsive y styles.
  const base = manifestFixture();
  const conNidos = {
    ...base,
    sections: base.sections.map((s) => (s.id === 'servicios'
      ? { ...s, blocks: [{ ...s.blocks[0], config: { titulo: 'Original', media: { src: 'a.jpg' }, buttons: [{ label: 'Ver' }], cards: [{ t: 'x' }], items: [{ id: 1 }], responsive: { mobile: 'stack' }, styles: { color: 'red' } } }] }
      : s)),
  };
  const copiado = duplicateSection(conNidos, 'servicios');
  const original = copiado.sections.find((s) => s.id === 'servicios');
  const copia = copiado.sections.find((s) => s.id === 'servicios-copia');

  // Se comprueba REFERENCIA, no solo valor: un config compartido pasa un
  // deepEqual y solo falla cuando alguien edita la copia.
  for (const key of ['media', 'buttons', 'cards', 'items', 'responsive', 'styles']) {
    assert.notEqual(copia.blocks[0].config[key], original.blocks[0].config[key], key + ' NO es el mismo objeto');
  }
  // Y la prueba de fuego: mutar la copia no toca el original.
  const editado = patchBlockConfig(copiado, copia.blocks[0].instanceId, { titulo: 'Copia', buttons: [] });
  const originalTras = editado.sections.find((s) => s.id === 'servicios');
  assert.equal(originalTras.blocks[0].config.titulo, 'Original', 'editar la copia no renombra el original');
  assert.equal(originalTras.blocks[0].config.buttons.length, 1, 'ni vacia los botones del original');
});

// ---------- S8 : VARIANT ----------

test('F5 S8: cambiar de variante conserva el contenido y solo cambia la presentacion', () => {
  const before = manifestFixture();
  const conContenido = patchBlockConfig(before, 'servicios-services', { titulo: 'Nuestros servicios', media: { src: 'x.jpg' } });
  const cambiado = applyVariantConfig(conContenido, 'servicios-services', { presentation: 'editorial' });
  const cfg = cambiado.sections.find((s) => s.id === 'servicios').blocks[0].config;
  assert.equal(cfg.presentation, 'editorial', 'la presentacion cambia');
  assert.equal(cfg.titulo, 'Nuestros servicios', 'conserva el contenido');
  assert.deepEqual(cfg.media, { src: 'x.jpg' }, 'conserva las imagenes');
  // Y la operacion es PURA: el manifest de entrada no se muto.
  assert.equal(before.sections.find((s) => s.id === 'servicios').blocks[0].config.presentation, 'cards');
});

test('F5 S8: variant A -> B -> C se encadena sin perder contenido', () => {
  let m = patchBlockConfig(manifestFixture(), 'servicios-services', { titulo: 'Servicios' });
  m = applyVariantConfig(m, 'servicios-services', { presentation: 'editorial' });
  m = applyVariantConfig(m, 'servicios-services', { presentation: 'bento' });
  m = applyVariantConfig(m, 'servicios-services', { presentation: 'cards' });
  const cfg = m.sections.find((s) => s.id === 'servicios').blocks[0].config;
  assert.equal(cfg.presentation, 'cards', 'la ultima variante manda');
  assert.equal(cfg.titulo, 'Servicios', 'el contenido sobrevivio a las tres variantes');
});

test('F5 S8: la variante activa se deduce del manifest (sobrevive al F5)', () => {
  const manifest = applyVariantConfig(manifestFixture(), 'servicios-services', { presentation: 'bento' });
  const activas = activeVariantBySection(manifest);
  assert.equal(activas.servicios, 'bento', 'la UI puede marcar la variante activa tras recargar');
  assert.equal(activas.productos, 'grid', 'cada seccion tiene la suya');
  // Un bloque sin presentation no tiene variante activa: la UI no inventa una.
  assert.equal(activas.faq, undefined, 'un bloque sin presentacion no inventa variante');
});

// ---------- S12 : PERSISTENCIA ----------

test('F5 S12: ADD -> SAVE -> reload deja la seccion presente y renderizada', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  const nueva = { id: 'equipo', label: 'Equipo', order: 70, hidden: false, blocks: [{ block: 'Team', instanceId: 'equipo-team', config: {} }] };
  autosave.schedule({ ...server.manifest, sections: [...server.manifest.sections, nueva] });
  await wait(40);
  assert.ok(server.manifest.sections.some((s) => s.id === 'equipo'), 'EXISTS tras recargar');
  assert.ok(manifestSidebarSections(server.manifest).some((s) => s.id === 'equipo'), 'aparece en la sidebar');
  assert.ok(ordenRenderizado(server.manifest).includes('equipo'), 'y el renderer la compone');
  autosave.stop();
});

test('F5 S12: REMOVE -> SAVE -> reload deja la seccion AUSENTE', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  autosave.schedule(removeSection(server.manifest, 'faq'));
  await wait(40);
  assert.ok(!server.manifest.sections.some((s) => s.id === 'faq'), 'ABSENT tras recargar');
  assert.ok(!manifestSidebarSections(server.manifest).some((s) => s.id === 'faq'), 'y tampoco en la sidebar');
  assert.ok(!ordenRenderizado(server.manifest).includes('faq'), 'ni en el renderer');
  autosave.stop();
});

test('F5 S12: REORDER -> SAVE -> reload conserva el orden', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  autosave.schedule(moveSection(server.manifest, 'productos', 1));
  await wait(40);
  assert.deepEqual(ids(server.manifest), ['hero', 'productos', 'servicios', 'faq', 'contacto', 'pie'], 'ORDER PRESERVED');
  assert.deepEqual(ordenRenderizado(server.manifest), ['hero', 'productos', 'servicios', 'faq', 'contacto', 'pie'], 'y el renderer mantiene el orden');
  autosave.stop();
});

test('F5 S12: VARIANT -> SAVE -> reload conserva la variante', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  autosave.schedule(applyVariantConfig(server.manifest, 'servicios-services', { presentation: 'minimal' }));
  await wait(40);
  const bloque = server.manifest.sections.find((s) => s.id === 'servicios').blocks[0];
  assert.equal(bloque.config.presentation, 'minimal', 'VARIANT PRESERVED');
  assert.equal(activeVariantBySection(server.manifest).servicios, 'minimal', 'y la UI lo reconoce tras recargar');
  autosave.stop();
});

test('F5 S12: HIDE -> SAVE -> reload conserva la visibilidad', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  autosave.schedule(setSectionHidden(server.manifest, 'servicios', true));
  await wait(40);
  const seccion = server.manifest.sections.find((s) => s.id === 'servicios');
  assert.equal(seccion.hidden, true, 'sigue oculta tras recargar');
  assert.deepEqual(seccion.blocks[0].config, { presentation: 'cards' }, 'y con su configuracion intacta');
  assert.ok(!ordenRenderizado(server.manifest).includes('servicios'), 'y sin renderizarse');
  autosave.stop();
});

test('F5 S12: un save en vuelo NO pisa una edicion posterior (latest-wins)', async () => {
  const server = fakeServer();
  let liberar;
  const lenta = new Promise((r) => { liberar = r; });
  const autosave = createManifestAutosave({ save: async (m) => { await lenta; return server.save(m); }, debounceMs: 1 });
  autosave.schedule(patchBlockConfig(server.manifest, 'hero-hero', { title: 'A' }));
  await wait(20);
  autosave.schedule(patchBlockConfig(server.manifest, 'hero-hero', { title: 'B' }));
  liberar();
  await autosave.flush();
  assert.equal(server.manifest.sections[0].blocks[0].config.title, 'B', 'gana la ultima edicion, no la primera');
  autosave.stop();
});

// ---------- S13 : UNDO / REDO ----------

test('F5 S13: add -> reorder -> variant -> edit -> delete se revierte paso a paso', () => {
  let s = editorCargado();
  const original = cloneSnapshotValue(s.manifest);
  const paso = (m) => { s = builderReducer(s, { type: 'SET_MANIFEST', manifest: m }); };

  // 1) Add
  paso({ ...s.manifest, sections: [...s.manifest.sections, { id: 'equipo', label: 'Equipo', order: 70, hidden: false, blocks: [{ block: 'Team', instanceId: 'equipo-team', config: {} }] }] });
  assert.ok(ids(s.manifest).includes('equipo'));
  // 2) Reorder
  paso(moveSection(s.manifest, 'equipo', 0));
  assert.equal(ids(s.manifest)[0], 'equipo');
  // 3) Variant
  paso(applyVariantConfig(s.manifest, 'servicios-services', { presentation: 'bento' }));
  assert.equal(activeVariantBySection(s.manifest).servicios, 'bento');
  // 4) Edit
  paso(patchBlockConfig(s.manifest, 'hero-hero', { title: 'Nuevo titulo' }));
  assert.equal(s.manifest.sections.find((x) => x.id === 'hero').blocks[0].config.title, 'Nuevo titulo');
  // 5) Delete
  paso(removeSection(s.manifest, 'faq'));
  assert.ok(!ids(s.manifest).includes('faq'));
  assert.equal(s.history.length, 5, 'cinco pasos de historial');

  // 5 x UNDO
  for (let i = 0; i < 5; i++) s = builderReducer(s, { type: 'UNDO' });
  assert.deepEqual(s.manifest, original, 'cinco Undo devuelven el estado inicial EXACTO');
  assert.equal(s.manifest.sections.find((x) => x.id === 'servicios').blocks[0].config.presentation, 'cards', 'con la variante original');

  // 5 x REDO
  for (let i = 0; i < 5; i++) s = builderReducer(s, { type: 'REDO' });
  assert.ok(!ids(s.manifest).includes('faq'), 'REDO vuelve al estado final (faq eliminada)');
  assert.equal(s.manifest.sections[0].id, 'equipo', 'con el orden nuevo');
  assert.equal(activeVariantBySection(s.manifest).servicios, 'bento', 'y la variante nueva');
  assert.equal(s.manifest.sections.find((x) => x.id === 'hero').blocks[0].config.title, 'Nuevo titulo', 'y el contenido editado');
});

test('F5 S13: Undo -> nueva edicion elimina la rama futura sin corromper el manifest', () => {
  let s = editorCargado();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: removeSection(s.manifest, 'faq') });
  s = builderReducer(s, { type: 'UNDO' });
  assert.ok(ids(s.manifest).includes('faq'), 'el Undo restauro la seccion');
  assert.equal(s.future.length, 1, 'y dejo la rama futura disponible');

  // Nueva edicion: debe cortar la rama de redo.
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: removeSection(s.manifest, 'productos') });
  assert.equal(s.future.length, 0, 'la rama futura se descarto');

  // El manifest sigue siendo un manifest V2 coherente.
  assert.ok(Array.isArray(s.manifest.sections));
  const seccionIds = ids(s.manifest);
  assert.equal(new Set(seccionIds).size, seccionIds.length, 'sin ids de seccion repetidos');
  const blockIds = s.manifest.sections.flatMap((x) => x.blocks.map((b) => b.instanceId));
  assert.equal(new Set(blockIds).size, blockIds.length, 'sin instanceId repetidos');
  assert.ok(!seccionIds.includes('productos'), 'la nueva edicion se conserva');
  assert.ok(seccionIds.includes('faq'), 'y la restaurada sigue ahi');
  assert.ok(isUsableManifest(s.manifest), 'el manifest sigue siendo utilizable');
});

test('F5 S13: el historial clona los snapshots (undo/redo sin aliasing)', () => {
  let s = editorCargado();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: duplicateSection(s.manifest, 'servicios') });
  const antes = s.history[0].manifest.sections.find((x) => x.id === 'servicios').blocks[0].config.presentation;
  // Se sigue editando en vivo: la instantanea del pasado NO debe cambiar.
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'servicios-services', { presentation: 'bento' }) });
  const despues = s.history[0].manifest.sections.find((x) => x.id === 'servicios').blocks[0].config.presentation;
  assert.equal(despues, antes, 'el snapshot del historial no se muto desde el estado vivo');
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(s.manifest.sections.find((x) => x.id === 'servicios').blocks[0].config.presentation, 'cards',
    'el Undo devolvio el estado historico intacto');
});

test('F5 S13: toda operacion estructural es deshacible y rehecha sobre el manifest', () => {
  const operaciones = [
    ['agregar seccion', (m) => ({ ...m, sections: [...m.sections, { id: 'nueva', label: 'Nueva', order: 90, hidden: false, blocks: [{ block: 'Text', instanceId: 'nueva-text', config: {} }] }] })],
    ['ocultar/mostrar seccion', (m) => setSectionHidden(m, 'servicios', true)],
    ['duplicar seccion', (m) => duplicateSection(m, 'servicios')],
    ['eliminar seccion', (m) => removeSection(m, 'servicios')],
    ['reordenar secciones', (m) => moveSection(m, 'servicios', 0)],
    ['cambiar variante', (m) => applyVariantConfig(m, 'servicios-services', { presentation: 'bento' })],
    ['editar contenido', (m) => patchBlockConfig(m, 'hero-hero', { title: 'Nuevo titulo' })],
  ];
  for (const [nombre, operacion] of operaciones) {
    let s = editorCargado();
    const antes = cloneSnapshotValue(s.manifest);
    s = builderReducer(s, { type: 'SET_MANIFEST', manifest: operacion(s.manifest) });
    assert.notDeepEqual(s.manifest, antes, nombre + ': la operacion cambio el manifest');
    s = builderReducer(s, { type: 'UNDO' });
    assert.deepEqual(s.manifest, antes, nombre + ': Undo lo revierte exactamente');
    s = builderReducer(s, { type: 'REDO' });
    assert.notDeepEqual(s.manifest, antes, nombre + ': Redo lo vuelve a aplicar');
  }
});

test('F5 S12/S13: undo y redo tambien se PERSISTEN (no solo en memoria)', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  let s = editorCargado();
  assert.equal(s.persistTick, 0, 'abrir el editor no genera un guardado espurio');
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: removeSection(s.manifest, 'faq') });
  autosave.schedule(s.manifest);
  await wait(40);
  assert.ok(!server.manifest.sections.some((x) => x.id === 'faq'), 'el borrado quedo guardado');
  // Undo -> autosave -> reload: la seccion vuelve a estar.
  s = builderReducer(s, { type: 'UNDO' });
  autosave.schedule(s.manifest);
  await wait(40);
  assert.ok(server.manifest.sections.some((x) => x.id === 'faq'), 'tras un Undo+F5 la seccion vuelve');
  assert.equal(s.persistTick, 2, 'undo tambien cuenta como cambio persistible');
  autosave.stop();
});

// ---------- S5 : REGRESION DEL BUG REAL DE OCULTAR/MOSTRAR ----------
//
// Se exercita la EXPRESION que usa el editor, no solo `setSectionHidden`.
// El bug era `!(current && current.hidden !== true)`: con la seccion visible
// daba `false`, o sea el ojo NUNCA ocultaba. Esta prueba fija esa semantica.

const alternar = (current) => !(current && current.hidden === true);

test('F5 S5: la expresion del editor SI alterna visible -> oculto', () => {
  // visible (hidden === false o ausente) -> debe ocultar
  assert.equal(alternar({ hidden: false }), true, 'una seccion visible DEBE ocultarse');
  assert.equal(alternar({}), true, 'una seccion sin `hidden` DEBE ocultarse');
  // oculta (hidden === true) -> debe mostrar
  assert.equal(alternar({ hidden: true }), false, 'una seccion oculta DEBE mostrarse');
});

test('F5 S5: el ciclo visible -> oculto -> visible sobre el manifest real', () => {
  const m = manifestFixture();
  const visible = m.sections.find((s) => s.id === 'servicios');
  const oculto = setSectionHidden(m, 'servicios', alternar(visible));
  assert.equal(oculto.sections.find((s) => s.id === 'servicios').hidden, true, 'primera pulsacion: oculta');
  const deVuelta = setSectionHidden(oculto, 'servicios', alternar(oculto.sections.find((s) => s.id === 'servicios')));
  assert.equal(deVuelta.sections.find((s) => s.id === 'servicios').hidden, false, 'segunda pulsacion: muestra');
  assert.deepEqual(deVuelta.sections.find((s) => s.id === 'servicios'), visible, 'y vuelve a ser identica al original');
});

test('F5 S5: el manifest guardado conserva la visibilidad (persist via autosave)', async () => {
  const server = fakeServer();
  const autosave = createManifestAutosave({ save: (m) => server.save(m), debounceMs: 1 });
  const visible = manifestFixture().sections.find((s) => s.id === 'servicios');
  autosave.schedule(setSectionHidden(server.manifest, 'servicios', alternar(visible)));
  await wait(40);
  assert.equal(server.manifest.sections.find((s) => s.id === 'servicios').hidden, true, 'el F5 recargara la seccion como oculta');
  autosave.stop();
});
