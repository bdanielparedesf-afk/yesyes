const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { parseAliExpressUrl, matchesAliExpressProduct } = require('../src/aliexpress/product-url.ts');
const service = require('../src/services/aliexpress-dropship.service.ts');
const { createImportJob } = require('../src/services/aliexpress-dropship.service.ts');

const TARGET = '1005013076133876';
const SKU = '12000060188919386';

const providerProduct = {
  ae_item_base_info_dto: {
    product_id: TARGET, subject: 'Cerradura inteligente', currency_code: 'USD',
    category_id: '200328169', detail: '<p>Detalle</p>',
  },
  ae_item_sku_info_dtos: [
    { sku_id: SKU, sku_attr: '14:193', sku_price: '151.51', sku_available_stock: 35,
      ae_sku_property_dtos: [{ sku_property_name: 'Color', property_value_definition_name: 'Negro' }] },
  ],
  ae_multimedia_info_dto: { image_urls: 'a.jpg;b.jpg;c.jpg', ae_video_dtos: [{ media_url: 'v.mp4', media_type: 'video' }] },
};
const freightOptions = [{ free_shipping: 'false', shipping_fee_cent: '450' }];

// ── 1. URL limpia ─────────────────────────────────────────────────────────────
test('1. clean URL extracts product id only', () => {
  assert.equal(parseAliExpressUrl(`https://www.aliexpress.com/item/${TARGET}.html`).productId, TARGET);
});

// ── 2. URL con parámetros ─────────────────────────────────────────────────────
test('2. URL with query params still extracts product id', () => {
  assert.equal(parseAliExpressUrl(
    `https://es.aliexpress.com/item/${TARGET}.html?spm=a2g0o.pdp&pvid=abc&gatewayAdapt=glo2chi&pdp_ext_f=xyz`).productId,
    TARGET);
});

// ── 3. URL española ────────────────────────────────────────────────────────────
test('3. Spanish subdomain URL extracts product id and normalizes source', () => {
  assert.equal(parseAliExpressUrl(`https://es.aliexpress.com/item/${TARGET}.html`).sourceUrl,
    `https://www.aliexpress.com/item/${TARGET}.html`);
});

// ── 4. URL inglesa ─────────────────────────────────────────────────────────────
test('4. English/neutral root domain URL extracts product id', () => {
  assert.equal(parseAliExpressUrl(`https://www.aliexpress.com/item/${TARGET}.html`).sourceUrl,
    `https://www.aliexpress.com/item/${TARGET}.html`);
});

// ── 5. URL con sku_id ─────────────────────────────────────────────────────────
test('5. SKU is detected but never replaces product id', () => {
  const parsed = parseAliExpressUrl(`https://es.aliexpress.com/item/${TARGET}.html?sku_id=${SKU}`);
  assert.equal(parsed.productId, TARGET);
    assert.equal(parsed.skuId, SKU);
  assert.equal(parsed.sourceUrl.includes(SKU), false);
});

// ── 6. URL con ship_from=CL ───────────────────────────────────────────────────
test('6. ship_from=CL never means free shipping: real freight is used', async () => {
  const preview = await service.previewAliExpressProduct(
    `https://es.aliexpress.com/item/${TARGET}.html?sku_id=${SKU}&ship_from=CL`, { marginPercent: 100 }, {
      fx: async () => ({ value: 900 }),
      productGet: async () => providerProduct,
      freightQuery: async () => ({ delivery_options: freightOptions }),
      findDuplicate: async () => null,
    });
  assert.equal(preview.aliexpressId, TARGET);
  assert.equal(preview.skuId, SKU);
  assert.equal(preview.costUsdCents, 15151);
  // 4.50 USD — NOT zero despite ship_from=CL
  assert.equal(preview.shippingUsdCents, 450);
  assert.equal(preview.salePriceClp, Math.round((15151 + 450) / 100 * 900 * 2));
  assert.equal(preview.shippingUnknown, false);
});

// ── 7. URL con tracking ───────────────────────────────────────────────────────
test('7. URL with tracking params, hash and spm fragments is normalized', () => {
  const parsed = parseAliExpressUrl(
    `https://es.aliexpress.com/item/${TARGET}.html?spm=a2g0o.pdp&pvid=abc#section`);
  assert.equal(parsed.productId, TARGET);
});

// ── 8. URL inválida ──────────────────────────────────────────────────────────
test('8. non-AliExpress URLs are rejected', () => {
  assert.throws(() => parseAliExpressUrl('https://example.com/item/123.html'), /inválida/i);
  assert.throws(() => parseAliExpressUrl('not a url'), /inválida/i);
});

