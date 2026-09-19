const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { publishAliExpressProduct } = require('../src/services/aliexpress-dropship.service.ts');

test('publishAliExpressProduct creates productImages records from preview images', async () => {
  let saved;
  const preview = {
    aliexpressId: '1005013076133876', sourceUrl: 'https://es.aliexpress.com/item/1005013076133876.html',
    name: 'Fixture Product', images: ['img1.jpg', 'img2.jpg', 'img3.jpg'], variants: [],
    costUsdCents: 2000, shippingUsdCents: 400, shippingUnknown: false, shippingSource: 'ALIEXPRESS',
    shippingStatus: 'AVAILABLE', quantity: 1, destination: { countryCode: 'CL' },
    acquisition: { quantity: 1, selectedSkuId: '12000060188919386', productCostUsdCents: 2000,
      shippingCostUsdCents: 400, taxCostUsdCents: null, otherCostUsdCents: null, totalCostUsdCents: 2400 },
    fxRate: 900, fxSource: 'test', salePriceClp: 79200,
    raw: { base: { product_id: '1005013076133876' } },
  };
  const db = {
    category: { findUnique: async () => ({ id: 'cat-1' }) },
    product: { findMany: async () => [], create: async ({ data }) => { saved = data; return { id: 'saved' }; } },
  };
  await publishAliExpressProduct({ categoryId: 'cat-1', publish: true, preview }, db);

  assert.ok(saved.productImages, 'productImages should be created');
  assert.equal(Array.isArray(saved.productImages.create), true);
  assert.equal(saved.productImages.create.length, 3);
  assert.equal(saved.productImages.create[0].url, 'img1.jpg');
  assert.equal(saved.productImages.create[0].position, 0);
  assert.equal(saved.productImages.create[0].alt, 'Fixture Product');
  assert.equal(saved.productImages.create[2].url, 'img3.jpg');
});

test('publishAliExpressProduct with publish:true sets status PUBLISHED', async () => {
  let saved;
  const preview = {
    aliexpressId: '1005011234567890', sourceUrl: 'https://es.aliexpress.com/item/1005011234567890.html',
    name: 'Published Product', images: ['img.jpg'], variants: [],
    costUsdCents: 1500, shippingUsdCents: 200, shippingUnknown: false, shippingSource: 'ALIEXPRESS',
    shippingStatus: 'AVAILABLE', quantity: 1, destination: { countryCode: 'CL' },
    acquisition: { quantity: 1, selectedSkuId: '120000000000000001', productCostUsdCents: 1500,
      shippingCostUsdCents: 200, taxCostUsdCents: null, otherCostUsdCents: null, totalCostUsdCents: 1700 },
    fxRate: 900, fxSource: 'test', salePriceClp: 51000,
    raw: { base: { product_id: '1005011234567890' } },
  };
  const db = {
    category: { findUnique: async () => ({ id: 'cat-2' }) },
    product: { findMany: async () => [], create: async ({ data }) => { saved = data; return { id: 'saved' }; } },
  };
  await publishAliExpressProduct({ categoryId: 'cat-2', publish: true, preview }, db);

  assert.equal(saved.status, 'PUBLISHED');
  assert.equal(saved.collectionId, undefined);
});

test('publishAliExpressProduct with publish:false sets status DRAFT', async () => {
  let saved;
  const preview = {
    aliexpressId: '1005019876543210', sourceUrl: 'https://es.aliexpress.com/item/1005019876543210.html',
    name: 'Draft Product', images: [], variants: [],
    costUsdCents: 1000, shippingUsdCents: 100, shippingUnknown: false, shippingSource: 'ALIEXPRESS',
    shippingStatus: 'AVAILABLE', quantity: 1, destination: { countryCode: 'CL' },
    acquisition: { quantity: 1, selectedSkuId: '120000000000000002', productCostUsdCents: 1000,
      shippingCostUsdCents: 100, taxCostUsdCents: null, otherCostUsdCents: null, totalCostUsdCents: 1100 },
    fxRate: 900, fxSource: 'test', salePriceClp: 33000,
    raw: { base: { product_id: '1005019876543210' } },
  };
  const db = {
    category: { findUnique: async () => ({ id: 'cat-3' }) },
    product: { findMany: async () => [], create: async ({ data }) => { saved = data; return { id: 'saved' }; } },
  };
  await publishAliExpressProduct({ categoryId: 'cat-3', publish: false, preview }, db);

  assert.equal(saved.status, 'DRAFT');
});
