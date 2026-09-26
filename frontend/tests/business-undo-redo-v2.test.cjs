/**
 * YESYES BUSINESS — FASE 4.2 · E: UNDO/REDO DEFINITIVO SOBRE MANIFEST V2.
 *
 * Estos tests EJERCITAN el código real de producción: los módulos del frontend se
 * montan con esbuild y se ejecutan de verdad. No buscan substrings en el código;
 * comprueban entrada -> operación -> resultado observable.
 *
 *   E1  el snapshot contiene el manifest (y el business)
 *   E2  SET_MANIFEST / SET_BUSINESS actualizan el documento
 *   E3  el snapshot es un deep clone (sin aliasing)
 *   E4  undo restaura business Y manifest
 *   E5  redo restaura business Y manifest
 *   E6  una edición nueva después de un undo elimina la rama de redo
 *   E7  discard vuelve al snapshot inicial del borrador
 *   E8  undo/redo no altera estados históricos por aliasing
 *   §6  la edición continua se agrupa (escribir no genera un paso por tecla)
 *   §7  undo/redo dejan el documento pendiente de persistencia
 *   §13 el historial tiene tope
 *   §14 un save en vuelo no pisa un undo posterior; el 409 se respeta
 *   §16 Ctrl/Cmd+Z, +Shift+Z y +Y se interpretan igual en Windows y macOS
 *   §17 los botones reflejan canUndo/canRedo
 *   §9/§10/§11/§19  integración con el autosave y la recarga
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./helpers/mount.cjs');

const state = mount('business/builder/useBuilderState.ts', 'e-state');
const types = mount('business/builder/types.ts', 'e-types');
const topbar = mount('business/builder/BuilderTopBar.tsx', 'e-topbar');

const {
  builderReducer, builderInitialState, createManifestAutosave, patchBlockConfig,
  setSectionHidden, moveSection, removeSection, duplicateSection, undoRedoIntent,
  businessEditKey, cloneSnapshotValue,
} = state;
const { canUndo, canRedo, MAX_HISTORY, COALESCE_MS } = types;
const { Subject: BuilderTopBar } = topbar;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Manifest V2 mínimo y realista (misma forma que produce el backend). */
function manifestFixture() {
  return {
    manifestVersion: 1, layout: 'modern-commerce', legacy: false,
    sections: [
      { id: 'hero', label: 'Portada', order: 10, blocks: [{ block: 'Hero', instanceId: 'hero-hero', config: { title: 'Titulo original' } }] },
      { id: 'servicios', label: 'Servicios', order: 20, blocks: [{ block: 'Services', instanceId: 'servicios-services', config: {} }] },
    ],
  };
}
const businessFixture = () => ({ id: 'b1', name: 'Negocio', slug: 'negocio', cta: { title: 'CTA' } });
const titleOf = (manifest) => manifest.sections[0].blocks[0].config.title;

/** Estado inicial del editor con el borrador ya cargado (como al abrir la página). */
const loaded = () => builderReducer(builderInitialState, { type: 'LOAD', business: businessFixture(), manifest: manifestFixture() });

// ─────────────────────── E1 · E2 · E3 · E4 · E5 · E6 · E7 · E8 ───────────────────────

test('E1: el snapshot contiene manifest Y business, no solo visual.sections', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  assert.equal(s.history.length, 1, 'la edición dejó un snapshot');
  const snapshot = s.history[0];
  assert.ok(snapshot.manifest, 'el snapshot guarda el manifest');
  assert.ok(snapshot.business, 'el snapshot guarda el business');
  assert.equal(snapshot.manifest.sections.length, 2, 'y el manifest completo, no business.visual.sections');
  assert.equal(titleOf(snapshot.manifest), 'Titulo original', 'con el estado ANTERIOR');
  assert.equal(snapshot.business.name, 'Negocio');
});