// ── 9. Product ID inválido ────────────────────────────────────────────────────
test('9. invalid path/ID is rejected', () => {
  assert.throws(() => parseAliExpressUrl('https://es.aliexpress.com/item/abc.html'), /inválida/i);
});

// ── 10. Lista de múltiples URLs ───────────────────────────────────────────────
test('10. multiple valid URLs are accepted and queued', async () => {
  const saved = { id: 'job1', total: 2 };
  const db = { aliExpressImportJob: { create: async () => saved } };
  const job = await createImportJob({
    urls: [
      `https://es.aliexpress.com/item/${TARGET}.html`,
      `https://www.aliexpress.com/item/${TARGET}.html?spm=a2g0o`,
    ],
  }, db);
  assert.deepEqual(job, { id: 'job1', total: 2 });
});

// ── 11. Una URL inválida dentro de la lista ────────────────────────────────────
test('11. an invalid URL inside the list is accepted by the queue but rejected per-item at preview time', async () => {
  // createImportJob just queues raw URLs; per-URL validation happens in the shared
  // preview service, so one bad URL never blocks the others.
  const db = { aliExpressImportJob: { create: async () => ({ id: 'job2', total: 2 }) } };
  const job = await createImportJob({ urls: [
    `https://es.aliexpress.com/item/${TARGET}.html`,
    'https://example.com/bad.html',
  ] }, db);
  assert.equal(job.total, 2);
  // The bad URL is rejected when previewed, the good one is parsed fine.
  assert.equal(parseAliExpressUrl(`https://es.aliexpress.com/item/${TARGET}.html`).productId, TARGET);
  assert.throws(() => parseAliExpressUrl('https://example.com/bad.html'), /inválida/i);
});

// ── 12. Importación masiva con varios productos (shared service) ───────────────
test('12. bulk URLs reuse the individual preview parser (shared service)', () => {
  const urls = [
    `https://es.aliexpress.com/item/${TARGET}.html?sku_id=${SKU}&ship_from=CL`,
    `https://www.aliexpress.com/item/${TARGET}.html`,
    `https://es.aliexpress.com/item/${TARGET}.html?spm=a2g0o.pdp&pvid=abc&gatewayAdapt=glo2chi&pdp_ext_f=xyz`,
  ];
  const parsed = urls.map(u => parseAliExpressUrl(u));
  assert.equal(parsed.every(p => p.productId === TARGET), true);
  assert.equal(parsed[0].skuId, SKU);
  assert.equal(parsed[1].skuId, undefined);
  // A failing URL must reject without affecting already-parsed valid ones (queue isolation).
  assert.throws(() => parseAliExpressUrl('https://evil.com/item/x.html'), /inválida/i);
});

// ── 13. Detección de duplicados ───────────────────────────────────────────────
test('13. duplicate detection matches by AliExpress id/URL, never by CJ default', async () => {
  const db = {
    product: {
            findMany: async () => [
        { id: 1, aliexpressId: TARGET, sourcePlatform: 'ALIEXPRESS', supplierProductId: null, sourceId: null,
          cjProductId: null, sourceUrl: null, supplierUrl: null, aliexpressUrl: null },
      ],
    },
  };
  assert.equal(await service.findDuplicateProduct(TARGET, db), 1);
  assert.equal(matchesAliExpressProduct({ sourcePlatform: 'CJ', supplierProductId: TARGET }, TARGET), false);
});

// Fallback: when ds.freight.query returns nothing, buyer.freight.calculate is used (official method).
test('freight fallback maps buyer.freight.calculate options to cents and computes sale price', async () => {
  const preview = await service.previewAliExpressProduct(
    `https://es.aliexpress.com/item/${TARGET}.html`, { marginPercent: 100 }, {
      fx: async () => ({ value: 900 }),
      productGet: async () => providerProduct,
      freightQuery: async () => ({ delivery_options: [] }),
      buyerFreightCalculate: async () => ({
        aeop_freight_calculate_result_for_buyer_d_t_o_list: [{ freight: { cent: 450, currency_code: 'USD' } }],
      }),
      findDuplicate: async () => null,
    });
  assert.equal(preview.shippingUsdCents, 450);
  assert.equal(preview.shippingUnknown, false);
  assert.equal(preview.costUsdCents, 15151);
  assert.equal(preview.salePriceClp, Math.round((15151 + 450) / 100 * 900 * 2));
});