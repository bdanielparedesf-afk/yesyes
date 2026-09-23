const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const { businessUpsertSchema, roleUpdateSchema } = require('../src/utils/business.ts');
const ctrl = fs.readFileSync(__dirname + '/../src/controllers/business.controller.ts', 'utf8');
const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');

test('anti-elevation: businessUpsertSchema strict rechaza ownerId/role/status del body', () => {
  const base = { name: 'Negocio', category: 'HAIR' };
  assert.equal(businessUpsertSchema.safeParse(base).success, true);
  assert.equal(businessUpsertSchema.safeParse({ ...base, ownerId: 'victima' }).success, false);
  assert.equal(businessUpsertSchema.safeParse({ ...base, role: 'ADMIN' }).success, false);
  assert.equal(businessUpsertSchema.safeParse({ ...base, userId: 'otro' }).success, false);
  assert.equal(businessUpsertSchema.safeParse({ ...base, status: 'PUBLISHED' }).success, false);
});

test('anti-elevation: create usa req.user!.id y nunca el body', () => {
  assert.ok(ctrl.includes('ownerId: req.user!.id'));
  assert.ok(!ctrl.includes('req.body.ownerId'), 'controller no debe leer req.body.ownerId');
  assert.ok(!ctrl.includes('req.body.userId'), 'controller no debe leer req.body.userId');
  assert.ok(!ctrl.includes('req.body.role'), 'controller no debe leer req.body.role');
});

test('anti-elevation: el rol BUSINESS solo se otorga si el usuario autenticado es CUSTOMER', () => {
  assert.ok(ctrl.includes("if (req.user!.role === 'CUSTOMER')"));
  assert.ok(ctrl.includes("role: 'BUSINESS' as any"));
});

test('anti-elevation: rutas de negocio nunca leen role/ownerId del body', () => {
  assert.ok(!routes.includes('req.body.ownerId'));
  assert.ok(!routes.includes('req.body.userId'));
  assert.ok(!routes.includes('req.body.role'));
});

test('anti-elevation: roleUpdateSchema es enum cerrado (CUSTOMER/BUSINESS/ADMIN)', () => {
  assert.equal(roleUpdateSchema.safeParse({ role: 'ADMIN' }).success, true);
  assert.equal(roleUpdateSchema.safeParse({ role: 'SUPERADMIN' }).success, false);
  assert.equal(roleUpdateSchema.safeParse({ role: 'ADMIN', id: 'x' }).success, false, 'strict');
});

test('anti-elevation: authenticate exige usuario antes de cualquier ruta business', () => {
  assert.ok(routes.indexOf('router.use(authenticate);') < routes.indexOf("router.get('/'"));
});
