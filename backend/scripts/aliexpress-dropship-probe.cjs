// Read-only live probe. No orders, imports, token refreshes or database writes.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
require('tsx/cjs');
const axios = require('axios');
const { AliExpressDropshipClient, AliExpressDropshipError } = require('../src/aliexpress/dropship-client.ts');

async function runProbe(client, report = value => console.log(JSON.stringify(value))) {
  const searchMethod = 'aliexpress.ds.text.search';
  const productMethod = 'aliexpress.ds.product.get';
  let search;
  try {
    search = await client.textSearch({ keyWord: process.env.ALIEXPRESS_PROBE_KEYWORD || 'mochila' });
    report({ method: searchMethod, status: 'LIVE_RESPONSE_VALIDATED', products: search.products.length });
  } catch (error) {
    report({ method: searchMethod, status: 'FAILED', reason: error instanceof AliExpressDropshipError ? error.reason : 'UNAVAILABLE',
      providerCode: error instanceof AliExpressDropshipError ? error.providerCode : undefined });
    report({ method: productMethod, status: 'BLOCKED', reason: 'SEARCH_FAILED' });
    return false;
  }
  const productId = search.products[0]?.itemId;
  if (!productId) {
    report({ method: productMethod, status: 'BLOCKED', reason: 'SEARCH_RETURNED_NO_PRODUCTS' });
    return false;
  }
  try {
    const product = await client.productGet({ product_id: productId });
    report({ method: productMethod, status: 'LIVE_RESPONSE_VALIDATED',
      variants: product.ae_item_sku_info_dtos.length });
    return true;
  } catch (error) {
    report({ method: productMethod, status: 'FAILED', reason: error instanceof AliExpressDropshipError ? error.reason : 'UNAVAILABLE',
      providerCode: error instanceof AliExpressDropshipError ? error.providerCode : undefined });
    return false;
  }
}

/**
 * Extended read-only probe: catalogue, freight, image search, taxonomy and feed.
 * Never calls the mutating order methods. Every report is a status DTO; no
 * provider payload, identifier or credential is printed.
 */
