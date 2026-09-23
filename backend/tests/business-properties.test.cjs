const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const { propertySchema } = require('../src/utils/business.ts');
const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');
const pub = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');

test('properties: schema valido (venta y arriendo)', () => {
  const base = { title: 'Depto Centro', price: 50000, operation: 'VENTA', type: 'CASA' };
  assert.equal(propertySchema.safeParse(base).success, true);
  assert.equal(propertySchema.safeParse({ ...base, operation: 'ARRIENDO' }).success, true);
});

test('properties: rechaza operacion/tipo invalidos y precio negativo', () => {
  const base = { title: 'Depto', price: 100, operation: 'VENTA', type: 'CASA' };
  assert.equal(propertySchema.safeParse({ ...base, operation: 'ALQUILER' }).success, false);
  assert.equal(propertySchema.safeParse({ ...base, type: 'CASTILLO' }).success, false);
  assert.equal(propertySchema.safeParse({ ...base, price: -1 }).success, false);
  assert.equal(propertySchema.safeParse({ title: 'X', operation: 'VENTA', type: 'CASA' }).success, false, 'price es obligatorio');
});

test('properties: maximo 20 imagenes y solo URLs; schema strict', () => {
  const base = { title: 'D', price: 1, operation: 'VENTA', type: 'CASA' };
  const many = { ...base, images: Array.from({ length: 21 }, (_, i) => `https://x/${i}.jpg`) };
  assert.equal(propertySchema.safeParse(many).success, false);
  assert.equal(propertySchema.safeParse({ ...base, images: ['not-a-url'] }).success, false);
  assert.equal(propertySchema.safeParse({ ...base, businessId: 'otro' }).success, false);
});

test('properties: CRUD exige requireBusinessOwner y scoping por businessId', () => {
  const re = /router\.(get|post|put|delete)\('([^']*\/properties[^']*)'/g;
  let m; let n = 0;
  while ((m = re.exec(routes))) {
    const after = routes.slice(m.index, m.index + 160);
    assert.ok(after.includes('requireBusinessOwner'), `${m[1].toUpperCase()} ${m[2]} sin requireBusinessOwner`);
    n += 1;
  }
  assert.ok(n >= 4, `rutas de propiedades insuficientes: ${n}`);
  assert.ok(routes.includes('where: { id: String(req.params.propertyId), businessId }'));
});

test('properties: el detalle publico exige published=true', () => {
  assert.ok(pub.includes('id: String(req.params.propertyId), businessId: b.id, published: true'));
  assert.ok(pub.includes('published: true, available: true'));
});

test('properties: NO se modelan como Product (ruta usa prisma.property)', () => {
  assert.ok(routes.includes('prisma.property.create'), 'propiedades deben crear en tabla properties');
  assert.ok(!routes.includes('prisma.product.create({\n      data: {\n        businessId, title'), 'propiedad no debe crear Product');
});
