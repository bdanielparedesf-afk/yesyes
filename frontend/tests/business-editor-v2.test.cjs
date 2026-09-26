const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./helpers/mount.cjs');

/**
 * YESYES BUSINESS — FASE 4.2 · C: EL EDITOR USA EL MANIFEST V2.
 *
 * Estos tests EJERCITAN el código real de producción: los módulos del frontend
 * se montan con esbuild y se renderizan con react-dom/server. No buscan
 * substrings en el código; comprueban entrada -> operación -> resultado visible.
 *
 *   C2  la lista de secciones sale de `manifest.sections`
 *   C3  modificar una sección actualiza el Manifest
 *   C4/C5  el autosave persiste y una recarga devuelve el mismo Manifest
 *   C6  la preview usa el Manifest actual
 *   C7  guardar NO publica
 *   C8  una página V3 antigua sin SiteInstance sigue funcionando
 *   §13 servicios y productos visibles al mismo tiempo
 */

const state = mount('business/builder/useBuilderState.ts', 'c-state');
const types = mount('business/builder/types.ts', 'c-types');
const groups = mount('business/collectionGroups.ts', 'c-groups');
const sidebar = mount('business/builder/BuilderSidebar.tsx', 'c-sidebar');
const renderer = mount('business/BusinessPageRenderer.tsx', 'c-renderer');
const signature = mount('business/SignatureTemplate.tsx', 'c-signature');
const industry = mount('business/IndustryTemplates.tsx', 'c-industry');

const {
  createManifestAutosave, firstSelectableSectionId, setSectionHidden,
  moveSection, removeSection, duplicateSection, patchBlockConfig, isUsableManifest,
} = state;
const { manifestSidebarSections } = types;
const { resolveCollectionGroups } = groups;
const { BuilderSidebar } = sidebar;

const render = (element) => renderToStaticMarkup(React.createElement(React.Fragment, null, element));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Manifest V2 mínimo y realista (misma forma que produce el backend). */
function manifestFixture() {
  return {
    manifestVersion: 1,
    layout: 'modern-commerce',
    legacy: false,
    sections: [
      { id: 'hero', label: 'Portada', order: 10, hidden: false, blocks: [{ block: 'Hero', instanceId: 'hero-hero', config: { title: 'Titulo original' } }] },
      { id: 'servicios', label: 'Servicios', order: 20, hidden: false, blocks: [{ block: 'Services', instanceId: 'servicios-services', config: {} }] },
      { id: 'productos', label: 'Productos', order: 30, hidden: false, blocks: [{ block: 'Products', instanceId: 'productos-products', config: {} }] },
    ],
  };
}

const BUSINESS = {
  id: 'b1', name: 'Negocio', slug: 'negocio', category: 'BOUTIQUE', status: 'DRAFT',
  description: 'Descripcion del negocio', phone: '+56911111111', whatsapp: '+56911111111',
  template: { code: 'BOUTIQUE_01', name: 'Boutique', category: 'BOUTIQUE', capabilities: [] },
};

const CONTENT = {
  services: [{ id: 's1', name: 'Servicio Uno', description: 'Trabajo profesional', price: 10000 }],
  products: [{ id: 'p1', name: 'Producto Uno', description: 'Producto de prueba', price: 20000, salePrice: 20000 }],
  properties: [], gallery: [], testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [],
};


// ───────────────────────────── C2 ─────────────────────────────

test('C2: la lista de secciones sale de manifest.sections, no de visual.sections', () => {
  const manifest = manifestFixture();
  // El negocio tiene además un visual.sections que NO coincide con el manifest.
  // Si la UI leyera la vía legacy, la lista sería otra.
  const legacyVisual = { sections: [{ id: 'FAQ', enabled: true, order: 10 }] };
  const list = manifestSidebarSections(manifest);

  assert.deepEqual(list.map((s) => s.instanceId), ['hero', 'servicios', 'productos']);
  assert.deepEqual(list.map((s) => s.type), ['Hero', 'Services', 'Products']);
  assert.ok(list.every((s) => s.enabled === true));
  assert.equal(list.find((s) => s.id === 'servicios').label, 'Servicios');
  assert.ok(legacyVisual.sections.length === 1, 'el dato legacy existe');
  assert.ok(!list.some((s) => s.id === 'FAQ'), 'y sin embargo no aparece en la lista');
});

