const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '../src/business/dashboard/templateSync.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sourceModule = new Module(sourcePath, module);
sourceModule.filename = sourcePath;
sourceModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
sourceModule._compile(output, sourcePath);
const { createLatestTemplatesRequest, reconcileTemplateId } = sourceModule.exports;

const template = (id, category) => ({ id, category, code: `${category}_01`, name: id, capabilities: [] });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function observableRequest(responses) {
  const state = { visible: [], selected: '', status: 'idle' };
  const controller = createLatestTemplatesRequest(
    (category) => new Promise((resolve, reject) => { responses[category].resolve = resolve; responses[category].reject = reject; }),
    {
      onStart: (category) => { state.visible = []; state.status = `loading:${category}`; },
      onSuccess: (category, templates) => {
        state.visible = templates;
        state.selected = reconcileTemplateId(state.selected, templates);
        state.status = `ready:${category}`;
      },
      onError: (category) => { state.visible = []; state.selected = ''; state.status = `error:${category}`; },
    },
  );
  return { state, controller };
}

test('caso 1: una categoría FLOWERS inicial solicita y muestra FLOWERS', async () => {
  const responses = { FLOWERS: deferred() };
  const { state, controller } = observableRequest(responses);
  const loaded = controller.load('FLOWERS');
  assert.equal(state.status, 'loading:FLOWERS');
  responses.FLOWERS.resolve([template('flowers-1', 'FLOWERS')]);
  await loaded;
  assert.equal(state.status, 'ready:FLOWERS');
  assert.deepEqual(state.visible.map(({ id }) => id), ['flowers-1']);
});

test('caso 2: una categoría inicialmente vacía no solicita HAIR y luego sigue detail FLOWERS', async () => {
  const responses = { FLOWERS: deferred() };
  const requested = [];
  const controller = createLatestTemplatesRequest(
    (category) => { requested.push(category); return responses[category].promise; },
    { onStart: () => {}, onSuccess: () => {}, onError: () => {} },
  );
  assert.equal(requested.length, 0, 'sin detail no se ejecuta una request de fallback');
  const loaded = controller.load('FLOWERS');
  responses.FLOWERS.resolve([template('flowers-1', 'FLOWERS')]);
  await loaded;
  assert.deepEqual(requested, ['FLOWERS']);
});

test('caso 3: una respuesta HAIR obsoleta se ignora y FLOWERS queda vigente', async () => {
  const responses = { HAIR: deferred(), FLOWERS: deferred() };
  const { state, controller } = observableRequest(responses);
  const hair = controller.load('HAIR');
  const flowers = controller.load('FLOWERS');
  responses.HAIR.resolve([template('hair-1', 'HAIR')]);
  await hair;
  assert.deepEqual(state.visible, [], 'HAIR no puede renderizar después de iniciar FLOWERS');
  responses.FLOWERS.resolve([template('flowers-1', 'FLOWERS')]);
  await flowers;
  assert.equal(state.status, 'ready:FLOWERS');
  assert.deepEqual(state.visible.map(({ id }) => id), ['flowers-1']);
});

test('caso 4: la respuesta actual deja visibles los códigos de FLOWERS', async () => {
  const response = deferred();
  const visibleCodes = [];
  const controller = createLatestTemplatesRequest(
    () => response.promise,
    {
      onStart: () => { visibleCodes.length = 0; },
      onSuccess: (_, templates) => { visibleCodes.push(...templates.map(({ code }) => code)); },
      onError: () => { visibleCodes.length = 0; },
    },
  );
  const loaded = controller.load('FLOWERS');
  response.resolve([template('flowers-1', 'FLOWERS'), template('flowers-2', 'FLOWERS')]);
  await loaded;
  assert.deepEqual(visibleCodes, ['FLOWERS_01', 'FLOWERS_01']);
});

test('caso 5: un templateId de HAIR se limpia al cargar templates FLOWERS', () => {
  assert.equal(reconcileTemplateId('hair-1', [template('flowers-1', 'FLOWERS')]), '');
  assert.equal(reconcileTemplateId('flowers-1', [template('flowers-1', 'FLOWERS')]), 'flowers-1');
});

test('caso 6: el error vigente limpia contenido y selección para mostrar estado de error', async () => {
  const response = deferred();
  const { state, controller } = observableRequest({ FLOWERS: response });
  state.selected = 'hair-1';
  const loaded = controller.load('FLOWERS');
  response.reject(new Error('network'));
  await loaded;
  assert.equal(state.status, 'error:FLOWERS');
  assert.deepEqual(state.visible, []);
  assert.equal(state.selected, '');
});

test('el editor no reintroduce HAIR como fallback y comunica carga y error en español', () => {
  const config = fs.readFileSync(path.join(__dirname, '../src/business/dashboard/ConfigSection.tsx'), 'utf8');
  assert.doesNotMatch(config, /category:\s*['"]HAIR['"]/);
  assert.ok(config.includes('Cargando plantillas…'));
  assert.ok(config.includes('No pudimos cargar las plantillas. Intenta nuevamente.'));
});
