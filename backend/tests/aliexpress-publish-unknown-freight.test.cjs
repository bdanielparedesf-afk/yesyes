const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { publishAliExpressProduct } = require('../src/services/aliexpress-dropship.service.ts');

for (const publish of [false, true]) {
  test(`unknown freight cannot become zero when saving ${publish ? 'published product' : 'draft'}`, async () => {
    let databaseTouched = false;
    const db = {
      category: { findUnique: async () => { databaseTouched = true; return null; } },
      product: { create: async () => { databaseTouched = true; throw new Error('Unexpected write'); } },
    };
    await assert.rejects(() => publishAliExpressProduct({
      categoryId: 'category', publish,
      preview: { costUsdCents: 2000, shippingUsdCents: null, shippingUnknown: true, salePriceClp: null },
    }, db), { reason: 'SHIPPING_UNKNOWN' });
    assert.equal(databaseTouched, false);
  });
}

for (const shippingSource of ['ALIEXPRESS', 'MANUAL']) {
  test(`persists acquisition and FX provenance for ${shippingSource}`, async () => {
    let saved;
    const acquisition = { quantity: 2, selectedSkuId: '12000060188919386',
      productCostUsdCents: 4000, shippingCostUsdCents: 400,
      taxCostUsdCents: null, otherCostUsdCents: null, totalCostUsdCents: 4400 };
    const preview = {
      aliexpressId: '1005013076133876', sourceUrl: 'https://es.aliexpress.com/item/1005013076133876.html',
      name: 'Fixture', images: [], variants: [], costUsdCents: 2000,
      shippingUsdCents: 400, shippingUnknown: false, shippingSource,
      shippingStatus: 'AVAILABLE', quantity: 2, selectedSkuId: acquisition.selectedSkuId,
      destination: { countryCode: 'CL' }, acquisition,
      fxRate: 900, fxSource: 'test-rate', salePriceClp: 79200,
      raw: { base: { product_id: '1005013076133876' } },
    };
    const db = { category: { findUnique: async () => ({ id: 'category' }) },
      product: { findMany: async () => [], create: async ({ data }) => { saved = data; return { id: 'saved' }; } } };
    await publishAliExpressProduct({ categoryId: 'category', preview }, db);
    assert.deepEqual(saved.aliexpressSnapshot.acquisition, acquisition);
    assert.equal(saved.aliexpressSnapshot.shippingSource, shippingSource);
    assert.equal(saved.aliexpressSnapshot.fxRate, 900);
    assert.equal(saved.aliexpressSnapshot.fxSource, 'test-rate');
    assert.deepEqual(saved.aliexpressSnapshot.destination, { countryCode: 'CL' });
    assert.deepEqual(saved.aliexpressSnapshot.base, preview.raw.base);
  });
}