test('C2: una sección oculta aparece deshabilitada, no desaparece', () => {
  const manifest = manifestFixture();
  manifest.sections[1].hidden = true;
  const list = manifestSidebarSections(manifest);
  assert.equal(list.find((s) => s.id === 'servicios').enabled, false);
  assert.equal(list.length, 3, 'ocultar no elimina la sección del manifest');
});

test('C2: la sidebar renderizada muestra exactamente las secciones del manifest', () => {
  const html = render(React.createElement(BuilderSidebar, {
    sections: manifestSidebarSections(manifestFixture()),
    selected: 'hero',
    onSelect: () => {}, onToggle: () => {}, onMove: () => {}, onRemove: () => {}, onDuplicate: () => {},
  }));
  assert.ok(html.includes('builder-section-hero'), 'sección del manifest en el DOM');
  assert.ok(html.includes('builder-section-servicios'));
  assert.ok(html.includes('builder-section-productos'));
  assert.ok(html.includes('data-section-type="Services"'), 'expone el tipo (bloque) del manifest');
  assert.ok(!html.includes('FAQ'), 'no renderiza secciones ausentes del manifest');
});

// ───────────────────────────── C3 ─────────────────────────────

test('C3: ocultar una sección actualiza el Manifest sin mutar el anterior', () => {
  const before = manifestFixture();
  const after = setSectionHidden(before, 'productos', true);
  assert.equal(before.sections[2].hidden, false, 'el manifest anterior no se toca');
  assert.equal(after.sections[2].hidden, true, 'el manifest nuevo refleja el cambio');
});

test('C3: mover, duplicar y eliminar trabajan sobre manifest.sections', () => {
  const base = manifestFixture();
  const moved = moveSection(base, 'productos', 0);
  assert.deepEqual(moved.sections.map((s) => s.id), ['productos', 'hero', 'servicios']);
  assert.deepEqual(moved.sections.map((s) => s.order), [10, 20, 30]);

  const duplicated = duplicateSection(base, 'servicios');
  assert.equal(duplicated.sections.length, 4);
  const original = duplicated.sections.find((s) => s.id === 'servicios');
  const copy = duplicated.sections.find((s) => s.id === 'servicios-copia');
  assert.ok(copy, 'la copia tiene identidad propia');
  // FASE 5 §7 — lo que importa es que la copia NO comparta el instanceId del
  // original: es por ese id que el renderer, el autosave y el editor distinguen
  // una sección de otra. El sufijo exacto es cosmético.
  assert.notEqual(copy.blocks[0].instanceId, original.blocks[0].instanceId, 'los bloques copiados no comparten instanceId');
  assert.equal(copy.blocks[0].instanceId, 'servicios-copia-1-services', 'el instanceId copiado es único y descriptivo');
  assert.equal(original.blocks[0].instanceId, 'servicios-services', 'el original conserva su instanceId');

  const removed = removeSection(base, 'productos');
  assert.deepEqual(removed.sections.map((s) => s.id), ['hero', 'servicios']);
});

test('F5 §7: duplicar dos veces la misma sección produce ids ÚNICOS', () => {
  const base = manifestFixture();
  const uno = duplicateSection(base, 'servicios');
  const dos = duplicateSection(uno, 'servicios');
  const ids = dos.sections.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `no puede haber ids repetidos: ${ids.join(', ')}`);
  assert.ok(ids.includes('servicios-copia'), 'la primera copia conserva su id');
  assert.ok(ids.includes('servicios-copia-2'), 'la segunda copia recibe un id nuevo, no el mismo');
  const blocks = dos.sections.flatMap((s) => s.blocks.map((b) => b.instanceId));
  assert.equal(new Set(blocks).size, blocks.length, 'tampoco puede haber instanceId repetidos');
});

