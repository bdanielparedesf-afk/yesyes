/**
 * YESYES BUSINESS — FASE 3: UNDO/REDO AFECTA SOLO AL BORRADOR.
 *
 * Monta el código REAL del editor y comprueba la propiedad que importa en esta
 * fase: el historial del editor es un estado de BORRADOR. Undo y Redo mueven el
 * documento que se autosavea; no conocen la versión publicada y no pueden
 * escribir en ella.
 *
 *   D1  Undo restaura el borrador a la versión anterior
 *   D2  Redo vuelve a aplicar el cambio sobre el borrador
 *   D3  el autosave de un Undo envía el borrador restaurado
 *   D4  el documento del editor nunca contiene la versión publicada
 *   D5  una cadena larga de Undo/Redo no muta snapshots por referencia
 *   D6  la recarga parte del borrador persistido, no del publicado
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers/mount.cjs');

const state = mount('business/builder/useBuilderState.ts', 'f3-state');

const {
  builderReducer, builderInitialState, createManifestAutosave, patchBlockConfig,
} = state;

/**
 * El estado que el backend mantiene: `draft` mutable y `published` congelado.
 * El editor solo conoce `draft`; `published` está acá para PROBAR que no lo toca.
 */
function site() {
  return {
    draft: {
      manifestVersion: 1, layout: 'minimal', legacy: false,
      sections: [{ id: 'hero', label: 'Portada', order: 10, blocks: [{ block: 'Hero', instanceId: 'hero-hero', config: { title: 'Clinica Veterinaria Los Robles' } }] }],
    },
    published: {
      manifestVersion: 1, layout: 'minimal', legacy: false,
      sections: [{ id: 'hero', label: 'Portada', order: 10, blocks: [{ block: 'Hero', instanceId: 'hero-hero', config: { title: 'Clinica Veterinaria Los Robles PUBLICADO' } }] }],
    },
  };
}
const titleOf = (manifest) => manifest.sections[0].blocks[0].config.title;
const loaded = (draft) => builderReducer(builderInitialState, { type: 'LOAD', business: { id: 'b1', name: 'Veterinaria' }, manifest: draft });
const edit = (s, title) => builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title }) });

test('D1: Undo restaura el borrador a la versión anterior', () => {
  const s1 = edit(loaded(site().draft), 'Version B');
  const s2 = builderReducer(s1, { type: 'UNDO' });
  assert.equal(titleOf(s2.manifest), 'Clinica Veterinaria Los Robles', 'el borrador volvió a su estado previo');
  assert.equal(s2.saveState, 'DIRTY', 'queda pendiente de persistir');
  assert.equal(s2.persistTick, s1.persistTick + 1, 'el Undo dispara el autosave');
});

test('D2: Redo vuelve a aplicar el cambio sobre el borrador', () => {
  const s1 = edit(loaded(site().draft), 'Version B');
  const undone = builderReducer(s1, { type: 'UNDO' });
  const redone = builderReducer(undone, { type: 'REDO' });
  assert.equal(titleOf(redone.manifest), 'Version B', 'el borrador recuperó el cambio');
  assert.equal(redone.persistTick, undone.persistTick + 1, 'el Redo también persiste el borrador');
});


test('D3: el autosave de un Undo envía el borrador restaurado, no el publicado', async () => {
  const published = site().published;
  const sent = [];
  const autosave = createManifestAutosave({
    delay: 5,
    save: async (manifest) => { sent.push(titleOf(manifest)); return { manifest, updatedAt: new Date().toISOString() }; },
  });

  let s = loaded(site().draft);
  autosave.schedule(s.manifest);
  s = edit(s, 'Version B');
  autosave.schedule(s.manifest);
  await autosave.flush();
  s = builderReducer(s, { type: 'UNDO' });
  autosave.schedule(s.manifest);
  await autosave.flush();
  autosave.stop();

  assert.deepEqual(sent, ['Version B', 'Clinica Veterinaria Los Robles'], `guardó el borrador en cada paso: ${sent}`);
  assert.ok(!sent.some((title) => title === titleOf(published)), 'nunca se envió la versión publicada');
});

test('D4: el documento del editor nunca contiene la versión publicada', () => {
  const s0 = loaded(site().draft);
  const publishedTitle = titleOf(site().published);
  assert.notEqual(titleOf(s0.manifest), publishedTitle, 'el editor carga el borrador, no lo publicado');

  // Tras una cadena de ediciones y deshacer, el documento sigue siendo el
  // borrador: nunca se importa la versión publicada al espacio de trabajo.
  let s = s0;
  for (const title of ['A', 'B', 'C', 'D']) s = edit(s, title);
  for (let i = 0; i < 4; i += 1) s = builderReducer(s, { type: 'UNDO' });
  assert.notEqual(titleOf(s.manifest), publishedTitle, 'tras deshacer todo, sigue siendo el borrador');
  assert.equal(titleOf(s.manifest), 'Clinica Veterinaria Los Robles');
});

test('D5: Undo/Redo en cadena no muta los snapshots por referencia', () => {
  let s = loaded(site().draft);
  s = edit(s, 'B');
  s = edit(s, 'C');
  const antes = s.history.map((snapshot) => titleOf(snapshot.manifest));
  assert.deepEqual(antes, ['Clinica Veterinaria Los Robles', 'B'], 'el historial guarda los estados reales');

  s = builderReducer(s, { type: 'UNDO' });
  s = builderReducer(s, { type: 'REDO' });
  const despues = s.history.map((snapshot) => titleOf(snapshot.manifest));
  assert.deepEqual(despues, antes, 'el historial no cambió de contenido al mover el documento');
});

test('D6: recargar parte del borrador persistido, no del publicado', async () => {
  // Se persiste el borrador, se "recarga" el editor con lo persistido y se
  // comprueba que el trabajo continúa desde el borrador, no desde lo publicado.
  let persistido = null;
  const autosave = createManifestAutosave({
    delay: 5,
    save: async (manifest) => { persistido = manifest; return { manifest, updatedAt: new Date().toISOString() }; },
  });
  let s = loaded(site().draft);
  s = edit(s, 'Version B');
  autosave.schedule(s.manifest);
  await autosave.flush();
  autosave.stop();

  const recargado = builderReducer(builderInitialState, { type: 'LOAD', business: { id: 'b1', name: 'Veterinaria' }, manifest: persistido });
  assert.equal(titleOf(recargado.manifest), 'Version B', 'la recarga recupera el borrador');
  assert.notEqual(titleOf(recargado.manifest), titleOf(site().published), 'y no la versión publicada');
  assert.equal(recargado.history.length, 0, 'la recarga reabre un historial limpio');
});
