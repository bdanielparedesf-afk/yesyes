const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const express = require('express');
const request = require('supertest');
const { createAliExpressRouter } = require('../src/routes/aliexpress.routes.ts');
const { previewAliExpressProduct } = require('../src/services/aliexpress-dropship.service.ts');

test('HTTP preview accepts SKU, quantity, destination and manual fallback', async () => {
  const app = express();
  app.use(express.json());
  app.use(createAliExpressRouter({
    authenticate: (_req, _res, next) => next(), requireAdmin: (_req, _res, next) => next(),
    accounts: async () => [], disconnect: async () => {},
    preview: (url, options) => previewAliExpressProduct(url, options, {
      productGet: async () => ({
        ae_item_base_info_dto: { product_id: '1005013076133876', subject: 'Fixture', currency_code: 'USD' },
        ae_item_sku_info_dtos: [{ sku_id: '12000060188919386', sku_price: '20.00' }],
      }),
      fx: async () => ({ value: 900, source: 'fixture' }), findDuplicate: async () => null,
      freightQuery: async () => ({ delivery_options: [] }),
      buyerFreightCalculate: async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [] }),
    }),
  }));
  const response = await request(app).post('/dropship/import/preview').send({
    url: 'https://es.aliexpress.com/item/1005013076133876.html',
    selectedSkuId: '12000060188919386', quantity: 2, countryCode: 'CL',
    provinceCode: 'fixture', manualShippingUsd: 4, marginPercent: 100,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.totalUsdCents, 4400);
  assert.equal(response.body.shippingSource, 'MANUAL');
  assert.equal(response.body.salePriceClp, 79200);
});
