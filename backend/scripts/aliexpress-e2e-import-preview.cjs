// E2E read-only import preview: search/detail → variants → images → stock/price
// → freight Chile → total cost → margin → preview. NO publish, NO db writes.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
require('tsx/cjs');
const { AliExpressDropshipClient } = require('../src/lib/aliexpress/dropship-client.ts');
const { createDropshipService, buildImportPreview, findDuplicateProduct } = require('../src/services/aliexpress-dropship.service.ts');
const { getUsdClpRate } = require('../src/services/fx.service.ts');
const { prisma } = require('../src/lib/prisma.ts');

async function main() {
  const productId = process.env.ALIEXPRESS_PROBE_PRODUCT_ID || '1005007055568296';
  const sourceUrl = `https://es.aliexpress.com/item/${productId}.html`;
  const service = createDropshipService({
    clientFactory: async () => new AliExpressDropshipClient({
      appKey: process.env.ALIEXPRESS_APP_KEY, appSecret: process.env.ALIEXPRESS_APP_SECRET,
      accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN }),
    db: prisma, fx: getUsdClpRate,
  });
  const [product, fx] = await Promise.all([
    service.productGet(productId), getUsdClpRate().then(r => r.value),
  ]);
  const skuId = String(product.ae_item_sku_info_dtos[0]?.sku_id ?? '');
  const [freight, buyerFreight, duplicateOfProductId] = await Promise.all([
    service.freightQuery({ productId, quantity: 1, ...(skuId ? { selectedSkuId: skuId } : {}) })
      .catch(error => ({ freightError: error instanceof Error ? error.name : 'UNAVAILABLE' })),
    service.buyerFreightCalculate({ product_id: productId, product_num: 1, ...(skuId ? { sku_id: skuId } : {}) })
      .catch(error => ({ buyerFreightError: error instanceof Error ? error.name : 'UNAVAILABLE' })),
    findDuplicateProduct(productId),
  ]);
  const marginPercent = Number(process.env.ALIEXPRESS_E2E_MARGIN || 100);
  const preview = buildImportPreview({ product, freight, sourceUrl, aliexpressId: productId, marginPercent, fxValue: fx, duplicateOfProductId });

  const totalCostUsdCents = (preview.costUsdCents ?? 0) + (preview.shippingUsdCents ?? 0);
  const expectedSale = totalCostUsdCents && preview.salePriceClp ? Math.round((totalCostUsdCents / 100) * fx * (1 + marginPercent / 100)) : null;

  console.log(JSON.stringify({
    stage: 'E2E_IMPORT_PREVIEW',
    searchDetail: 'PASS', variants: preview.variants.length,
    images: preview.images.length, video: Boolean(preview.video),
    stockKnown: preview.stockKnown, totalStock: preview.totalStock,
    freightChile: freight.delivery_options ? (preview.shippingUnknown ? 'UNKNOWN' : 'PASS') : 'FAIL',
    freightError: freight.freightError,
    buyerFreightOptions: buyerFreight.aeop_freight_calculate_result_for_buyer_d_t_o_list?.length ?? 0,
    buyerFreightError: buyerFreight.buyerFreightError,
    costUsd: preview.costUsdCents === null ? null : preview.costUsdCents / 100,
    shippingUsd: preview.shippingUsdCents === null ? null : preview.shippingUsdCents / 100,
    totalCostUsdCents, fxValue: fx,
    marginPercent, salePriceClp: preview.salePriceClp,
    priceCalculation: preview.salePriceClp !== null && expectedSale !== null
      ? Math.abs(expectedSale - preview.salePriceClp) <= 2 ? 'PASS' : 'MISMATCH' : 'NOT_COMPUTABLE',
    duplicateOfProductId, wholesaleTiers: preview.wholesaleTiers.length,
    published: false,
  }));
  await prisma.$disconnect();
}
main().catch(error => {
  console.log(JSON.stringify({ stage: 'E2E_IMPORT_PREVIEW', status: 'FAILED',
    reason: error instanceof Error ? error.name : 'UNAVAILABLE',
    detail: error instanceof Error ? error.message.slice(0, 300) : undefined }));
  process.exitCode = 1;
});
