const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { buildImportPreview, publishAliExpressProduct } = require('../src/services/aliexpress-dropship.service.ts');

// Producto AliExpress realista con 3 variantes de distinto precio.
// buildImportPreview ya calcula cada variante individualmente (costo variante
// + envio correspondiente, mismo margen, conversion a CLP).
// A=$5.00, B=$6.00, C=$8.00, envio comun US$2.00, margen 100%, FX 950.
// Esperado A=(5+2)*2*950=13300, B=(6+2)*2*950=15200, C=(8+2)*2*950=19000.
function sku(id, price, stock) {
  return { sku_id: id, sku_price: String(price), sku_available_stock: stock, sku_attr: id, ae_sku_property_dtos: [] };
}
const product = {
  ae_item_base_info_dto: { subject: 'Calcetines test', detail: '<p>x</p>', category_id: 'ikit' },
  ae_multimedia_info_dto: { image_urls: 'http://img/1.jpg' },
  package_info_dto: {},
  ae_item_sku_info_dtos: [sku('A', '5.00', 10), sku('B', '6.00', 20), sku('C', '8.00', 30)],
};
function freight(cents) {
  return { delivery_options: [{ free_shipping: 'false', shipping_fee_cent: String(cents) }] };
}
function freightBySku(cents) {
  return { A: freight(cents), B: freight(cents), C: freight(cents) };
}

test('cada variante conserva su costo y calcula su venta individual (margen 100%)', () => {
  const preview = buildImportPreview({
    product, sourceUrl: 'https://es.aliexpress.com/item/1005008538858120.html',
    aliexpressId: '1005008538858120', marginPercent: 100, fxValue: 950,
    freightBySkuId: freightBySku(200),
  });
  assert.equal(preview.variants[0].costUsdCents, 500);
  assert.equal(preview.variants[1].costUsdCents, 600);
  assert.equal(preview.variants[2].costUsdCents, 800);
  assert.deepEqual(preview.variants.map(v => v.salePriceClp), [13300, 15200, 19000]);
});

test('publish guarda precio propio por variante y no copia el principal', async () => {
  const preview = buildImportPreview({
    product, sourceUrl: 'https://es.aliexpress.com/item/1005008538858120.html',
    aliexpressId: '1005008538858120', marginPercent: 100, fxValue: 950,
    freightBySkuId: freightBySku(200),
  });
  // Envio por variante: comun US$2 para las 3 (regla: usar el de la variante o el comun).
  assert.deepEqual(preview.variants.map(v => v.shippingUsdCents), [200, 200, 200]);
  let saved;
  const db = { category: { findUnique: async () => ({ id: 'category' }) },
    product: { findMany: async () => [], create: async ({ data }) => { saved = data; return { id: 'saved' }; } } };
  await publishAliExpressProduct({ categoryId: 'category', publish: true, marginPercent: 100, preview }, db);
  const created = saved.productVariants.create;
  assert.deepEqual(created.map(v => Number(v.price)), [13300, 15200, 19000]);
  assert.deepEqual(created.map(v => v.stock), [10, 20, 30]);
  assert.deepEqual(created.map(v => v.supplierCostUsd), [5, 6, 8]);
  assert.deepEqual(created.map(v => v.supplierShippingUsd), [2, 2, 2]);
  // Nivel producto = minimo de variantes (listado), sin sobrescribir variantes.
  assert.equal(saved.salePrice, 13300);
  // Variants se guarda como array plano para que el frontend cruce precios.
  assert.equal(Array.isArray(saved.variants), true);
  assert.equal(saved.variants.length, 3);
});

test('producto sin variantes (1 sku) sigue funcionando exactamente igual', async () => {
  const single = { ...product, ae_item_sku_info_dtos: [sku('ONLY', '10.00', 5)] };
  const preview = buildImportPreview({
    product: single, sourceUrl: 'https://es.aliexpress.com/item/1.html',
    aliexpressId: '1', marginPercent: 100, fxValue: 950,
    freightBySkuId: { ONLY: freight(200) },
  });
  assert.equal(preview.variants[0].salePriceClp, Math.round(((1000 + 200) / 100) * 2 * 950));
  let saved;
  const db = { category: { findUnique: async () => ({ id: 'category' }) },
    product: { findMany: async () => [], create: async ({ data }) => { saved = data; return { id: 'saved' }; } } };
  await publishAliExpressProduct({ categoryId: 'category', preview }, db);
  assert.equal(Number(saved.productVariants.create[0].price), preview.variants[0].salePriceClp);
});
