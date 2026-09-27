const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadCopy() {
  const p = path.join(__dirname, '../src/business/builder/page-status-copy.ts');
  const compiled = ts.transpileModule(fs.readFileSync(p, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require, globalThis: {} });
  new vm.Script(compiled, { filename: p }).runInContext(context);
  return module.exports.pageStatusCopy;
}

const pageStatusCopy = loadCopy();
const base = {
  live: true,
  reason: 'OK',
  businessStatus: 'PUBLISHED',
  subscriptionStatus: 'ACTIVE',
  graceDaysLeft: 0,
  graceUntil: null,
};

test('con la pagina al dia no se muestra nada', () => {
  assert.equal(pageStatusCopy(base), null);
});

test('la GRACIA se avisa aunque la pagina siga en linea', () => {
  // Este es el que mas importa: si se oculta, el dueño se entera cuando ya
  // perdió las visitas y el aviso preventive pierde toda su función.
  const c = pageStatusCopy({
    ...base, live: true, reason: 'GRACE_ACTIVE', subscriptionStatus: 'PAST_DUE',
    graceDaysLeft: 3, graceUntil: '2026-10-01T00:00:00.000Z',
  });
  assert.ok(c, 'debe mostrarse aunque live=true');
  assert.equal(c.accion, 'pagar');
  assert.equal(c.tono, 'aviso');
  assert.match(c.titulo, /3 días/);
});

test('el singular de "día" no se rompe con 1', () => {
  const c = pageStatusCopy({ ...base, reason: 'GRACE_ACTIVE', subscriptionStatus: 'PAST_DUE', graceDaysLeft: 1 });
  assert.match(c.titulo, /1 día(?!s)/);
});

test('vencida llama a pagar y avisa que el contenido se conserva', () => {
  const c = pageStatusCopy({
    ...base, live: false, reason: 'EXPIRED', subscriptionStatus: 'PAST_DUE', graceDaysLeft: 0,
  });
  assert.equal(c.accion, 'pagar');
  assert.equal(c.tono, 'error');
  assert.match(c.cuerpo, /sigue guardado/);
});

test('un borrador nunca publicado NO se dice "dada de baja"', () => {
  // El dueño que recién está armando su página vería un banner rojo.
  assert.equal(pageStatusCopy({ ...base, live: false, reason: 'NOT_PUBLISHABLE', businessStatus: 'DRAFT' }), null);
  assert.equal(pageStatusCopy({ ...base, live: false, reason: 'EXPIRED', businessStatus: 'DRAFT' }), null);
});

test('una pausa del admin NO se acusa como cobro fallido', () => {
  // El backend colapsa PAUSED y EXPIRED en el mismo motivo; sin mirar el
  // estado real se le dice al dueño "no pudimos cobrar" y es falso.
  const c = pageStatusCopy({
    ...base, live: false, reason: 'EXPIRED', subscriptionStatus: 'PAUSED', graceDaysLeft: 0,
  });
  assert.equal(c.accion, 'reactivar');
  assert.doesNotMatch(c.cuerpo, /cobrar/);
  assert.match(c.titulo, /pausada/);
});

test('cancelada y sin plan van cada una por su lado', () => {
  const cancelada = pageStatusCopy({ ...base, live: false, reason: 'CANCELLED', subscriptionStatus: 'CANCELLED' });
  assert.equal(cancelada.accion, 'reactivar');

  const sinPlan = pageStatusCopy({ ...base, live: false, reason: 'NO_SUBSCRIPTION', subscriptionStatus: null });
  assert.equal(sinPlan.accion, 'ninguna');
  assert.equal(sinPlan.tono, 'info');
});

test('sin status no se rompe', () => {
  assert.equal(pageStatusCopy(null), null);
});

test('el copy sale con acentos: seerve sin "dias" ni "grace"', () => {
  // Ya se sirvio "dias de grace" al cliente final. Se fija el texto exacto.
  const vencida = pageStatusCopy({ ...base, live: false, reason: 'EXPIRED', subscriptionStatus: 'PAST_DUE' });
  const todo = [vencida.titulo, vencida.cuerpo].join(' ');
  assert.doesNotMatch(todo, /dias de grace|Intentalo|pagina|esta\b/);
});
