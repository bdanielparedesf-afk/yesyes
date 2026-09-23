const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');
const pub = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');
const productCtrl = fs.readFileSync(__dirname + '/../src/controllers/product.controller.ts', 'utf8');

test('products: el create Business fija businessId (nunca null)', () => {
  assert.ok(routes.includes("status: 'PUBLISHED' as any, businessId,"), 'create de producto business debe fijar businessId');
});

test('products: PUT con allow-list estricta que excluye businessId/categoryId', () => {
  assert.ok(routes.includes("for (const k of ['name', 'description', 'salePrice', 'stock', 'images', 'status'])"));
  const putSection = routes.slice(routes.indexOf("router.put('/:businessId/products/:productId'"));
  assert.ok(!putSection.split('router.')[0].includes('categoryId'), 'PUT no debe permitir cambiar categoria');
});

test('products: DELETE business existe con scoping y fallback logico (ARCHIVED)', () => {
  assert.ok(routes.includes("router.delete('/:businessId/products/:productId', requireBusinessOwner"));
  assert.ok(routes.includes("mode: 'ARCHIVED'"), 'fallback de borrado logico ausente');
  assert.ok(routes.includes("status: 'ARCHIVED' as any, hidden: true"));
});

test('products: el listado publico del negocio filtra businessId + PUBLISHED', () => {
  assert.ok(pub.includes('businessId: b.id'));
  assert.ok(pub.includes("status: 'PUBLISHED'"));
});

test('products: la tienda global solo ve productos con businessId NULL', () => {
  assert.ok(productCtrl.includes('businessId: null'), 'tienda sin filtro businessId null');
  assert.ok(productCtrl.includes('where: { id, businessId: null }'), 'update global debe excluir productos business');
});

test('products: PUBLIC_PRODUCT_SELECT de la tienda no filtra ni expone businessId', () => {
  const start = productCtrl.indexOf('const PUBLIC_PRODUCT_SELECT = {');
  const end = productCtrl.indexOf('};', start);
  const block = productCtrl.slice(start, end);
  assert.ok(!block.includes('businessId'));
});
