const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const axios = require('axios');
const { parseAliExpressUrl, matchesAliExpressProduct } = require('../src/aliexpress/product-url.ts');
const { calculateSupplierQuote, MARGIN_PRESETS } = require('../src/aliexpress/pricing.ts');
const { manualFxRate, getUsdClpRate } = require('../src/services/fx.service.ts');
const url = 'https://www.aliexpress.com/item/1005001234567890.html';
const id = '1005001234567890';
const rate = manualFxRate(1000, '2026-01-01T00:00:00Z', new Date('2026-01-02T00:00:00Z'));

test('URL normalization discards tracking and preserves string product ID', () => {
  assert.deepEqual(parseAliExpressUrl(url + '?tracking=abc#section'), { productId: id, sourceUrl: url });
  assert.equal(parseAliExpressUrl(url.replace('www.', 'es.')).sourceUrl, url);
});

test('URL parser rejects arbitrary destinations, shorteners, credentials and invalid paths', () => {
  for (const value of ['http://www.aliexpress.com/item/1005001234567890.html', 'https://127.0.0.1/item/123456.html',
    'https://www.aliexpress.com.evil.invalid/item/123456.html', 'https://evil.invalid@www.aliexpress.com/item/123456.html',
    'https://www.aliexpress.com:8080/item/123456.html', 'https://s.click.aliexpress.com/e/test',
    'https://www.aliexpress.com/item/0.html', url + '\n', url.replace('/item/', '/item\\'), '', null]) {
    assert.throws(() => parseAliExpressUrl(value));
  }
});

test('duplicates match existing ID, supplier ID, source ID and normalized URL, not CJ defaults', () => {
  for (const value of [{ aliexpressId: id }, { sourcePlatform: 'ALIEXPRESS', supplierProductId: id },
    { sourcePlatform: 'ALIEXPRESS', sourceId: id }, { sourceUrl: url + '?tracking=x' }, { aliexpressUrl: url }]) {
    assert.equal(matchesAliExpressProduct(value, id), true);
  }
  assert.equal(matchesAliExpressProduct({ sourcePlatform: 'CJ', supplierProductId: id }, id), false);
  assert.equal(matchesAliExpressProduct({ supplierProductId: id }, id), false);
  assert.equal(matchesAliExpressProduct({ cjProductId: 'cj', aliexpressId: id }, id), false);
});

for (const margin of MARGIN_PRESETS) {
  test(`margin ${margin}% uses total cost including shipping`, () => {
    const quote = calculateSupplierQuote({ productUsdCents: 800, shippingUsdCents: 200, quantity: 1, marginPercent: margin }, rate);
    assert.equal(quote.totalClp, 10000);
    assert.equal(quote.saleClp, 10000 * (1 + margin / 100));
    assert.equal(quote.fx.observedAt, rate.observedAt);
  });
}

test('custom markup and quantity preserve aggregate shipping cost', () => {
  const quote = calculateSupplierQuote({ productUsdCents: 800, shippingUsdCents: 400, quantity: 2, marginPercent: 75 }, rate);
  assert.equal(quote.totalUsdCents, 2000);
  assert.equal(quote.saleClp, 35000);
});

test('unknown shipping is not silently converted into free shipping', () => {
  for (const shippingUsdCents of [null, undefined, NaN, -1, 0.5]) {
    assert.throws(() => calculateSupplierQuote({ productUsdCents: 800, shippingUsdCents, quantity: 1, marginPercent: 100 }, rate));
  }
  assert.equal(calculateSupplierQuote({ productUsdCents: 800, shippingUsdCents: 0, quantity: 1, marginPercent: 100 }, rate).saleClp, 16000);
});

test('manual FX requires positive value and valid timestamp', () => {
  assert.throws(() => manualFxRate(0, rate.observedAt));
  assert.throws(() => manualFxRate(1000, 'invalid'));
  assert.throws(() => manualFxRate(1000, '2099-01-01T00:00:00Z'));
});

test('FX fetch uses latest observation and fails safely without fixed fallback', async t => {
  const previous = process.env.FX_SOURCE;
  delete process.env.FX_SOURCE;
  try {
    t.mock.method(axios, 'get', async (endpoint, options) => {
      assert.equal(endpoint, 'https://mindicador.cl/api/dolar');
      assert.equal(options.maxRedirects, 0);
      return { data: { serie: [{ valor: 1001, fecha: new Date(Date.now() - 86400000).toISOString() },
        { valor: 1002, fecha: new Date().toISOString() }] } };
    });
    assert.equal((await getUsdClpRate()).value, 1002);
    axios.get.mock.mockImplementation(async () => { throw new Error('PRIVATE_MARKER'); });
    await assert.rejects(getUsdClpRate(), error => !String(error).includes('PRIVATE_MARKER') && /no disponible/.test(error.message));
  } finally { if (previous === undefined) delete process.env.FX_SOURCE; else process.env.FX_SOURCE = previous; }
});
