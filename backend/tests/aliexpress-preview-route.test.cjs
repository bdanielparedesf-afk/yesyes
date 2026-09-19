const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const express = require('express');
const request = require('supertest');
const { createAliExpressRouter } = require('../src/routes/aliexpress.routes.ts');
const { previewAliExpressProduct } = require('../src/services/aliexpress-dropship.service.ts');

test('HTTP preview simplificado: solo URL + margen; backend fija cantidad 1 y destino CL', async () => {
  const app = express();
  app.use(express.json());
  let seenOptions;
  app.use(createAliExpressRouter({
    authenticate: (_req, _res, next) => next(), requireAdmin: (_req, _res, next) => next(),
    accounts: async () => [], disconnect: async () => {},
    preview: (url, options) => {
      seenOptions = options;
      return previewAliExpressProduct(url, options, {
        productGet: async () => ({
          ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
          ae_item_sku_info_dtos: [{ sku_id: '12000060188919386', sku_price: '20.00' }],
        }),
        fx: async () => ({ value: 900, source: 'fixture' }), findDuplicate: async () => null,
        freightQuery: async () => ({ delivery_options: [] }),
        buyerFreightCalculate: async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [] }),
      });
    },
  }));
  const response = await request(app).post('/dropship/import/preview').send({
    url: 'https://es.aliexpress.com/item/1005013076133876.html', marginPercent: 100,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(seenOptions, { marginPercent: 100, quantity: 1, countryCode: 'CL' });
  // Sin freight del proveedor: fallback comercial automático US$10 (1000 cents).
  // El US$10 NO es cotización de AliExpress: shippingUsdCents (AliExpress) queda
  // null y el US$10 vive solo como cargo al cliente.
  assert.equal(response.body.shippingSource, 'COMMERCIAL');
  assert.equal(response.body.shippingUsdCents, null);
  assert.equal(response.body.shippingStatus, 'SHIPPING_COMMERCIAL_FALLBACK');
  assert.equal(response.body.yesYesShippingState, 'SHIPPING_COMMERCIAL_FALLBACK');
  assert.equal(response.body.supplierProductCostUsdCents, 2000);
  assert.equal(response.body.supplierShippingCostUsdCents, null);
  assert.equal(response.body.supplierAcquisitionCostUsdCents, null);
  // Margen 100 solo sobre el producto: 20.00 × 2 = 40.00; +10 de envío → 50.00.
  assert.equal(response.body.productSalePriceUsd, 40);
  assert.equal(response.body.customerShippingUsdCents, 1000);
  assert.equal(response.body.customerTotalUsd, 50);
  // Legacy: el US$10 nunca entra al costo proveedor.
  assert.equal(response.body.totalUsdCents, null);
  assert.equal(response.body.salePriceClp, 36000);
});