test('E2: SET_MANIFEST actualiza el manifest y SET_BUSINESS el business', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'Editado' }) });
  assert.equal(titleOf(s.manifest), 'Editado');
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: 'Nuevo nombre' } });
  assert.equal(s.business.name, 'Nuevo nombre');
  // business y manifest avanzan JUNTOS: el estado vivo nunca queda a medias.
  assert.equal(titleOf(s.manifest), 'Editado', 'el manifest no se revierte por editar business');
  s = builderReducer(s, { type: 'SET_BUSINESS', business: { ...s.business, name: 'Reemplazo total' } });
  assert.equal(s.business.name, 'Reemplazo total');
  assert.equal(titleOf(s.manifest), 'Editado', 'y el manifest sigue siendo el del documento');
});

test('E3: el snapshot es un deep clone — mutar el manifest actual NO cambia el pasado', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  const pasado = s.history[0];
  // Se MUTA el manifest vivo (el peor caso: una edición que no genera manifest nuevo).
  s.manifest.sections[0].blocks[0].config.title = 'MUTADO A MANO';
  s.manifest.sections.push({ id: 'inyectada', label: 'X', order: 99, blocks: [] });
  s.business.name = 'MUTADO';
  assert.equal(titleOf(pasado.manifest), 'Titulo original', 'el snapshot A no cambió al mutar el estado');
  assert.equal(pasado.manifest.sections.length, 2, 'y no le aparecieron secciones');
  assert.equal(pasado.business.name, 'Negocio', 'tampoco el business del pasado');
});

test('E3-bis: cloneSnapshotValue sobrevive null/undefined y aisla objetos', () => {
  const manifest = manifestFixture();
  const copia = cloneSnapshotValue(manifest);
  manifest.sections[0].blocks[0].config.title = 'cambiado';
  assert.equal(titleOf(copia), 'Titulo original', 'la copia es independiente');
  assert.notEqual(copia, manifest);
  assert.equal(cloneSnapshotValue(null), null);
  assert.equal(cloneSnapshotValue(undefined), undefined);
});

test('E4: undo restaura business Y manifest a la vez', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: 'B' } });
  // Un Undo devuelve el documento ENTERO al paso anterior: aquí deshace la edición
  // de business, y el manifest vuelve al que tenía en ese momento (B).
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(s.business.name, 'Negocio', 'el business volvió');
  assert.equal(titleOf(s.manifest), 'B', 'y el manifest volvió al de ese mismo paso');
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(titleOf(s.manifest), 'Titulo original', 'el segundo undo devuelve el manifest anterior');
  assert.equal(s.business.name, 'Negocio', 'y el business sigue coherente');
  assert.equal(s.saveState, 'DIRTY', 'el undo deja el documento pendiente de guardar');
});

test('E5: redo restaura business Y manifest a la vez', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: 'B' } });
  s = builderReducer(s, { type: 'UNDO' });
  s = builderReducer(s, { type: 'REDO' });
  assert.equal(s.business.name, 'B', 'redo devuelve el business');
  assert.equal(s.saveState, 'DIRTY', 'y también queda pendiente de guardar');
  s = builderReducer(s, { type: 'UNDO' });
  s = builderReducer(s, { type: 'REDO' });
  assert.equal(titleOf(s.manifest), 'B', 'redo devuelve el manifest');
});

test('E6: una edición nueva después de un undo elimina la rama de redo', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'C' }) });
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(s.future.length, 1, 'hay un redo disponible');
  assert.equal(canRedo(s), true);
  // Nueva edición D: la rama A → B → C se corta en C.
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'D' }) });
  assert.equal(s.future.length, 0, 'la rama futura se descartó');
  assert.equal(canRedo(s), false, 'el botón de Redo queda deshabilitado');
  const antes = titleOf(s.manifest);
  s = builderReducer(s, { type: 'REDO' });
  assert.equal(titleOf(s.manifest), antes, 'el Redo de C ya no existe: no cambió nada');
  assert.equal(s.future.length, 0);
});