// Defecto real de la certificación E2E: el `instanceId` de la copia se derivaba
// solo del id de la copia, así que no miraba el resto del manifest. Como la
// sección `extras` (regla de no-pérdida al cambiar de diseño) apila bloques con
// ids antiguos, la copia podía colisionar con uno de ellos: el autoguardado
// respondía 422, la sección se duplicaba un instante y "desaparecía" al recargar.
test('F5 §7: la copia no colisiona con bloques aparcados en `extras`', () => {
  const base = manifestFixture();
  base.sections.push({
    id: 'extras', label: 'Contenido adicional', order: 900,
    blocks: [{ block: 'Services', instanceId: 'servicios-copia-1-services', config: {} }],
  });
  const copy = duplicateSection(base, 'servicios');
  const instanceIds = copy.sections.flatMap((s) => s.blocks.map((b) => b.instanceId));
  assert.equal(new Set(instanceIds).size, instanceIds.length,
    `instanceId duplicado tras duplicar: ${instanceIds.join(', ')}`);
  const duplicated = copy.sections.find((s) => s.id === 'servicios-copia');
  assert.notEqual(duplicated.blocks[0].instanceId, 'servicios-copia-1-services',
    'la copia esquiva el instanceId que ya vive en extras');
});

test('F5 §7: la copia NO comparte(config) con el original (sin aliasing)', () => {
  const base = manifestFixture();
  // Se enriquece el original con objetos ANIDADOS, que es donde el aliasing
  // duele: config, media, buttons, cards, items, responsive y styles.
  const conNidos = {
    ...base,
    sections: base.sections.map((s) => (s.id === 'servicios'
      ? { ...s, blocks: s.blocks.map((b, i) => (i === 0
        ? { ...b, config: { titulo: 'Original', media: { src: 'a.jpg' }, buttons: [{ label: 'Ver' }], cards: [{ t: 'x' }], items: [{ id: 1 }], responsive: { mobile: 'stack' }, styles: { color: 'red' } } }
        : b)) } : s)),
  };
  const copiado = duplicateSection(conNidos, 'servicios');
  const original = copiado.sections.find((s) => s.id === 'servicios');
  const copia = copiado.sections.find((s) => s.id === 'servicios-copia');

  // Se comprueba REFERENCIA, no solo valor: con el mismo valor, un config
  // compartido pasa un `deepEqual` y falla en cuanto se edita la copia.
  for (const key of ['media', 'buttons', 'cards', 'items', 'responsive', 'styles']) {
    assert.notEqual(copia.blocks[0].config[key], original.blocks[0].config[key], `${key} NO es el mismo objeto`);
  }
  // Y la prueba de fuego: mutar la copia no toca el original.
  const editado = patchBlockConfig(copiado, copia.blocks[0].instanceId, { titulo: 'Copia', buttons: [] });
  const originalTras = editado.sections.find((s) => s.id === 'servicios');
  assert.equal(originalTras.blocks[0].config.titulo, 'Original', 'editar la copia no renombra el original');
  assert.equal(originalTras.blocks[0].config.buttons.length, 1, 'ni vacía los botones del original');
});

test('C3: editar la config de un bloque modifica el Manifest', () => {
  const before = manifestFixture();
  const after = patchBlockConfig(before, 'hero-hero', { title: 'Titulo nuevo' });
  assert.equal(before.sections[0].blocks[0].config.title, 'Titulo original');
  assert.equal(after.sections[0].blocks[0].config.title, 'Titulo nuevo');
});

test('C3: la sección seleccionada al abrir sale del manifest', () => {
  assert.equal(firstSelectableSectionId(manifestFixture()), 'hero');
  const hiddenFirst = manifestFixture();
  hiddenFirst.sections[0].hidden = true;
  assert.equal(firstSelectableSectionId(hiddenFirst), 'servicios');
});


// ───────────────────── C4 / C5: persistencia y autosave ─────────────────────

test('C4/C5: el autosave persiste el Manifest y recargar devuelve el mismo', async () => {
  // Backend simulado: guarda en un almacén y lo devuelve al recargar.
  const store = { manifest: manifestFixture(), revisions: 0 };
  const statuses = [];
  const autosave = createManifestAutosave({
    save: async (manifest) => { store.manifest = manifest; store.revisions += 1; return { manifest, updatedAt: `t${store.revisions}` }; },
    onStatus: (s) => statuses.push(s.state),
    debounceMs: 5,
  });

  const edited = patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'Editado' });
  autosave.schedule(edited);
  assert.equal(store.revisions, 0, 'no guarda en cada tecla: primero pasa el debounce');
  await wait(25);
  assert.equal(store.revisions, 1, 'guarda una vez después del debounce');
  assert.equal(store.manifest.sections[0].blocks[0].config.title, 'Editado');

  // C5: la recarga devuelve exactamente el mismo manifest.
  assert.deepEqual(store.manifest, edited, 'recargar recupera el mismo manifest');
  assert.ok(statuses.includes('SAVED'));
});

