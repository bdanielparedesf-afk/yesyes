const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const service = require('../src/services/aliexpress-dropship.service.ts');

const freightOptions = [
  { free_shipping: 'true', shipping_fee_cent: '999' },
  { free_shipping: 'false', shipping_fee_cent: '450' },
  { free_shipping: 'false', shipping_fee_cent: 'n/a' },
];

const product = {
  ae_item_base_info_dto: {
    product_id: '1005001234567890', subject: 'Fixture Product <b>Nice</b>', currency_code: 'USD',
    category_id: '1501', detail: '<p>Line one</p><script>evil()</script><p>Line two</p>',
  },
  ae_item_sku_info_dtos: [
    { sku_id: '120000000000000001', sku_attr: '', sku_price: '1.20', sku_available_stock: 42,
      ae_sku_property_dtos: [{ sku_property_name: 'Color', property_value_definition_name: 'Red', sku_image: 'img-red' }],
      wholesale_price_tiers: [{ min_quantity: '2', wholesale_price: '1.00' }] },
    { sku_id: '120000000000000002', sku_attr: '', sku_price: '2.00' /* stock deliberately absent */ },
  ],
  ae_multimedia_info_dto: { image_urls: 'a.jpg;b.jpg', ae_video_dtos: [{ media_url: 'v.mp4', media_type: 'video' }] },
};

const fx = { base: 'USD', quote: 'CLP', value: 900, source: 'manual', observedAt: '', fetchedAt: '' };

const quoteLike = input => ({
  productUsdCents: input.productUsdCents, shippingUsdCents: input.shippingUsdCents,
  marginPercent: input.marginPercent, quantity: input.quantity,
  saleClp: Math.round(((input.productUsdCents + input.shippingUsdCents) / 100) * (1 + input.marginPercent / 100) * 900),
});

let mockPricing;
let mockProductUrl;

test('mapping helpers', () => {
  assert.equal(service.parseAmountToCents('8.99'), 899);
  assert.equal(service.parseAmountToCents('not-a-number'), null);
  assert.equal(service.parseAmountToCents(-1), null);
  assert.equal(service.cheapestFreightCents(freightOptions), 0);
  assert.equal(service.cheapestFreightCents(undefined), null);
  assert.equal(service.cheapestFreightCents([{ free_shipping: 'true', shipping_fee_cent: '1' }]), 0);
  assert.equal(service.detailToText(product.ae_item_base_info_dto.detail), 'Line one\nLine two');
  assert.match(service.slugify('Café Especial!', '1005001'), /^cafe-especial-1005001$/);
});

test('buildImportPreview keeps unknown stock unknown and unknown shipping unknown', () => {
  const preview = service.buildImportPreview({
    product, sourceUrl: 'https://es.aliexpress.com/item/1005001234567890.html',
    aliexpressId: '1005001234567890', marginPercent: 100, fxValue: 900,
    freight: { delivery_options: freightOptions },
  });
  assert.equal(preview.name, 'Fixture Product <b>Nice</b>');
  assert.deepEqual(preview.images, ['a.jpg', 'b.jpg']);
  assert.equal(preview.video, 'v.mp4');
  assert.equal(preview.costUsdCents, 120); // cheapest variant
  assert.equal(preview.shippingUsdCents, 0);
  assert.equal(preview.shippingUnknown, false);
  assert.equal(preview.totalStock, 42); // only the variant that reported stock
  assert.equal(preview.variants[1].stockKnown, false);
  assert.equal(preview.variants[1].stock, null);
  assert.deepEqual(preview.wholesaleTiers, [{ minQuantity: '2', price: '1.00', discount: undefined }]);
});

test('buildImportPreview without freight keeps shipping unknown and no invented price', () => {
  const preview = service.buildImportPreview({
    product, sourceUrl: 'u', aliexpressId: 'x', marginPercent: 100, fxValue: 900,
  });
  assert.equal(preview.shippingUnknown, true);
  assert.equal(preview.shippingUsdCents, null);
  assert.equal(preview.salePriceClp, null);
});

test('order execution guards', async () => {
  const db = { aliExpressOrderSnapshot: { findUnique: async () => null } };
  await assert.rejects(() => service.executeAliExpressOrder('o1', { confirm: false }, db), { reason: 'NOT_CONFIRMED' });
  delete process.env.NODE_ENV; // test runtime is NOT production

  process.env.ALIEXPRESS_ORDER_EXECUTION = 'false';
  await assert.rejects(() => service.executeAliExpressOrder('o1', { confirm: true }, db), { reason: 'BLOCKED' });
  process.env.ALIEXPRESS_ORDER_EXECUTION = 'true';
  // Execution flag alone is NOT enough: outside Production it stays blocked.
  await assert.rejects(() => service.executeAliExpressOrder('o1', { confirm: true }, db), { reason: 'BLOCKED' });

  await assert.rejects(() => service.prepareAliExpressOrder({ orderId: 'nope' }, { order: { findUnique: async () => null } }), { reason: 'INPUT' });
  delete process.env.ALIEXPRESS_ORDER_EXECUTION;
});