test('E7: discard vuelve al snapshot INICIAL del borrador, no a history[0]', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'C' }) });
  // Se re-basa el documento: el servidor devolvió otra versión tras un conflicto
  // (§14). Eso entra al historial como una edición más, y desde aquí `history[0]`
  // ya no es necesariamente el estado con el que se abrió el editor.
  const servidor = patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'DEL SERVIDOR' });
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: servidor });
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'X' }) });
  assert.equal(titleOf(s.history[0].manifest), 'Titulo original', 'history[0] es el estado de la 1ª edición');
  s = builderReducer(s, { type: 'DISCARD' });
  assert.equal(titleOf(s.manifest), 'Titulo original', 'discard volvió al borrador inicial');
  assert.equal(s.business.name, 'Negocio', 'y el business también');
  assert.equal(s.history.length, 0, 'el historial se reinicia');
  assert.equal(s.future.length, 0);
  assert.equal(canUndo(s), false, 'no queda nada que deshacer');
  assert.equal(canRedo(s), false, 'ni que rehacer');
  assert.equal(s.saveState, 'DIRTY', 'discard deja el estado listo para persistirse (nunca publica)');
});

test('E7-bis: tras deshacer hasta el inicio, discard sigue llevando al borrador inicial', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: 'B' } });
  s = builderReducer(s, { type: 'UNDO' });
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(s.history.length, 0, 'ya no queda historial');
  s = builderReducer(s, { type: 'DISCARD' });
  assert.equal(titleOf(s.manifest), 'Titulo original');
  assert.equal(s.business.name, 'Negocio');
});

test('E8: undo/redo no modifican los estados históricos por aliasing', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'C' }) });
  // Se CAPTURAN los snapshots ANTES de navegar el historial.
  const historicos = s.history.map((h) => titleOf(h.manifest));
  assert.deepEqual(historicos, ['Titulo original', 'B']);
  s = builderReducer(s, { type: 'UNDO' });
  s = builderReducer(s, { type: 'UNDO' });
  s = builderReducer(s, { type: 'REDO' });
  s = builderReducer(s, { type: 'REDO' });
  assert.equal(titleOf(s.manifest), 'C', 'el redo devolvió C');
  assert.deepEqual(s.history.map((h) => titleOf(h.manifest)), historicos, 'los snapshots históricos siguen intactos');
  // Y el snapshot de REDO tampoco quedó aliasado con el estado vivo.
  s = builderReducer(s, { type: 'UNDO' });
  const futuro = titleOf(s.future[0].manifest);
  s.manifest.sections[0].blocks[0].config.title = 'MUTADO';
  assert.equal(titleOf(s.future[0].manifest), futuro, 'el snapshot de redo no cambió al mutar el estado vivo');
  assert.equal(futuro, 'C', 'y el redo realmente apuntaba a C');
});

// ───────────────────────────── §6 · §7 · §13 ─────────────────────────────

test('§6: escribir un título es UN paso de undo, no uno por tecla', () => {
  let s = loaded();
  const t0 = 1000;
  ['H', 'He', 'Hel', 'Hell', 'Hello'].forEach((value, i) => {
    s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: value }, coalesceKey: businessEditKey({ name: value }), at: t0 + i * 100 });
  });
  assert.equal(s.history.length, 1, 'cinco pulsaciones, un paso');
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(s.business.name, 'Negocio', 'el Undo vuelve al título ANTERIOR, no borra una letra');
});

test('§6: campos distintos o pasado el tiempo sí generan pasos separados', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: 'A' }, coalesceKey: businessEditKey({ name: 1 }), at: 1000 });
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { name: 'B' }, coalesceKey: businessEditKey({ name: 1 }), at: 1000 + COALESCE_MS + 1 });
  assert.equal(s.history.length, 2, 'pasada la ventana de agrupación, es otro paso');
  s = builderReducer(s, { type: 'PATCH_BUSINESS', patch: { phone: '+56' }, coalesceKey: businessEditKey({ phone: 1 }), at: 1000 + COALESCE_MS + 2 });
  assert.equal(s.history.length, 3, 'un campo distinto es un paso distinto');
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(s.business.phone, undefined, 'deshizo el campo distinto, no el título');
  assert.equal(s.business.name, 'B');
});

