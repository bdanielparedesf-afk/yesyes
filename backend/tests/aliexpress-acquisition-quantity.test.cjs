const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { previewAliExpressProduct } = require('../src/services/aliexpress-dropship.service.ts');

test('freight amounts respect explicit provider currency, including zero', () => {
  const { cheapestFreightCents } = require('../src/services/aliexpress-dropship.service.ts');
  assert.equal(cheapestFreightCents([{ shipping_fee_cent: '400', shipping_fee_currency: 'USD' }]), 400);
  assert.equal(cheapestFreightCents([{ shipping_fee_cent: '400', shipping_fee_currency: 'CLP' }]), null);
  assert.equal(cheapestFreightCents([{ shipping_fee_cent: '0', shipping_fee_currency: 'USD' }]), 0);
  assert.equal(cheapestFreightCents([{ shipping_fee_cent: '0', shipping_fee_currency: 'CLP' }]), null);
});

for (const quantity of [1, 2, 4]) {
  test(`acquisition uses quantity ${quantity} once and freight for the entire quantity`, async () => {
    const skuId = '12000060188919386';
    const preview = await previewAliExpressProduct(
      'https://es.aliexpress.com/item/1005013076133876.html',
      { selectedSkuId: skuId, quantity, marginPercent: 100 }, {
        productGet: async () => ({
          ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
          ae_item_sku_info_dtos: [{ sku_id: skuId, sku_price: '20.00' }],
        }),
        fx: async () => ({ value: 900, source: 'manual' }),
        findDuplicate: async () => null,
        freightQuery: async input => {
          assert.equal(input.quantity, quantity);
          assert.equal(input.selectedSkuId, skuId);
          return { delivery_options: [{ shipping_fee_cent: '600', shipping_fee_currency: 'USD' }] };
        },
      });
    assert.equal(preview.quantity, quantity);
    assert.equal(preview.acquisition.productCostUsdCents, 2000 * quantity);
    assert.equal(preview.shippingUsdCents, 600);
    assert.equal(preview.totalUsdCents, 2000 * quantity + 600);
    assert.equal(preview.salePriceClp, (20 * quantity + 6) * 900 * 2);
  });
}

test('preview forwards destination province and city to official freight query', async () => {
  let request;
  await previewAliExpressProduct('https://es.aliexpress.com/item/1005013076133876.html',
    { provinceCode: 'fixture-province', cityCode: 'fixture-city' }, {
      productGet: async () => ({
        ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
        ae_item_sku_info_dtos: [{ sku_id: '12000060188919386', sku_price: '20.00' }],
      }),
      fx: async () => ({ value: 900 }), findDuplicate: async () => null,
      freightQuery: async input => {
        request = input;
        return { delivery_options: [{ shipping_fee_cent: '400' }] };
      },
    });
  assert.equal(request.provinceCode, 'fixture-province');
  assert.equal(request.cityCode, 'fixture-city');
});

test('preview preserves the FX source returned by the existing FX service', async () => {
  const preview = await previewAliExpressProduct(
    'https://es.aliexpress.com/item/1005013076133876.html', {}, {
      productGet: async () => ({
        ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
        ae_item_sku_info_dtos: [{ sku_id: '12000060188919386', sku_price: '20.00' }],
      }),
      fx: async () => ({ value: 912.34, source: 'fixture-fx-provider' }),
      findDuplicate: async () => null,
      freightQuery: async () => ({ delivery_options: [{ shipping_fee_cent: '400', shipping_fee_currency: 'USD' }] }),
    });
  assert.equal(preview.fxSource, 'fixture-fx-provider');
  assert.equal(preview.fxRate, 912.34);
  assert.equal(preview.totalUsdCents, 2400);
  assert.equal(preview.salePriceClp, Math.round(24 * 912.34 * 2));
});

test('manual freight fallback survives both official method rejections', async () => {
  const preview = await previewAliExpressProduct(
    'https://es.aliexpress.com/item/1005013076133876.html', { manualShippingUsd: 4 }, {
      productGet: async () => ({
        ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
        ae_item_sku_info_dtos: [{ sku_id: '12000060188919386', sku_price: '20.00' }],
      }),
      fx: async () => ({ value: 900, source: 'fixture' }),
      findDuplicate: async () => null,
      freightQuery: async () => { throw new Error('fixture rejection'); },
      buyerFreightCalculate: async () => { throw new Error('fixture rejection'); },
    });
  assert.equal(preview.shippingUsdCents, 400);
  assert.equal(preview.shippingSource, 'MANUAL');
  assert.equal(preview.shippingUnknown, false);
  assert.equal(preview.totalUsdCents, 2400);
  assert.equal(preview.salePriceClp, 43200);
});