test('C4: el autosave agrupa varias ediciones en un solo guardado', async () => {
  const saved = [];
  const autosave = createManifestAutosave({ save: async (m) => { saved.push(m); return { manifest: m }; }, debounceMs: 10 });
  autosave.schedule(manifestFixture());
  autosave.schedule(manifestFixture());
  autosave.schedule(patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'final' }));
  await wait(40);
  assert.equal(saved.length, 1, 'tres ediciones, un guardado');
  assert.equal(saved[0].sections[0].blocks[0].config.title, 'final');
});

test('C4: nunca hay dos guardados simultáneos y gana el estado más reciente', async () => {
  let inFlight = 0; let maxConcurrent = 0;
  const saved = [];
  const autosave = createManifestAutosave({
    save: async (m) => {
      inFlight += 1; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await wait(15);
      saved.push(m.sections[0].blocks[0].config.title);
      inFlight -= 1;
      return { manifest: m };
    },
    debounceMs: 1,
  });
  autosave.schedule(patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'v1' }));
  await wait(5);
  autosave.schedule(patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'v2' }));
  await wait(80);
  assert.equal(maxConcurrent, 1, 'nunca dos saves a la vez');
  assert.deepEqual(saved, ['v1', 'v2'], 'guarda en orden, sin perder la edición reciente');
});


test('C4: ante conflicto se detiene el guardado y se recarga sin sobrescribir', async () => {
  const serverManifest = patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'DEL SERVIDOR' });
  const statuses = [];
  let attempts = 0;
  const delivered = [];
  const autosave = createManifestAutosave({
    save: async () => {
      attempts += 1;
      const error = new Error('conflicto');
      error.conflict = true;
      error.manifest = serverManifest;
      throw error;
    },
    onStatus: (s) => statuses.push(s),
    onConflict: (m) => delivered.push(m),
    debounceMs: 1,
  });
  autosave.schedule(patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'MIO' }));
  await wait(30);
  autosave.schedule(patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'OTRO' }));
  await wait(30);
  assert.equal(attempts, 1, 'tras el conflicto no se vuelve a intentar guardar');
  assert.equal(statuses.some((s) => s.conflict === true), true, 'se informa el conflicto');
  assert.equal(delivered.length, 1, 'se recarga el manifest del servidor');
  assert.equal(delivered[0].sections[0].blocks[0].config.title, 'DEL SERVIDOR');
});

test('C7: guardar el borrador no publica ni cambia la revisión publicada', async () => {
  // El autosave solo conoce `save`: no existe ninguna vía de publicación en él.
  const store = { manifest: manifestFixture(), revisions: 0, publishedRevision: 'PUBLICADO-1' };
  const autosave = createManifestAutosave({
    save: async (m) => { store.manifest = m; store.revisions += 1; return { manifest: m, updatedAt: `t${store.revisions}` }; },
    debounceMs: 1,
  });
  autosave.schedule(patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'Borrador' }));
  await wait(30);
  assert.equal(store.revisions, 1, 'el borrador se guardó');
  assert.equal(store.publishedRevision, 'PUBLICADO-1', 'la revisión publicada no cambió al guardar');
});


// ───────────────────── C6 / C8: render ─────────────────────

test('C6: la preview compone el Manifest actual, incluidos cambios sin guardar', () => {
  const manifest = manifestFixture();
  manifest.sections[0].blocks[0].config = { headline: 'CAMBIADO EN EL EDITOR' };
  const html = render(React.createElement(renderer.Subject, {
    business: { ...BUSINESS, siteInstance: { manifest } }, ...CONTENT, preview: true,
  }));
  assert.ok(html.includes('data-business-renderer="v2"'), 'usa la vía V2 cuando hay manifest');
  assert.ok(html.includes('CAMBIADO EN EL EDITOR'), 'la preview muestra el manifest en edición');
});