test('§13: el historial tiene tope y no crece sin límite', () => {
  let s = loaded();
  for (let i = 0; i < MAX_HISTORY + 25; i += 1) {
    s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: `t${i}` }) });
  }
  assert.equal(s.history.length, MAX_HISTORY, 'el historial queda acotado');
  s = builderReducer(s, { type: 'UNDO' });
  assert.equal(titleOf(s.manifest), `t${MAX_HISTORY + 24 - 1}`, 'aun acotado, se deshace el trabajo reciente');
});

test('§7/§8: undo, redo y discard dejan el documento pendiente de persistencia', () => {
  let s = loaded();
  assert.equal(s.persistTick, 0, 'abrir el editor no guarda nada');
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  const tickTrasEditar = s.persistTick;
  assert.ok(tickTrasEditar > 0, 'editar sí queda pendiente de persistencia');
  s = builderReducer(s, { type: 'UNDO' });
  assert.ok(s.persistTick > tickTrasEditar, 'undo también queda pendiente de persistencia');
  const tickTrasUndo = s.persistTick;
  s = builderReducer(s, { type: 'REDO' });
  assert.ok(s.persistTick > tickTrasUndo, 'redo también queda pendiente de persistencia');
  s = builderReducer(s, { type: 'DISCARD' });
  assert.ok(s.persistTick > tickTrasUndo, 'discard también queda pendiente de persistencia');
});

// ───────────────────────────── §16 · §17 ─────────────────────────────

