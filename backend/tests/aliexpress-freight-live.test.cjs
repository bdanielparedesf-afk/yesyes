// Explicit opt-in: real read-only freight consultation, never order creation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

 test('live ds.freight.query returns a documented USD freight option for the requested SKU', {
  skip: process.env.ALIEXPRESS_LIVE_FREIGHT_TEST !== '1',
  timeout: 45000,
}, async () => {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  require('tsx/cjs');
  const { AliExpressDropshipClient } = require('../src/lib/aliexpress/dropship-client.ts');
  const service = require('../src/services/aliexpress-dropship.service.ts');
  const { prisma } = require('../src/lib/prisma.ts');
  try {
    const client = process.env.ALIEXPRESS_ACCESS_TOKEN?.trim()
      ? new AliExpressDropshipClient({
        appKey: process.env.ALIEXPRESS_APP_KEY,
        appSecret: process.env.ALIEXPRESS_APP_SECRET,
        accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN,
      })
      : await service.default.client(process.env.ALIEXPRESS_PROBE_ACCOUNT);
    let result;
    try {
      result = await client.freightQuery({
        productId: '1005013076133876', selectedSkuId: '12000060188919386',
        quantity: 1, shipToCountry: 'CL', currency: 'USD',
        language: 'es_ES', locale: 'es_ES',
      });
    } catch (error) {
      assert.fail(`aliexpress.ds.freight.query: ${service.sanitizeImportError(error)}; no freight payload validated`);
    }
    assert.notEqual(result.success, false, 'Provider returned success=false');
    const cents = service.cheapestFreightCents(result.delivery_options);
    assert.notEqual(cents, null, 'No usable USD freight option returned; unknown is not zero');
    console.info(JSON.stringify({ method: 'aliexpress.ds.freight.query',
      productId: '1005013076133876', skuId: '12000060188919386',
      quantity: 1, countryCode: 'CL', shippingUsdCents: cents }));
  } finally {
    await prisma.$disconnect();
  }
});
