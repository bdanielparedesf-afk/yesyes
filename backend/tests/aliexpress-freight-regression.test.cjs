const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const service = require('../src/services/aliexpress-dropship.service.ts');

const productId = '1005013076133876';
const cheapSku = '12000060188919385';
const selectedSku = '12000060188919386';
const product = {
  ae_item_base_info_dto: { product_id: productId, subject: 'Fixture', currency_code: 'USD' },
  ae_item_sku_info_dtos: [
    { sku_id: cheapSku, sku_price: '10.00' },
    { sku_id: selectedSku, sku_price: '20.00' },
  ],
};

test('missing or invalid amounts never become zero', () => {
  for (const value of [undefined, null, '', '  ', false, true, {}, [], 'NaN', -1]) {
    assert.equal(service.parseAmountToCents(value), null, String(value));
  }
  assert.equal(service.parseAmountToCents('0'), 0);
  assert.equal(service.parseAmountToCents(0), 0);
});

test('missing freight stays unknown; only explicit free or zero is free', () => {
  for (const value of [undefined, null, '', '  ', 'invalid']) {
    assert.equal(service.cheapestFreightCents([{ shipping_fee_cent: value }]), null);
  }
  assert.equal(service.cheapestFreightCents([{}]), null);
  assert.equal(service.cheapestFreightCents([{ shipping_fee_cent: '0' }]), 0);
  assert.equal(service.cheapestFreightCents([{ free_shipping: true }]), 0);
});

test('live decimal fee "2.99" parses as 299 cents, not PROVIDER_UNAVAILABLE', () => {
  assert.equal(service.cheapestFreightCents([{ shipping_fee_cent: '2.99', shipping_fee_currency: 'USD' }]), 299);
  assert.equal(service.cheapestFreightCents([{ shipping_fee_cent: '0.00', shipping_fee_currency: 'USD' }]), 0);
  assert.equal(service.cheapestFreightCents([{ shipping_fee_cent: 2.99, shipping_fee_currency: 'USD' }]), 299);
});

test('SKU price and freight request refer to the same selected variant', async () => {
  let requestedSku;
  const preview = await service.previewAliExpressProduct(
    `https://es.aliexpress.com/item/${productId}.html?sku_id=${cheapSku}`,
    { selectedSkuId: selectedSku }, {
      productGet: async () => product,
      fx: async () => ({ value: 900 }),
      findDuplicate: async () => null,
      freightQuery: async input => {
        requestedSku = input.selectedSkuId;
        return { delivery_options: [{ shipping_fee_cent: '400' }] };
      },
    });
  assert.equal(requestedSku, selectedSku);
  assert.equal(preview.skuId, selectedSku);
  assert.equal(preview.costUsdCents, 2000);
  assert.equal(preview.shippingUsdCents, 400);
  assert.equal(preview.salePriceClp, 43200);
});

test('unknown SKU is rejected before any freight request', async () => {
  let freightCalls = 0;
  await assert.rejects(() => service.previewAliExpressProduct(
    `https://es.aliexpress.com/item/${productId}.html`, { selectedSkuId: '999999999999' }, {
      productGet: async () => product,
      fx: async () => ({ value: 900 }),
      findDuplicate: async () => null,
      freightQuery: async () => { freightCalls++; return {}; },
    }), { reason: 'INPUT' });
  assert.equal(freightCalls, 0);
});