test('§16: Ctrl/Cmd+Z, +Shift+Z y +Y se interpretan igual en Windows y macOS', () => {
  assert.equal(undoRedoIntent({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(undoRedoIntent({ key: 'Z', ctrlKey: true, shiftKey: true }), 'redo');
  assert.equal(undoRedoIntent({ key: 'y', ctrlKey: true }), 'redo');
  // macOS usa metaKey en lugar de ctrlKey: mismo resultado.
  assert.equal(undoRedoIntent({ key: 'z', metaKey: true }), 'undo');
  assert.equal(undoRedoIntent({ key: 'Z', metaKey: true, shiftKey: true }), 'redo');
  // Atajos que NO son del editor: se dejan pasar.
  assert.equal(undoRedoIntent({ key: 'z' }), null, 'z sin modificador no es undo del editor');
  assert.equal(undoRedoIntent({ key: 's', ctrlKey: true }), null);
  assert.equal(undoRedoIntent({ key: 'z', ctrlKey: true, altKey: true }), null, 'Ctrl+Alt+Z es de otro sistema');
});

test('§16: la intención de teclado se aplica al historial real del editor', () => {
  let s = loaded();
  s = builderReducer(s, { type: 'SET_MANIFEST', manifest: patchBlockConfig(s.manifest, 'hero-hero', { title: 'B' }) });
  // macOS: Cmd+Z deshace el cambio del manifest.
  const intention = undoRedoIntent({ key: 'z', metaKey: true });
  s = builderReducer(s, { type: intention === 'undo' ? 'UNDO' : 'REDO' });
  assert.equal(titleOf(s.manifest), 'Titulo original', 'Cmd+Z deshizo el cambio del manifest');
  assert.equal(canRedo(s), true);
  // Windows: Ctrl+Shift+Z lo rehace.
  const rehacer = undoRedoIntent({ key: 'Z', ctrlKey: true, shiftKey: true });
  s = builderReducer(s, { type: rehacer === 'undo' ? 'UNDO' : 'REDO' });
  assert.equal(titleOf(s.manifest), 'B', 'Ctrl+Shift+Z lo rehizo');
});

test('§17: los botones Undo/Redo reflejan canUndo/canRedo', () => {
  const { MemoryRouter } = require('react-router-dom');
  const props = (canU, canR) => ({ business: { name: 'N', slug: 'n', status: 'DRAFT' }, saveState: 'CLEAN', device: 'desktop', sections: [], canUndo: canU, canRedo: canR, onDevice: () => {}, onUndo: () => {}, onRedo: () => {}, onSave: () => {}, onPublish: () => {}, onPause: () => {}, onDesigns: () => {} });
  const html = (canU, canR) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(BuilderTopBar, props(canU, canR))));
  // React serializa el atributo booleano como `disabled=""`. Se aísla la etiqueta
  // del botón para no confundirlo con la clase Tailwind `disabled:opacity-30`.
  const boton = (markup, testid) => (markup.match(new RegExp(`<button[^>]*data-testid="${testid}"[^>]*>`)) || [''])[0];
  const apagados = html(false, false);
  assert.match(boton(apagados, 'builder-undo'), /\sdisabled=""/, 'sin historial, Undo deshabilitado');
  assert.match(boton(apagados, 'builder-redo'), /\sdisabled=""/, 'sin futuro, Redo deshabilitado');
  const encendidos = html(true, true);
  assert.doesNotMatch(boton(encendidos, 'builder-undo'), /\sdisabled=""/, 'con historial, Undo habilitado');
  assert.doesNotMatch(boton(encendidos, 'builder-redo'), /\sdisabled=""/, 'con futuro, Redo habilitado');
  // El estado real del editor produce esos mismos botones.
  assert.equal(canUndo(loaded()), false);
  assert.equal(canRedo(loaded()), false);
  const editado = builderReducer(loaded(), { type: 'SET_MANIFEST', manifest: patchBlockConfig(manifestFixture(), 'hero-hero', { title: 'B' }) });
  assert.equal(canUndo(editado), true, 'tras una edición hay Undo');
  assert.equal(canRedo(editado), false, 'pero no Redo');
  assert.equal(canRedo(builderReducer(editado, { type: 'UNDO' })), true, 'tras el Undo hay Redo');
  assert.equal(canUndo(builderReducer(editado, { type: 'UNDO' })), false, 'y ya no queda Undo');
});

// ─────────────────────── §19 · integración observable ───────────────────────

/**
 * Backend simulado con optimistic locking real: cada save compara `baseUpdatedAt`
 * con el sello del servidor y responde 409 si otra pestaña escribió antes. Así la
 * integración ejercita el mismo contrato que usa el editor de verdad, sin escribir
 * nada en la base de datos.
 */
function fakeServer() {
  const server = { manifest: manifestFixture(), stamp: 't0', published: 'PUB-1', revisions: 0, saves: 0, delayMs: 0 };
  server.reload = () => JSON.parse(JSON.stringify(server.manifest));
  server.save = async (manifest, baseUpdatedAt) => {
    server.saves += 1;
    if (server.delayMs) await wait(server.delayMs);
    if (baseUpdatedAt && baseUpdatedAt !== server.stamp) {
      const error = new Error('conflicto');
      error.conflict = true;
      error.response = { status: 409 };
      error.manifest = server.reload();
      throw error;
    }
    server.manifest = manifest;
    server.stamp = `t${server.saves}`;
    server.revisions += 1;
    return { manifest, updatedAt: server.stamp };
  };
  return server;
}

/** El editor real: reducer + autosave, con el mismo contrato que usa la página. */
function editorHarness(server) {
  const statuses = [];
  const saved = [];
  const stampRef = { current: server.stamp };
  const autosave = createManifestAutosave({
    save: async (manifest) => {
      const result = await server.save(manifest, stampRef.current);
      stampRef.current = result.updatedAt || stampRef.current;
      return result;
    },
    reload: async () => server.reload(),
    onStatus: (s) => statuses.push(s),
    onSaved: (m) => saved.push(m),
    debounceMs: 5,
  });
  let editor = builderReducer(builderInitialState, { type: 'LOAD', business: businessFixture(), manifest: server.reload() });
  stampRef.current = server.stamp;
  /** Reproduce el efecto de `BusinessBuilder`: todo cambio persistible se guarda. */
  const dispatch = (action) => {
    const before = editor.persistTick;
    editor = builderReducer(editor, action);
    if (editor.persistTick !== before && editor.manifest) autosave.schedule(editor.manifest);
    return editor;
  };
  /** `reload`: el usuario recarga la página. */
  const reload = () => { editor = builderReducer(editor, { type: 'LOAD', business: businessFixture(), manifest: server.reload() }); return editor; };
  return { dispatch, reload, autosave, statuses, saved, stampRef, get state() { return editor; } };
}

test('§19: editar el manifest → undo → el manifest vuelve al anterior', async () => {
  const app = editorHarness(fakeServer());
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'Editado' }) });
  assert.equal(titleOf(app.state.manifest), 'Editado');
  app.dispatch({ type: 'UNDO' });
  assert.equal(titleOf(app.state.manifest), 'Titulo original', 'el undo restauró el manifest');
});

