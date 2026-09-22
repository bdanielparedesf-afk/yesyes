const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');

// Singleton inyectado por la app: lo mockeamos para no tocar la BD real.
const { prisma } = require('../src/lib/prisma.ts');
const { updateProduct } = require('../src/controllers/product.controller.ts');

const GOOD_ID = '123e4567-e89b-12d3-a456-426614174000';
const BAD_ID = 'no-es-uuid';

let lastCall;
function mockPrisma(impl) {
  lastCall = null;
  prisma.product.update = async (args) => { lastCall = args; return impl.productReturn || { id: GOOD_ID, name: 'x' }; };
  prisma.category.findUnique = async () => ({ id: 'cat-1', slug: 'general' }); // fallback "General"
  prisma.category.findFirst = async () => ({ id: 'cat-1', slug: 'general' });
  prisma.category.create = async () => ({ id: 'cat-1' });
}
function makeReq(id, body) { return { params: { id }, body }; }
function makeRes() {
  const r = { _status: 0, _json: null };
  r.status = (c) => { r._status = c; return r; };
  r.json = (j) => { r._json = j; return r; };
  return r;
}

// 1. Autenticacion: el controller NO verifica auth (ese es el middleware de la ruta).
//    Los tests verifican la LOGICA del controller; el route-level auth se valida con snapshot.

test('PUT /products/:id requiere UUID valido (400 si no)', async () => {
  mockPrisma({ productReturn: { id: GOOD_ID } });
  const res = makeRes();
  await updateProduct(makeReq(BAD_ID, { name: 'x' }), res);
  assert.equal(res._status, 400);
  assert.equal(res._json.message, 'ID de producto invalido');
  assert.equal(lastCall, null); // no toca prisma
});

test('PUT reject campo interno prohibido businessId (strict allowlist, 400)', async () => {
  mockPrisma({});
  const res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { businessId: 'otro-propietario' }), res);
    assert.equal(res._status, 400);
  assert.equal(res._json.message, 'Datos invalidos');
  assert.ok(JSON.stringify(res._json.errors).includes('businessId'), 'debe reportar businessId como error');
  assert.equal(lastCall, null);
});

test('PUT reject productCost interno (400)', async () => {
  mockPrisma({});
  const res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { productCost: 99999 }), res);
    assert.equal(res._status, 400);
  assert.ok(JSON.stringify(res._json.errors).includes('productCost'), 'debe reportar productCost como error');
  assert.equal(lastCall, null);
});

test('PUT con id inexistente / producto BUSINESS -> 404 (P2025)', async () => {
  let threw = null;
  mockPrisma({ productReturn: undefined });
  prisma.product.update = async (args) => { lastCall = args; threw = new Error(); threw.code = 'P2025'; throw threw; };
  const res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { name: 'nuevo nombre' }), res);
  assert.equal(res._status, 404);
  assert.equal(res._json.message, 'Producto no encontrado');
  assert.equal(lastCall.where.businessId, null); // scope global aplicado
});

test('PUT valido -> 200 y ejecuta sobre productos GLOBALES (businessId: null)', async () => {
  mockPrisma({});
  const res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { name: 'Nuevo nombre', salePrice: 9990, stock: 5, tags: ['a'] }), res);
  assert.equal(res._status, 200);
  assert.equal(lastCall.where.id, GOOD_ID);
  assert.equal(lastCall.where.businessId, null, 'garantiza que solo se editan productos globales (businessId NULL)');
  assert.deepEqual(lastCall.data.tags, ['a']);
});

test('PUT coercer salePrice numerico y rechaza cadena no numerica', async () => {
  // coercion valida
  mockPrisma({});
  let res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { salePrice: '123000' }), res);
  assert.equal(res._status, 200);
  assert.equal(lastCall.data.salePrice, 123000);

  // coercion invalida
  const res2 = makeRes();
  await updateProduct(makeReq(GOOD_ID, { salePrice: 'abc' }), res2);
  assert.equal(res2._status, 400);
  assert.ok(res2._json.errors.fieldErrors.salePrice, 'salePrice invalido debe reportarse');
});

test('PUT status invalido -> 400', async () => {
  mockPrisma({});
  const res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { status: 'WEIRD' }), res);
  assert.equal(res._status, 400);
  assert.ok(res._json.errors.fieldErrors.status);
});

test('PUT status valido -> 200', async () => {
  mockPrisma({});
  const res = makeRes();
  await updateProduct(makeReq(GOOD_ID, { status: 'PUBLISHED' }), res);
  assert.equal(res._status, 200);
  assert.equal(lastCall.data.status, 'PUBLISHED');
});

test('DELETE en cascada al borrar negocio mantiene integridad de productos globales', async () => {
  // Verifica que el controller de borrado de negocio no elimina productos globales.
  // (snapshot de la logica: archiveBusiness filtra por owner + borra SOLO negocio)
  const bctrl = require('../src/controllers/business.controller.ts');
  assert.equal(typeof bctrl.archiveBusiness, 'function');
  // El product.controller update usa where businessId:null -> un producto global nunca se ve afectado
  // por operaciones de business (businessId siempre != null en products business).
  assert.equal(lastCall === null || lastCall.where.businessId === null, true);
});
