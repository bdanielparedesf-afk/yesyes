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
    // El envío real forma parte del costo proveedor (base del margen) y además
    // se cobra como cargo separado al cliente.
    assert.equal(preview.supplierAcquisitionCostUsdCents, 2000 * quantity + 600);
    assert.equal(preview.productSalePriceUsd, (2000 * quantity + 600) / 100 * 2);
    assert.equal(preview.customerShippingUsdCents, 600);
    assert.equal(preview.customerTotalUsd, preview.productSalePriceUsd + 6);
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

test('sin freight del proveedor se usa caché reciente y luego fallback comercial US$10', async () => {
  const { clearFreightCache, rememberFreightQuote } = require('../src/services/aliexpress-dropship.service.ts');
  clearFreightCache();
  const productGet = async () => ({
    ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
    ae_item_sku_info_dtos: [{ sku_id: '12000060188919386', sku_price: '20.00' }],
  });
  const noFreight = {
    productGet,
    fx: async () => ({ value: 900, source: 'fixture' }),
    findDuplicate: async () => null,
    freightQuery: async () => ({ delivery_options: [] }),
    buyerFreightCalculate: async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [] }),
  };
  // 1) Sin caché: fallback comercial US$10 automático (no MANUAL, no campo UI).
  const commercial = await previewAliExpressProduct(
    'https://es.aliexpress.com/item/1005013076133876.html', { marginPercent: 100 }, noFreight);
  assert.equal(commercial.shippingSource, 'COMMERCIAL');
  assert.equal(commercial.shippingStatus, 'SHIPPING_COMMERCIAL_FALLBACK');
  assert.equal(commercial.yesYesShippingState, 'SHIPPING_COMMERCIAL_FALLBACK');
  assert.equal(commercial.shippingUnknown, false);
  // El US$10 NO es cotización de AliExpress ni costo proveedor.
  assert.equal(commercial.shippingUsdCents, null);
  assert.equal(commercial.supplierShippingCostUsdCents, null);
  assert.equal(commercial.supplierAcquisitionCostUsdCents, null);
  assert.equal(commercial.totalUsdCents, null);
  // Margen solo sobre el producto: 20.00 × 2 = 40.00; envío al cliente US$10.
  assert.equal(commercial.productSalePriceUsd, 40);
  assert.equal(commercial.customerShippingUsdCents, 1000);
  assert.equal(commercial.customerTotalUsd, 50);
  assert.equal(commercial.salePriceClp, 36000);
  // 2) Con cotización válida reciente en caché: se reutiliza antes del US$10.
  clearFreightCache();
  rememberFreightQuote('1005013076133876', '12000060188919386', 299);
  const cached = await previewAliExpressProduct(
    'https://es.aliexpress.com/item/1005013076133876.html', { marginPercent: 100 }, noFreight);
  // La caché es una cotización REAL de AliExpress: entra al costo proveedor con
  // margen (20.00 + 2.99) × 2 = 45.98 y se cobra aparte al cliente (2.99).
  assert.equal(cached.shippingStatus, 'SHIPPING_CACHED');
  assert.equal(cached.shippingSource, 'ALIEXPRESS');
  assert.equal(cached.shippingUsdCents, 299);
  assert.equal(cached.supplierAcquisitionCostUsdCents, 2299);
  assert.equal(cached.productSalePriceUsd, 45.98);
  assert.equal(cached.customerShippingUsdCents, 299);
  assert.equal(cached.customerTotalUsd, 48.97);
  clearFreightCache();
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
  assert.equal(preview.shippingSource, 'MANUAL');
  assert.equal(preview.shippingUnknown, false);
  // MANUAL es un override legacy: tampoco es cotización ni costo proveedor.
  assert.equal(preview.shippingUsdCents, null);
  assert.equal(preview.supplierShippingCostUsdCents, null);
  assert.equal(preview.supplierAcquisitionCostUsdCents, null);
  assert.equal(preview.totalUsdCents, null);
  assert.equal(preview.productSalePriceUsd, 40);
  assert.equal(preview.customerShippingUsdCents, 400);
  assert.equal(preview.customerTotalUsd, 44);
  assert.equal(preview.salePriceClp, 36000);
});