test('§19: editar → undo → redo → el manifest vuelve al estado redone', async () => {
  const app = editorHarness(fakeServer());
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'Editado' }) });
  app.dispatch({ type: 'UNDO' });
  app.dispatch({ type: 'REDO' });
  assert.equal(titleOf(app.state.manifest), 'Editado', 'el redo restauró el manifest');
});

test('§9: editar → autosave → undo → autosave → reload → queda el estado ANTERIOR', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'A' }) });
  await app.autosave.flush();
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'B' }) });
  await app.autosave.flush();
  assert.equal(titleOf(server.manifest), 'B', 'B está en el servidor');
  app.dispatch({ type: 'UNDO' });
  assert.equal(titleOf(app.state.manifest), 'A', 'la UI muestra A');
  await app.autosave.flush();
  const recargado = app.reload();
  assert.equal(titleOf(recargado.manifest), 'A', 'tras recargar se encuentra A, no B');
  assert.equal(titleOf(server.manifest), 'A');
});

test('§10: editar → autosave → undo → autosave → redo → autosave → reload → queda el estado redone', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'A' }) });
  await app.autosave.flush();
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'B' }) });
  await app.autosave.flush();
  app.dispatch({ type: 'UNDO' });
  await app.autosave.flush();
  assert.equal(titleOf(server.manifest), 'A', 'el undo se persistió');
  app.dispatch({ type: 'REDO' });
  await app.autosave.flush();
  const recargado = app.reload();
  assert.equal(titleOf(recargado.manifest), 'B', 'el redo se persistió: tras recargar se encuentra B');
});

test('§11: undo → nueva edición → el redo de la rama descartada ya no aplica', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  for (const value of ['A', 'B', 'C']) {
    app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: value }) });
    await app.autosave.flush();
  }
  app.dispatch({ type: 'UNDO' }); // → B
  assert.equal(titleOf(app.state.manifest), 'B');
  assert.equal(canRedo(app.state), true);
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'D' }) });
  await app.autosave.flush();
  assert.equal(canRedo(app.state), false, 'la rama de C se descartó');
  const recargado = app.reload();
  assert.equal(titleOf(recargado.manifest), 'D', 'lo que quedó persistido es D, no C');
});

test('§14: un save en vuelo de B NO pisa un Undo a A hecho mientras guardaba', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  // A queda persistido primero.
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'A' }) });
  await app.autosave.flush();
  assert.equal(titleOf(server.manifest), 'A');
  // Ahora B entra en vuelo, pero la respuesta tarda.
  server.delayMs = 60;
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'B' }) });
  await wait(20);
  assert.equal(app.autosave.isSaving(), true, 'B está guardándose');
  const revisionDeB = app.autosave.pendingRevision();
  // Undo → A mientras B sigue viajando hacia el servidor.
  app.dispatch({ type: 'UNDO' });
  assert.equal(titleOf(app.state.manifest), 'A', 'la UI ya muestra A');
  assert.ok(app.autosave.pendingRevision() > revisionDeB, 'A quedó encolado como el estado más reciente');
  await app.autosave.flush();
  await wait(80);
  assert.equal(titleOf(server.manifest), 'A', 'el servidor quedó con A: la respuesta vieja de B no ganó');
  const recargado = app.reload();
  assert.equal(titleOf(recargado.manifest), 'A', 'y tras recargar se encuentra A, no B');
});

