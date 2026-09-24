const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');
const pub = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');
const productCtrl = fs.readFileSync(__dirname + '/../src/controllers/product.controller.ts', 'utf8');

test('products: el catálogo Business usa su propia entidad y nunca Product', () => {
  assert.ok(routes.includes('prisma.businessCatalogItem.create'), 'create debe usar BusinessCatalogItem');
  assert.ok(routes.includes('prisma.businessCatalogItem.findMany'), 'listado debe usar BusinessCatalogItem');
  assert.ok(!routes.includes('prisma.product.create'), 'catálogo Business no crea Product');
});

test('products: PUT mantiene allow-list y scoping por businessId', () => {
  assert.ok(routes.includes("for (const key of ['name', 'image', 'category', 'cta', 'currency'])"));
  const putSection = routes.slice(routes.indexOf("router.put('/:businessId/products/:productId'"));
  assert.ok(!putSection.split('router.')[0].includes('businessId, data'), 'no actualiza ownership desde payload');
});

test('products: DELETE business es físico y aislado por businessId', () => {
  assert.ok(routes.includes("router.delete('/:businessId/products/:productId', requireBusinessOwner"));
  assert.ok(routes.includes('prisma.businessCatalogItem.deleteMany'));
  assert.ok(routes.includes("mode: 'HARD'"));
});

test('products: el listado publico filtra BusinessCatalogItem activo', () => {
  assert.ok(pub.includes('prisma.businessCatalogItem.findMany'));
  assert.ok(pub.includes('businessId: b.id, active: true'));
  assert.ok(!pub.includes('prisma.product.findMany'));
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
