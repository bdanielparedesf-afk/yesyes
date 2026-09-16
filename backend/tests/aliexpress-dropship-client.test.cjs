const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
require('tsx/cjs');
const { AliExpressDropshipClient, AliExpressDropshipError } = require('../src/aliexpress/dropship-client.ts');
const config = { appKey: '547536', appSecret: 'TEST_ONLY_SECRET', accessToken: 'TEST_ONLY_TOKEN' };
const safe = reason => error => {
  assert.ok(error instanceof AliExpressDropshipError);
  assert.equal(error.reason, reason);
  assert.doesNotMatch(String(error) + JSON.stringify(error), /TEST_ONLY|PRIVATE_MARKER/);
  return true;
};
// Synthetic envelopes, not captured live responses and not proof of provider compatibility.
test('search signs form body and sends Chile/USD/Spanish defaults', async () => {
  let calls = 0;
  const client = new AliExpressDropshipClient(config, async request => {
    calls++;
    assert.equal(request.url, 'https://api-sg.aliexpress.com/sync');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const params = Object.fromEntries(new URLSearchParams(request.body));
    const { sign, ...unsigned } = params;
    assert.deepEqual(unsigned, { keyWord: 'café +&=', local: 'es_ES', countryCode: 'CL', currency: 'USD',
      pageSize: '20', pageIndex: '1', method: 'aliexpress.ds.text.search', app_key: config.appKey,
      access_token: config.accessToken, timestamp: '1789588800000', sign_method: 'sha256', v: '2.0', format: 'json' });
    const canonical = Object.keys(unsigned).sort().map(key => key + unsigned[key]).join('');
    assert.equal(sign, createHmac('sha256', config.appSecret).update(canonical).digest('hex').toUpperCase());
    assert.ok(!request.body.includes(config.appSecret));
    return { aliexpress_ds_text_search_response: { code: '200', data: { products: [] } } };
  }, () => 1789588800000);
  assert.deepEqual(await client.textSearch({ keyWord: 'café +&=' }), { products: [] });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(client).includes(config.accessToken));
});

test('product get preserves supplier SKU fields without fabricating stock', async () => {
  const supplier = {
    ae_item_base_info_dto: { product_id: '1005001234567890', subject: 'Fixture mochila', currency_code: 'USD', detail: '<p>Descripción</p>' },
    ae_multimedia_info_dto: { image_urls: 'https://example.com/product.jpg' },
    ae_store_info: { store_id: '123', store_name: 'Fixture store' },
    // Official payloads return lists as plain arrays; the legacy single-key wrapper
    // is normalized too (see the normalization test below).
    ae_item_properties: [{ attr_name: 'Material', attr_value: 'Canvas' }],
    ae_item_sku_info_dtos: [
    { sku_id: '120000000000000001', sku_price: '12.34', sku_attr: '14:200004890',
      ae_sku_property_dtos: [{ sku_image: 'https://example.com/variant.jpg' }] },
  ] };
  const client = new AliExpressDropshipClient(config, async request => {
    const params = new URLSearchParams(request.body);
    assert.equal(params.get('method'), 'aliexpress.ds.product.get');
    assert.equal(params.get('product_id'), '1005001234567890');
    assert.equal(params.get('ship_to_country'), 'CL');
    assert.equal(params.get('target_language'), 'ES');
    return { aliexpress_ds_product_get_response: { result: supplier } };
  });
  assert.deepEqual(await client.productGet({ product_id: '1005001234567890' }), supplier);
});

test('invalid and unknown inputs never reach transport', async () => {
  let calls = 0;
  const client = new AliExpressDropshipClient(config, async () => { calls++; });
  for (const input of [{ keyWord: '' }, { keyWord: 'x', pageIndex: 0 }, { keyWord: 'x', pageSize: 51 },
    { keyWord: 'x', session: 'PRIVATE_MARKER' }, { keyWord: 'x', countryCode: 'US' }]) {
    await assert.rejects(client.textSearch(input), safe('INPUT'));
  }
  for (const input of [{ product_id: 1005001234567890 }, { product_id: 'https://evil.example' },
    { product_id: '1005001234567890', target_currency: 'CLP' }]) {
    await assert.rejects(client.productGet(input), safe('INPUT'));
  }
  assert.equal(calls, 0);
});

test('supplier errors and malformed envelopes fail closed with safe errors', async () => {
  for (const [raw, reason] of [
    [{ error_response: { msg: 'PRIVATE_MARKER' } }, 'REJECTED'],
    [{ code: 'InvalidAppKey', message: 'PRIVATE_MARKER' }, 'REJECTED'],
    [{ aliexpress_ds_product_get_response: { success: false, result: {} } }, 'REJECTED'],
    [{ aliexpress_ds_product_get_response: { result: { success: false } } }, 'REJECTED'],
    [null, 'CONTRACT'], ['PRIVATE_MARKER', 'CONTRACT'], [{}, 'CONTRACT'],
    [{ aliexpress_ds_product_get_response: { result: [] } }, 'CONTRACT'],
  ]) {
    const client = new AliExpressDropshipClient(config, async () => raw);
    await assert.rejects(client.productGet({ product_id: '1005001234567890' }), safe(reason));
  }
});

test('transport exceptions are sanitized and never retried', async () => {
  for (const reason of ['TRANSPORT', 'TIMEOUT']) {
    let calls = 0;
    const client = new AliExpressDropshipClient(config, async () => {
      calls++; throw reason === 'TIMEOUT' ? new AliExpressDropshipError('TIMEOUT') : new Error('PRIVATE_MARKER');
    });
    await assert.rejects(client.textSearch({ keyWord: 'test' }), safe(reason));
    assert.equal(calls, 1);
  }
});

test('configuration and invalid clock fail without exposing credentials', async () => {
  assert.throws(() => new AliExpressDropshipClient({ ...config, accessToken: '' }), safe('CONFIGURATION'));
  const client = new AliExpressDropshipClient(config, async () => assert.fail('unexpected call'), () => NaN);
  await assert.rejects(client.textSearch({ keyWord: 'test' }), safe('CONFIGURATION'));
});
