const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const { yesYesScope, dropshipScope, businessScope, isBusinessProduct } = require('../src/utils/business-scopes.ts');

const read = (p) => fs.readFileSync(__dirname + '/../src/' + p, 'utf8');

test('scopes: tienda y dropshipping = businessId NULL; negocio = businessId seteado', () => {
  assert.deepEqual(yesYesScope, { businessId: null });
  assert.deepEqual(dropshipScope, { businessId: null });
  assert.deepEqual(businessScope('b1'), { businessId: 'b1' });
  assert.equal(isBusinessProduct({ businessId: null }), false);
  assert.equal(isBusinessProduct({ businessId: 'b1' }), true);
});

test('priceSync solo procesa productos con businessId NULL', () => {
  assert.ok(read('jobs/priceSync.ts').includes('businessId: null'));
});

test('sync-engine AliExpress itera solo productos con businessId NULL', () => {
  const src = read('services/aliexpress-sync-engine.service.ts');
  const uses = (src.match(/businessId: null/g) || []).length;
  assert.ok(uses >= 3, `sync-engine deberia filtrar en todos sus queries, solo ${uses}`);
});

test('dropship import rechaza productos que ya pertenecen a un negocio', () => {
  const src = read('services/aliexpress-dropship.service.ts');
  assert.ok(src.includes('if ((product as any).businessId) throw'));
});

test('home/tienda/catalogo excluyen catalogos de negocios (businessId null)', () => {
  const src = read('controllers/product.controller.ts');
  const uses = (src.match(/businessId: null/g) || []).length;
  assert.ok(uses >= 6, `product.controller debe filtrar la tienda en todos lados, solo ${uses}`);
});

test('el producto business jamas entra a PUBLIC_PRODUCT_SELECT de la tienda', () => {
  const src = read('controllers/product.controller.ts');
  const start = src.indexOf('const PUBLIC_PRODUCT_SELECT = {');
  const end = src.indexOf('};', start);
  assert.ok(!src.slice(start, end).includes('businessId'));
});