async function runReadOnlyProbe(client, report = value => console.log(JSON.stringify(value))) {
  const results = {};
  const attempt = async (method, run, summarize) => {
    try {
      results[method] = await run();
      report({ method, status: 'LIVE_RESPONSE_VALIDATED', ...(summarize ? summarize(results[method]) : {}) });
      return results[method];
    } catch (error) {
      results[method] = undefined;
      report({ method, status: 'FAILED',
        reason: error instanceof AliExpressDropshipError ? error.reason : 'UNAVAILABLE',
        providerCode: error instanceof AliExpressDropshipError ? error.providerCode : undefined });
      return undefined;
    }
  };

  const search = await attempt('aliexpress.ds.text.search',
    () => client.textSearch({ keyWord: process.env.ALIEXPRESS_PROBE_KEYWORD || 'mochila' }),
    value => ({ products: value.products.length }));
  const productId = search?.products?.[0]?.itemId || process.env.ALIEXPRESS_PROBE_PRODUCT_ID;
  if (!productId) {
    for (const method of ['aliexpress.ds.product.get', 'aliexpress.ds.product.wholesale.get',
      'aliexpress.ds.freight.query', 'aliexpress.logistics.buyer.freight.calculate']) {
      report({ method, status: 'BLOCKED', reason: 'SEARCH_RETURNED_NO_PRODUCTS' });
    }
    return results;
  }

  const product = await attempt('aliexpress.ds.product.get',
    () => client.productGet({ product_id: productId }),
    value => ({ variants: value.ae_item_sku_info_dtos.length }));
  // The provider rejects wholesale queries for non-wholesale items (code 15).
  // Walk a few search candidates until one supports the wholesale model.
  const wholesaleCandidates = [productId,
    ...search.products.map(item => item.itemId).filter(id => id && id !== productId)].slice(0, 10);
  let wholesaleReported = false;
  for (const candidate of wholesaleCandidates) {
    try {
      const wholesale = await client.productWholesaleGet({ product_id: candidate });
      report({ method: 'aliexpress.ds.product.wholesale.get', status: 'LIVE_RESPONSE_VALIDATED',
        variants: wholesale.ae_item_sku_info_dtos.length, wholeSale: wholesale.has_whole_sale === true });
      wholesaleReported = true;
      break;
    } catch (error) {
      results['aliexpress.ds.product.wholesale.get'] = undefined;
      if (error instanceof AliExpressDropshipError && error.reason !== 'REJECTED') {
        report({ method: 'aliexpress.ds.product.wholesale.get', status: 'FAILED',
          reason: error.reason, providerCode: error.providerCode });
        wholesaleReported = true;
        break;
      }
    }
  }
  if (!wholesaleReported) {
    report({ method: 'aliexpress.ds.product.wholesale.get', status: 'BLOCKED', reason: 'NO_WHOLESALE_PRODUCT_FOUND' });
  }
  const skuId = product?.ae_item_sku_info_dtos?.[0]?.sku_id;
  await attempt('aliexpress.ds.freight.query',
    () => client.freightQuery({ productId, quantity: 1, ...(skuId ? { selectedSkuId: skuId } : {}) }),
    value => ({ options: value.delivery_options?.length ?? 0, success: value.success !== false }));
  await attempt('aliexpress.logistics.buyer.freight.calculate',
    () => client.buyerFreightCalculate({ product_id: productId, product_num: 1, ...(skuId ? { sku_id: skuId } : {}) }),
    value => ({ options: value.aeop_freight_calculate_result_for_buyer_d_t_o_list?.length ?? 0 }));

  await attempt('aliexpress.ds.category.tree.get', () => client.categoryTreeGet(),
    value => ({ roots: value.length }));
  await attempt('aliexpress.ds.category.get', () => client.categoryGet(),
    value => ({ categories: value.result?.categories?.length ?? 0 }));
  await attempt('aliexpress.ds.feed.itemids.get',
    () => client.feedItemIdsGet({ feed_name: process.env.ALIEXPRESS_PROBE_FEED || 'DS bestseller' }),
    value => ({ products: value.result?.products?.length ?? 0 }));
  if (process.env.ALIEXPRESS_PROBE_IMAGE_BASE64?.trim()) {
    await attempt('aliexpress.ds.image.searchV2',
      () => client.imageSearchV2({ image_base64: process.env.ALIEXPRESS_PROBE_IMAGE_BASE64.trim() }),
      value => ({ matches: value.data?.length ?? 0 }));
  } else if (search.products[0]?.itemMainPic?.startsWith('http')) {
    // Live read-only fallback: use the top search hit's main image to validate image search.
    try {
      const imageResponse = await axios.get(search.products[0].itemMainPic, {
        timeout: 15000, maxContentLength: 2097152, responseType: 'arraybuffer' });
      await attempt('aliexpress.ds.image.searchV2',
        () => client.imageSearchV2({ image_base64: Buffer.from(imageResponse.data).toString('base64') }),
        value => ({ matches: value.data?.length ?? 0 }));
    } catch {
      report({ method: 'aliexpress.ds.image.searchV2', status: 'BLOCKED', reason: 'IMAGE_DOWNLOAD_FAILED' });
    }
  } else {
    report({ method: 'aliexpress.ds.image.searchV2', status: 'BLOCKED', reason: 'NO_IMAGE_PROVIDED' });
  }
  return results;
}

async function main() {
  if (process.argv.length > 2) throw new Error('ARGUMENTS_NOT_ALLOWED');
  const required = ['ALIEXPRESS_APP_KEY', 'ALIEXPRESS_APP_SECRET'];
  if (!process.env.ALIEXPRESS_ACCESS_TOKEN?.trim()) {
    required.push('ALIEXPRESS_TOKEN_ENCRYPTION_KEY', 'ALIEXPRESS_PROBE_ACCOUNT', 'DATABASE_URL');
  }
  const missing = required.filter(key => !process.env[key]?.trim());
  if (missing.length) {
    console.log(JSON.stringify({ status: 'BLOCKED', requestAttempted: false, reason: 'MISSING_PRIVATE_CONFIGURATION', missing }));
    process.exitCode = 2; return;
  }
  let prisma;
  try {
    let accessToken = process.env.ALIEXPRESS_ACCESS_TOKEN;
    if (!accessToken?.trim()) {
      ({ prisma } = require('../src/lib/prisma.ts'));
      const { getAliExpressAccessToken } = require('../src/services/aliexpress-token.service.ts');
      accessToken = await getAliExpressAccessToken(process.env.ALIEXPRESS_PROBE_ACCOUNT);
    }
    const client = new AliExpressDropshipClient({ appKey: process.env.ALIEXPRESS_APP_KEY,
      appSecret: process.env.ALIEXPRESS_APP_SECRET, accessToken });
    const ok = process.env.ALIEXPRESS_PROBE_FULL === '1'
      ? Boolean(await runReadOnlyProbe(client))
      : await runProbe(client);
    if (!ok) process.exitCode = 1;
  } finally { if (prisma) await prisma.$disconnect(); }
}
module.exports = { runProbe, runReadOnlyProbe, main };
if (require.main === module) main().catch(() => {
  console.log(JSON.stringify({ status: 'BLOCKED', reason: 'PRIVATE_CONFIGURATION_OR_TOKEN_UNAVAILABLE' }));
  process.exitCode = 1;
});