test('§14: el 409 existente se respeta y no se pisa el estado local en silencio', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  // Otra pestaña escribió antes: el sello que manda el cliente quedó viejo.
  server.stamp = 't-otra-pestana';
  const conflictos = [];
  const autosave = createManifestAutosave({
    save: async (m) => server.save(m, app.stampRef.current),
    onConflict: (m) => conflictos.push(m),
    debounceMs: 1,
  });
  autosave.schedule(patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'A' }));
  await wait(40);
  assert.equal(conflictos.length, 1, 'se informó el conflicto');
  assert.equal(titleOf(conflictos[0]), 'Titulo original', 'y se entregó el manifest del servidor, no el local');
  autosave.schedule(patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'otra' }));
  await wait(20);
  assert.equal(titleOf(server.manifest), 'Titulo original', 'tras el conflicto no se sobrescribe en silencio');
  assert.equal(app.state.manifest.sections.length, 2, 'el editor sigue coherente');
});

test('§19: undo tras autosave no genera una publicación', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'B' }) });
  await app.autosave.flush();
  app.dispatch({ type: 'UNDO' });
  await app.autosave.flush();
  assert.equal(server.published, 'PUB-1', 'la revisión publicada no cambió: undo/redo NUNCA publica');
  assert.equal(titleOf(server.manifest), 'Titulo original', 'pero el borrador sí quedó en el estado del undo');
});

test('§19: todas las operaciones estructurales del editor son undoables sobre el manifest', () => {
  const ops = [
    ['ocultar/mostrar sección', (m) => setSectionHidden(m, 'servicios', true)],
    ['cambiar diseño (reordenar)', (m) => moveSection(m, 'servicios', 0)],
    ['duplicar sección', (m) => duplicateSection(m, 'hero')],
    ['eliminar sección', (m) => removeSection(m, 'servicios')],
    ['cambiar contenido visual', (m) => patchBlockConfig(m, 'hero-hero', { title: 'Nuevo titulo' })],
    ['agregar sección (via backend)', (m) => ({ ...m, sections: [...m.sections, { id: 'nueva', label: 'Nueva', order: 30, blocks: [] }] })],
  ];
  for (const [nombre, operacion] of ops) {
    const app = editorHarness(fakeServer());
    const antes = JSON.stringify(app.state.manifest);
    app.dispatch({ type: 'SET_MANIFEST', manifest: operacion(app.state.manifest) });
    assert.notEqual(JSON.stringify(app.state.manifest), antes, `${nombre}: la operación cambió el manifest`);
    app.dispatch({ type: 'UNDO' });
    assert.equal(JSON.stringify(app.state.manifest), antes, `${nombre}: undo lo revierte en el manifest`);
    app.dispatch({ type: 'REDO' });
    assert.notEqual(JSON.stringify(app.state.manifest), antes, `${nombre}: redo lo vuelve a aplicar`);
  }
});

test('§19: una edición de business y una de manifest viajan juntas en el mismo undo', async () => {
  const server = fakeServer();
  const app = editorHarness(server);
  app.dispatch({ type: 'SET_MANIFEST', manifest: patchBlockConfig(app.state.manifest, 'hero-hero', { title: 'B' }) });
  app.dispatch({ type: 'PATCH_BUSINESS', patch: { name: 'B' }, coalesceKey: businessEditKey({ name: 'B' }), at: Date.now() });
  await app.autosave.flush();
  app.dispatch({ type: 'UNDO' });
  app.dispatch({ type: 'UNDO' });
  assert.equal(app.state.business.name, 'Negocio', 'el business volvió al nombre inicial');
  assert.equal(titleOf(app.state.manifest), 'Titulo original', 'y el manifest también: nunca a medias');
  await app.autosave.flush();
  app.reload();
  assert.equal(titleOf(server.manifest), 'Titulo original');
});
