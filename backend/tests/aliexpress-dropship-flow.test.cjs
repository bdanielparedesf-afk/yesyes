const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { AliExpressDropshipClient, AliExpressDropshipError } = require('../src/aliexpress/dropship-client.ts');
const { runProbe } = require('../scripts/aliexpress-dropship-probe.cjs');
const config = { appKey: '547536', appSecret: 'TEST_ONLY_SECRET', accessToken: 'TEST_ONLY_TOKEN' };
const productId = '1005001234567890';
const product = {
  ae_item_base_info_dto: { product_id: productId, subject: 'Fixture', currency_code: 'USD' },
  // Official payloads return lists as plain arrays (the legacy *_d_t_o wrapper is
  // accepted and normalized as well).
  ae_item_sku_info_dtos: [{ sku_id: '120000000000000001', sku_attr: '', sku_price: '1.20' }],
};
// All fixtures are synthetic. These tests do not certify the remote API contract.
test('semantic validation rejects empty products, mismatched ids and lossy SKU ids', async () => {
  for (const result of [{}, { ...product, ae_item_base_info_dto: { ...product.ae_item_base_info_dto, product_id: '1005000000000000' } },
    { ...product, ae_item_sku_info_dtos: [{ sku_id: 120000000000000001, sku_attr: '', sku_price: '1.20' }] }]) {
    const client = new AliExpressDropshipClient(config, async () => ({ aliexpress_ds_product_get_response: { result } }));
    await assert.rejects(client.productGet({ product_id: productId }), { reason: 'CONTRACT' });
  }
});
test('search normalizes wrapped products and preserves lossless identifiers', async () => {
  const client = new AliExpressDropshipClient(config, async () => ({ aliexpress_ds_text_search_response: {
    data: { products: { selection_search_product: [{ itemId: Number(productId), title: 'Fixture', salePrice: '1.20' }] } },
  } }));
  assert.deepEqual((await client.textSearch({ keyWord: 'fixture' })).products, [{ itemId: productId, title: 'Fixture', salePrice: '1.20' }]);
});
test('read-only probe gets the exact id from search and never calls other methods', async () => {
  const calls = [], reports = [];
  const client = new AliExpressDropshipClient(config, async request => {
    const params = new URLSearchParams(request.body);
    calls.push(params.get('method'));
    if (calls.length === 1) return { aliexpress_ds_text_search_response: { data: { products: [{ itemId: productId, title: 'Fixture' }] } } };
    assert.equal(params.get('product_id'), productId);
    return { aliexpress_ds_product_get_response: { result: product } };
  });
  assert.equal(await runProbe(client, report => reports.push(report)), true);
  assert.deepEqual(calls, ['aliexpress.ds.text.search', 'aliexpress.ds.product.get']);
  assert.equal(reports.length, 2);
  assert.doesNotMatch(JSON.stringify(reports), /TEST_ONLY|Fixture/);
});
test('empty or rejected search never calls product get', async () => {
  for (const fails of [false, true]) {
    const reports = [];
    const client = {
      textSearch: async () => { if (fails) throw new AliExpressDropshipError('REJECTED'); return { products: [] }; },
      productGet: async () => assert.fail('unexpected call'),
    };
    assert.equal(await runProbe(client, report => reports.push(report)), false);
    assert.equal(reports[1].status, 'BLOCKED');
  }
});
test('only safe provider codes escape; no messages or arbitrary codes', async () => {
  for (const code of ['InvalidSession', 'PRIVATE_MARKER']) {
    const client = new AliExpressDropshipClient(config, async () => ({ error_response: { code, msg: 'TEST_ONLY_TOKEN' } }));
    await assert.rejects(client.textSearch({ keyWord: 'fixture' }), error => {
      assert.equal(error.providerCode, code === 'InvalidSession' ? code : undefined);
      assert.doesNotMatch(JSON.stringify(error), /PRIVATE_MARKER|TEST_ONLY/);
      return true;
    });
  }
});
