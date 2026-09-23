const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const { serviceSchema } = require('../src/utils/business.ts');
const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');

test('services: schema valido pasa', () => {
  const r = serviceSchema.safeParse({ name: 'Corte de pelo', price: 10000, durationMin: 30, featured: true, active: true });
  assert.equal(r.success, true);
});

test('services: schema rechaza nombre vacio, precio negativo y duracion 0', () => {
  assert.equal(serviceSchema.safeParse({ name: '' }).success, false);
  assert.equal(serviceSchema.safeParse({ name: 'X', price: -1 }).success, false);
  assert.equal(serviceSchema.safeParse({ name: 'X', durationMin: 0 }).success, false);
  assert.equal(serviceSchema.safeParse({ name: 'X', image: 'no-url' }).success, false);
});

test('services: schema es strict (sin claves desconocidas)', () => {
  assert.equal(serviceSchema.safeParse({ name: 'X', businessId: 'otro' }).success, false);
  assert.equal(serviceSchema.safeParse({ name: 'X', ownerId: 'otro' }).success, false);
});

test('services: rutas CRUD exigen requireBusinessOwner', () => {
  const re = /router\.(get|post|put|delete)\('([^']*\/services[^']*)'/g;
  let m; let n = 0;
  while ((m = re.exec(routes))) {
    const after = routes.slice(m.index, m.index + 160);
    assert.ok(after.includes('requireBusinessOwner'), `${m[1].toUpperCase()} ${m[2]} sin requireBusinessOwner`);
    n += 1;
  }
  assert.equal(n, 4, `esperaba 4 rutas de servicios, habia ${n}`);
});

test('services: update y delete scoped por businessId (no burlable con id ajeno)', () => {
  assert.ok(routes.includes('where: { id: String(req.params.serviceId), businessId }'));
});