test('C6: la preview ignora visual.sections cuando existe Manifest', () => {
  const manifest = manifestFixture();
  const html = render(React.createElement(renderer.Subject, {
    business: { ...BUSINESS, visual: { sections: [{ id: 'FAQ', enabled: true, order: 10 }] }, siteInstance: { manifest } },
    ...CONTENT, preview: true,
  }));
  assert.ok(html.includes('data-business-renderer="v2"'));
  assert.ok(!html.includes('data-block-section="FAQ"'), 'la vía legacy no se cuela en la preview V2');
});

test('C8: una página V3 antigua sin SiteInstance sigue renderizando por la vía legacy', () => {
  const legacy = {
    ...BUSINESS,
    category: 'PET',
    template: { code: 'PET_01', name: 'Pet', category: 'PET', capabilities: [] },
    siteInstance: null,
    visual: { sections: [{ id: 'HERO', enabled: true, order: 10 }, { id: 'SERVICES', enabled: true, order: 20 }] },
  };
  const html = render(React.createElement(renderer.Subject, { business: legacy, ...CONTENT, preview: true }));
  assert.ok(!html.includes('data-business-renderer="v2"'), 'sin manifest V2 no se fuerza la vía V2');
  assert.ok(html.length > 100, 'la página legacy produce markup propio');
});

test('C8: un manifest legacy no se compone por el motor V2', () => {
  assert.equal(isUsableManifest(manifestFixture()), true);
  assert.equal(isUsableManifest({ legacy: true, sections: [{ id: 'x' }] }), false);
  assert.equal(isUsableManifest(null), false);
  const legacyHtml = render(React.createElement(renderer.Subject, {
    business: {
      ...BUSINESS, category: 'PET',
      template: { code: 'PET_01', name: 'Pet', category: 'PET', capabilities: [] },
      siteInstance: { manifest: { legacy: true, sections: [], legacyTemplateCode: 'PET_01' } },
      visual: { sections: [{ id: 'HERO', enabled: true, order: 10 }] },
    },
    ...CONTENT, preview: true,
  }));
  assert.ok(!legacyHtml.includes('data-business-renderer="v2"'), 'el flag legacy manda sobre el motor V2');
  assert.ok(legacyHtml.includes('data-business-sections'), 'y la página sigue por la composición legacy');
});

// ───────────────────────────── §13 ─────────────────────────────

test('§13: un negocio con productos y servicios muestra ambos grupos', () => {
  const result = resolveCollectionGroups({
    services: [{ id: 's1', name: 'Servicio Uno' }, { id: 's2', name: 'Servicio Dos' }],
    products: [{ id: 'p1', name: 'Producto Uno' }],
    properties: [],
  });
  assert.deepEqual(result.visible.map((g) => g.key), ['products', 'services'], 'conviven, no se elige uno');
  assert.equal(result.visible.find((g) => g.key === 'services').items.length, 2);
  assert.equal(result.visible.find((g) => g.key === 'products').items.length, 1);
});

test('§13: la página Signature muestra servicios Y productos a la vez', () => {
  const html = render(React.createElement(signature.Subject, {
    business: { ...BUSINESS, category: 'PET', template: { code: 'PET_01' } },
    ...CONTENT, preview: true,
  }));
  assert.ok(html.includes('Servicio Uno'), 'servicios visibles');
  assert.ok(html.includes('Producto Uno'), 'productos visibles');
  assert.ok(!html.includes('Estamos preparando nuestra colección'), 'no cae al estado vacío');
});

test('§13: la página de Industria muestra servicios Y productos a la vez', () => {
  // FITNESS_01 usaba `products.length ? products : services`: con productos
  // presentes, los servicios desaparecían.
  const html = render(React.createElement(industry.Subject, {
    business: { ...BUSINESS, category: 'FITNESS', template: { code: 'FITNESS_01' } },
    ...CONTENT, preview: true,
  }));
  assert.ok(html.includes('Servicio Uno'), 'servicios visibles');
  assert.ok(html.includes('Producto Uno'), 'productos visibles');
});

test('§13: sin contenido no se inventa ningún grupo', () => {
  assert.deepEqual(resolveCollectionGroups({ services: [], products: [], properties: [] }).visible, []);
});
