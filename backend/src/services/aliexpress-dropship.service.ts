/**
 * YesYes ⇄ AliExpress Dropship service layer.
 *
 * Responsibilities kept out of dropship-client.ts (which stays a pure API client):
 *  - client construction from the encrypted, backend-only token store;
 *  - product preview mapping (variants, images, shipping, cost + margin);
 *  - publication into YesYes (with duplicate detection);
 *  - bulk import queue (sequential, per-item isolation, retries);
 *  - price/stock synchronisation with history (sale price only when enabled);
 *  - order prepare/execute/consult/tracking with provider snapshots.
 *
 * Rules: no invented provider data, unknown shipping/stock stay unknown,
 * order execution requires BOTH the admin confirmation flag and the
 * ALIEXEC_ORDER_EXECUTION environment kill-switch.
 */
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  AliExpressDropshipClient, AliExpressDropshipError,
  BuyerFreightCalculateInput, FreightQueryInput,
  ImageSearchV2Input, ProductGetResult, TextSearchInput,
} from '../lib/aliexpress/dropship-client';
import { getAliExpressAccessToken } from './aliexpress-token.service';
import { getUsdClpRate } from './fx.service';
import { calculateSupplierQuote, MARGIN_PRESETS } from '../aliexpress/pricing';
import { matchesAliExpressProduct, parseAliExpressUrl } from '../aliexpress/product-url';

export { AliExpressDropshipError, MARGIN_PRESETS };

/** Resolved client bound to one authorised AliExpress account. */
export interface DropshipClientFactory {
  (account?: string): Promise<AliExpressDropshipClient>;
}

const defaultClientFactory: DropshipClientFactory = async account => {
  const appKey = process.env.ALIEXPRESS_APP_KEY || '';
  const appSecret = process.env.ALIEXPRESS_APP_SECRET || '';
  if (!/^\d+$/.test(appKey) || !appSecret.trim()) throw new AliExpressDropshipError('CONFIGURATION');
  const accessToken = await getAliExpressAccessToken(account || '');
  return new AliExpressDropshipClient({ appKey, appSecret, accessToken });
};

interface ServiceDeps {
  clientFactory: DropshipClientFactory;
  db: typeof prisma;
  fx: () => Promise<{ value: number }>;
}

const defaultDeps: ServiceDeps = {
  clientFactory: defaultClientFactory,
  db: prisma,
  fx: getUsdClpRate,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure mapping helpers (exported for tests; no I/O, no invented data)
// ─────────────────────────────────────────────────────────────────────────────

/** "8.99" | 8.99 → minor-unit cents. Returns null when absent/non-numeric. */
export function parseAmountToCents(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function slugify(name: string, productId: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'producto';
  return `${base}-${productId}`;
}

/** Provider HTML detail → plain-ish text; keeps paragraphs, drops tags/scripts. */
export function detailToText(detail: string | undefined): string {
  if (!detail) return '';
  return detail
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n').slice(0, 20000);
}

/** Cheapest freight option in cents; null when the provider reported nothing. */
export function cheapestFreightCents(
  options: { free_shipping?: boolean | string; shipping_fee_cent?: string }[] | undefined,
): number | null {
  if (!options?.length) return null;
  const values = options.map(option => {
    const isFree = option.free_shipping === true || option.free_shipping === 'true';
    if (isFree) return 0;
    const cents = Number(String(option.shipping_fee_cent ?? '').trim());
    return Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : null;
  }).filter((value): value is number => value !== null);
  if (!values.length) return null;
  return Math.min(...values);
}

export interface PreviewVariant {
  supplierVariantId: string;
  skuAttr: string;
  attributes: { name: string; value: string; image?: string }[];
  image?: string;
  costUsd: number | null;
  stock: number | null;
  stockKnown: boolean;
}

export interface ImportPreview {
  sourceUrl: string;
  aliexpressId: string;
  name: string;
  description: string;
  images: string[];
  video?: string;
  categoryId?: string;
  weight?: number;
  variants: PreviewVariant[];
  stockKnown: boolean;
  totalStock: number | null;
  costUsdCents: number | null;
  shippingUsdCents: number | null;
  shippingUnknown: boolean;
  fx: number;
  salePriceClp: number | null;
  duplicateOfProductId: string | null;
  wholesaleTiers: { minQuantity: string; price: string; discount?: string }[];
  raw: unknown;
}

/** Builds a YesYes preview from official provider payloads only. */
export function buildImportPreview(payload: {
  product: ProductGetResult;
  freight?: { delivery_options?: { free_shipping?: boolean | string; shipping_fee_cent?: string }[] };
  sourceUrl: string;
  aliexpressId: string;
  marginPercent: number;
  fxValue: number;
  duplicateOfProductId?: string | null;
}): ImportPreview {
  const { product, sourceUrl, aliexpressId, marginPercent, fxValue } = payload;
  const base = product.ae_item_base_info_dto;
  const multimedia = product.ae_multimedia_info_dto;
  const images = (multimedia?.image_urls || '').split(';').map(url => url.trim()).filter(Boolean);
  const video = multimedia?.ae_video_dtos?.find(v => v.media_url && v.media_type?.toLowerCase() !== 'image')?.media_url;

  const variants: PreviewVariant[] = product.ae_item_sku_info_dtos.map(sku => {
    const props = (sku.ae_sku_property_dtos || []).map(prop => ({
      name: prop.sku_property_name || '',
      value: prop.property_value_definition_name || prop.sku_property_value || '',
      image: prop.sku_image || undefined,
    }));
    // Stock is only "known" when the provider sent a numeric count. `sku_stock`
    // is a boolean availability flag and must never become a fake number.
    const stock = typeof sku.sku_available_stock === 'number'
      ? Math.trunc(sku.sku_available_stock) : null;
    const costCents = parseAmountToCents(sku.sku_price);
    return {
      supplierVariantId: sku.sku_id,
      skuAttr: sku.sku_attr || '',
      attributes: props,
      image: props.find(p => p.image)?.image || undefined,
      costUsd: costCents === null ? null : costCents / 100,
      stock, stockKnown: stock !== null,
    };
  });

  const costCents = variants.reduce<number | null>((min, variant) => {
    const cents = variant.costUsd === null ? null : Math.round(variant.costUsd * 100);
    return cents === null ? min : min === null ? cents : Math.min(min, cents);
  }, null);
  const stocks = variants.map(v => v.stock).filter((s): s is number => s !== null);
  const shippingCents = cheapestFreightCents(payload.freight?.delivery_options);

  // PRODUCTO + SHIPPING = COSTO TOTAL → margin over total cost. No shipping
  // reported by AliExpress ⇒ no invented shipping ⇒ no computed sale price.
  let salePriceClp: number | null = null;
  if (costCents !== null && shippingCents !== null) {
    try {
      salePriceClp = calculateSupplierQuote({
        productUsdCents: costCents, shippingUsdCents: shippingCents,
        marginPercent, quantity: 1,
      }, { base: 'USD', quote: 'CLP', value: fxValue, source: 'manual', observedAt: '', fetchedAt: '' }).saleClp;
    } catch { salePriceClp = null; }
  }

  return {
    sourceUrl, aliexpressId,
    name: base.subject,
    description: detailToText(base.detail),
    images, video: video || undefined,
    categoryId: base.category_id || undefined,
    weight: product.package_info_dto?.gross_weight !== undefined
      ? Number(product.package_info_dto.gross_weight) || undefined : undefined,
    variants,
    stockKnown: variants.length === 0 || variants.some(v => v.stockKnown),
    totalStock: stocks.length ? stocks.reduce((a, b) => a + b, 0) : null,
    costUsdCents: costCents,
    shippingUsdCents: shippingCents,
    shippingUnknown: shippingCents === null,
    fx: fxValue,
    salePriceClp,
    duplicateOfProductId: payload.duplicateOfProductId ?? null,
    wholesaleTiers: (product.ae_item_sku_info_dtos[0]?.wholesale_price_tiers || []).map(t => ({
      minQuantity: t.min_quantity || '', price: t.wholesale_price || '', discount: t.discount,
    })),
    raw: { base, multimedia },
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Catalogue reads (all read-only, official contracts)
// ─────────────────────────────────────────────────────────────────────────────

export function createDropshipService(deps: ServiceDeps = defaultDeps) {
  async function client(account?: string): Promise<AliExpressDropshipClient> {
    return deps.clientFactory(account);
  }
  return {
    client,
    searchText: (input: TextSearchInput) => client().then(c => c.textSearch(input)),
    productGet: (productId: string, bizModel?: string) =>
      client().then(c => c.productGet({ product_id: productId, ...(bizModel ? { biz_model: bizModel } : {}) })),
    productWholesaleGet: (productId: string) => client().then(c => c.productWholesaleGet({ product_id: productId })),
    freightQuery: (input: FreightQueryInput) => client().then(c => c.freightQuery(input)),
    buyerFreightCalculate: (input: BuyerFreightCalculateInput) => client().then(c => c.buyerFreightCalculate(input)),
    imageSearch: (input: ImageSearchV2Input) => client().then(c => c.imageSearchV2(input)),
    categoryTree: () => client().then(c => c.categoryTreeGet()),
    categoryGet: (categoryId: string) => client().then(c => c.categoryGet({ categoryId })),
    feedItemIdsGet: (input: Parameters<AliExpressDropshipClient['feedItemIdsGet']>[0]) =>
      client().then(c => c.feedItemIdsGet(input)),
  };
}

const service = createDropshipService();
export default service;

// ─────────────────────────────────────────────────────────────────────────────
// Import: preview → publish
// ─────────────────────────────────────────────────────────────────────────────

const marginSchema = z.number().int().min(0).max(10000);

/** Finds an existing YesYes product that is already this AliExpress item. */
export async function findDuplicateProduct(aliexpressId: string, db: typeof prisma = prisma): Promise<string | null> {
  const candidates = await db.product.findMany({
    where: {
      OR: [
        { aliexpressId }, { supplierProductId: aliexpressId }, { sourceId: aliexpressId },
        { aliexpressUrl: { contains: aliexpressId } },
        { supplierUrl: { contains: aliexpressId } }, { sourceUrl: { contains: aliexpressId } },
      ],
    },
    select: { id: true, aliexpressId: true, supplierProductId: true, sourceId: true,
      sourceUrl: true, supplierUrl: true, aliexpressUrl: true, sourcePlatform: true, cjProductId: true },
    take: 20,
  });
  const hit = candidates.find(candidate => matchesAliExpressProduct(candidate, aliexpressId));
  return hit?.id ?? null;
}

export interface PreviewOptions { marginPercent?: number; quantity?: number }

export async function previewAliExpressProduct(
  rawUrl: string, options: PreviewOptions = {}, deps: Pick<ServiceDeps, 'fx'> = { fx: getUsdClpRate },
): Promise<ImportPreview> {
  const { productId, sourceUrl } = parseAliExpressUrl(rawUrl);
  const marginPercent = marginSchema.catch(100).parse(options.marginPercent ?? 100);
  const quantity = z.number().int().min(1).max(10000).catch(1).parse(options.quantity ?? 1);
  const [product, fxValue] = await Promise.all([
    service.productGet(productId).catch(error => {
      if (error instanceof AliExpressDropshipError) throw error;
      throw new AliExpressDropshipError('TRANSPORT');
    }),
    deps.fx().then(rate => rate.value),
  ]);
  const [freight, duplicateOfProductId] = await Promise.all([
    service.freightQuery({ productId, quantity }).catch(() => undefined),
    findDuplicateProduct(productId),
  ]);
  return buildImportPreview({ product, freight, sourceUrl, aliexpressId: productId, marginPercent, fxValue, duplicateOfProductId });
}


export interface PublishOptions {
  categoryId: string;
  marginPercent?: number;
  publish?: boolean;
  preview: ImportPreview;
}

/** Creates the YesYes product (as DRAFT unless publish=true) from a validated preview. */
export async function publishAliExpressProduct(options: PublishOptions, db: typeof prisma = prisma) {
  const { preview, categoryId } = options;
  const marginPercent = marginSchema.parse(options.marginPercent ?? 100);
  if (preview.costUsdCents === null) throw new AliExpressDropshipError('INPUT');
  const category = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw new AliExpressDropshipError('INPUT');
  const duplicate = preview.duplicateOfProductId ?? await findDuplicateProduct(preview.aliexpressId, db);
  if (duplicate) throw new AliExpressDropshipError('INPUT');
  const salePrice = preview.salePriceClp ?? 0;
  const costUsd = preview.costUsdCents / 100;
  const shippingUsd = (preview.shippingUsdCents ?? 0) / 100;
  return db.product.create({
    data: {
      name: preview.name, slug: slugify(preview.name, preview.aliexpressId),
      description: preview.description || preview.name,
      images: preview.images, video: preview.video ?? null, categoryId,
      tags: ['aliexpress'], supplier: 'ALIEXPRESS',
      supplierProductId: preview.aliexpressId, supplierUrl: preview.sourceUrl,
      aliexpressId: preview.aliexpressId, aliexpressUrl: preview.sourceUrl,
      importSource: 'ALIEXPRESS_DROPSHIP', sourcePlatform: 'ALIEXPRESS',
      sourceId: preview.aliexpressId, sourceUrl: preview.sourceUrl,
      stock: preview.totalStock ?? 0,
      productCost: costUsd, shippingCost: shippingUsd, totalCost: costUsd + shippingUsd,
      salePrice, margin: marginPercent,
      weight: preview.weight ?? null,
      aliexpressMarginPercent: marginPercent,
      aliexpressShippingUsdCents: preview.shippingUsdCents,
      aliexpressShippingUnknown: preview.shippingUnknown,
      aliexpressSnapshot: preview.raw as object,
      status: options.publish ? 'PUBLISHED' : 'DRAFT',
      variants: { type: preview.variants } as object,
      productVariants: {
        create: preview.variants.map(variant => ({
          sku: `${preview.aliexpressId}-${variant.supplierVariantId}`,
          size: variant.attributes.find(a => /talla|size/i.test(a.name))?.value ?? null,
          color: variant.attributes.find(a => /colou?r/i.test(a.name))?.value ?? null,
          price: salePrice, stock: variant.stock ?? 0,
          supplierVariantId: variant.supplierVariantId,
          supplierAttributes: variant.attributes as object,
          supplierImage: variant.image ?? null,
          supplierCostUsd: variant.costUsd,
          supplierShippingUsd: shippingUsd,
          supplierStock: variant.stock,
          supplierStockKnown: variant.stockKnown,
        })),
      },
    },
    select: { id: true, slug: true, status: true },
  });
}


// ── Bulk import queue ─────────────────────────────────────────────────────────

const urlsSchema = z.array(z.string().trim().min(1).max(2048)).min(1).max(50);

export async function createImportJob(input: {
  urls: string[]; marginPercent?: number; categoryId?: string | null; createdBy?: string;
}, db: typeof prisma = prisma) {
  const urls = urlsSchema.parse(input.urls);
  const marginPercent = marginSchema.catch(100).parse(input.marginPercent ?? 100);
  return db.aliExpressImportJob.create({
    data: {
      marginPercent, categoryId: input.categoryId ?? null, createdBy: input.createdBy ?? null,
      total: urls.length, items: { create: urls.map(sourceUrl => ({ sourceUrl })) },
    },
    select: { id: true, total: true },
  });
}

const RATE_LIMIT_DELAY_MS = 700;
const MAX_ATTEMPTS = 3;

/**
 * Processes queue items one by one. A failed item never stops the queue;
 * failures are retried up to MAX_ATTEMPTS via retryImportJobItem.
 */
export async function processImportJob(jobId: string, db: typeof prisma = prisma): Promise<void> {
  const job = await db.aliExpressImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AliExpressDropshipError('INPUT');
  await db.aliExpressImportJob.update({ where: { id: jobId }, data: { status: 'RUNNING' } });
  let processed = job.processed, succeeded = job.succeeded, failed = job.failed;
  for (;;) {
    const item = await db.aliExpressImportJobItem.findFirst({
      where: { jobId, status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
    });
    if (!item) break;
    try {
      const preview = await previewAliExpressProduct(item.sourceUrl, { marginPercent: job.marginPercent });
      if (preview.duplicateOfProductId || preview.shippingUnknown || !job.categoryId) {
        throw new AliExpressDropshipError('INPUT');
      }
      const product = await publishAliExpressProduct({
        preview, categoryId: job.categoryId, marginPercent: job.marginPercent, publish: false,
      }, db);
      await db.aliExpressImportJobItem.update({
        where: { id: item.id },
        data: { status: 'DONE', aliexpressId: preview.aliexpressId, createdProductId: product.id, error: null },
      });
      succeeded += 1;
    } catch {
      const attempts = item.attempts + 1;
      const done = attempts >= MAX_ATTEMPTS;
      await db.aliExpressImportJobItem.update({
        where: { id: item.id },
        data: { status: done ? 'FAILED' : 'PENDING', attempts, error: null },
      });
      if (done) failed += 1;
    }
    processed += 1;
    await db.aliExpressImportJob.update({ where: { id: jobId }, data: { processed, succeeded, failed } });
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  }
  await db.aliExpressImportJob.update({ where: { id: jobId }, data: { status: 'DONE' } });
}

export async function retryImportJobItem(itemId: string, db: typeof prisma = prisma) {
  const item = await db.aliExpressImportJobItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AliExpressDropshipError('INPUT');
  return db.aliExpressImportJobItem.update({
    where: { id: itemId }, data: { status: 'PENDING', attempts: 0, error: null },
    select: { id: true, status: true },
  });
}

/** Progress snapshot for the admin UI: job counters + per-item rows. */
export async function getImportJobStatus(jobId: string, db: typeof prisma = prisma) {
  const job = await db.aliExpressImportJob.findUnique({
    where: { id: jobId },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, sourceUrl: true, aliexpressId: true, status: true, attempts: true,
          createdProductId: true, createdAt: true },
      },
    },
  });
  if (!job) throw new AliExpressDropshipError('INPUT');
  return job;
}



// ─────────────────────────────────────────────────────────────────────────────
// Synchronisation: price/stock detection + history. The YesYes sale price is
// only rewritten when `updateSalePrice` is explicitly true.
// ─────────────────────────────────────────────────────────────────────────────

export async function findAliExpressProductForSync(productId: string, db: typeof prisma = prisma) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, aliexpressId: true, supplierProductId: true, sourceId: true, sourceUrl: true,
      supplierUrl: true, aliexpressUrl: true, sourcePlatform: true, cjProductId: true,
      productCost: true, salePrice: true, margin: true, stock: true },
  });
  if (!product) throw new AliExpressDropshipError('INPUT');
  const aeId = [product.aliexpressId, product.supplierProductId, product.sourceId]
    .find(id => id && /^\d+$/.test(id));
  if (aeId && matchesAliExpressProduct(product, aeId)) return { product, aliexpressId: aeId };
  const fromUrl = [product.sourceUrl, product.supplierUrl, product.aliexpressUrl]
    .map(url => { try { return url ? parseAliExpressUrl(url).productId : null; } catch { return null; } })
    .find(id => id);
  if (fromUrl) return { product, aliexpressId: fromUrl };
  throw new AliExpressDropshipError('INPUT');
}

export async function syncAliExpressProduct(input: {
  productId: string; updateSalePrice?: boolean;
}, db: typeof prisma = prisma) {
  const { product, aliexpressId } = await findAliExpressProductForSync(input.productId, db);
  try {
    const wholesale = await service.productWholesaleGet(aliexpressId);
    const preview = buildImportPreview({
      product: wholesale, sourceUrl: product.sourceUrl || '', aliexpressId,
      marginPercent: product.margin ?? 100, fxValue: (await getUsdClpRate()).value,
    });
    const costAfter = preview.costUsdCents === null ? null : preview.costUsdCents / 100;
    const stockAfter = preview.totalStock;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (costAfter !== null && costAfter !== product.productCost) {
      changes.cost = { before: product.productCost, after: costAfter };
    }
    if (stockAfter !== null && stockAfter !== product.stock) {
      changes.stock = { before: product.stock, after: stockAfter };
    }
    await db.product.update({
      where: { id: product.id },
      data: {
        ...(costAfter !== null ? { productCost: costAfter, totalCost: costAfter + (preview.shippingUsdCents ?? 0) / 100 } : {}),
        ...(stockAfter !== null ? { stock: stockAfter } : {}),
        aliexpressShippingUsdCents: preview.shippingUsdCents,
        aliexpressShippingUnknown: preview.shippingUnknown,
        aliexpressSyncedAt: new Date(),
        // Sale price untouched unless explicitly requested.
        ...(input.updateSalePrice === true && preview.salePriceClp ? { salePrice: preview.salePriceClp } : {}),
      },
    });
    await db.aliExpressSyncLog.create({
      data: { productId: product.id, aliexpressId, status: Object.keys(changes).length ? 'CHANGED' : 'UNCHANGED',
        costBeforeUsd: product.productCost, costAfterUsd: costAfter,
        stockBefore: product.stock, stockAfter, changes: changes as object },
    });
    return { productId: product.id, aliexpressId, changed: Object.keys(changes), shippingUnknown: preview.shippingUnknown };
  } catch (error) {
    await db.aliExpressSyncLog.create({
      data: { productId: product.id, aliexpressId, status: 'ERROR', error: null },
    });
    throw error;
  }
}

export async function syncHistory(productId: string, db: typeof prisma = prisma) {
  return db.aliExpressSyncLog.findMany({
    where: { productId }, orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, status: true, costBeforeUsd: true, costAfterUsd: true, stockBefore: true,
      stockAfter: true, changes: true, createdAt: true },
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Orders: prepare → execute (double-guarded) → consult → tracking.
// A snapshot preserves the original provider data on the YesYes order.
// ─────────────────────────────────────────────────────────────────────────────

export const prepareOrderInputSchema = z.object({
  orderId: z.string().min(1).max(64),
  aeOrderIdPrefix: z.string().trim().max(64).optional(),
  placeOrderRequest: z.object({
    out_order_id: z.string().trim().max(64).optional(),
    logistics_address: z.record(z.unknown()),
    product_items: z.array(z.record(z.unknown())).min(1).max(100),
  }).passthrough(),
});

/** PREPARATION + VALIDATION only. No provider call is made here. */
export async function prepareAliExpressOrder(rawInput: unknown, db: typeof prisma = prisma) {
  const parsed = prepareOrderInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new AliExpressDropshipError('INPUT');
  const { orderId, placeOrderRequest } = parsed.data;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new AliExpressDropshipError('INPUT');
  await db.aliExpressOrderSnapshot.upsert({
    where: { orderId },
    create: { orderId, status: 'PREPARED', request: placeOrderRequest as object },
    update: { status: 'PREPARED', request: placeOrderRequest as object },
  });
  return { orderId, status: 'PREPARED' as const };
}

/**
 * EXECUTION (real `aliexpress.ds.order.create`). Requires, at the same time:
 *  1. the explicit confirm flag (admin action), and
 *  2. ALIEXPRESS_ORDER_EXECUTION=true in the backend environment.
 * Without both, nothing reaches AliExpress.
 */
export async function executeAliExpressOrder(orderId: string, options: { confirm: boolean }, db: typeof prisma = prisma) {
  if (options.confirm !== true) throw new AliExpressDropshipError('NOT_CONFIRMED');
  if (process.env.ALIEXPRESS_ORDER_EXECUTION !== 'true') throw new AliExpressDropshipError('BLOCKED');
  const snapshot = await db.aliExpressOrderSnapshot.findUnique({ where: { orderId } });
  if (!snapshot) throw new AliExpressDropshipError('INPUT');
  const client = await service.client();
  const response = await client.orderCreate(
    snapshot.request as unknown as Parameters<AliExpressDropshipClient['orderCreate']>[0],
    { confirm: true },
  );
  await db.aliExpressOrderSnapshot.update({
    where: { orderId },
    data: { status: 'EXECUTED', response: response as object },
  });
  return response;
}

/** LOCAL SIMULATION: returns what would be sent, without touching the provider. */
export async function simulateAliExpressOrder(orderId: string, db: typeof prisma = prisma) {
  const snapshot = await db.aliExpressOrderSnapshot.findUnique({ where: { orderId } });
  if (!snapshot) throw new AliExpressDropshipError('INPUT');
  return { orderId, simulated: true, request: snapshot.request };
}

const aeOrderIdSchema = z.string().regex(/^[1-9]\d{5,24}$/);

/** Read-only consultation; keeps the response in the snapshot when it exists. */
export async function getAliExpressOrder(aeOrderId: string, db: typeof prisma = prisma) {
  const id = aeOrderIdSchema.parse(aeOrderId);
  const result = await service.client().then(c => c.orderGet({ order_id: id }));
  await db.aliExpressOrderSnapshot.updateMany({
    where: { aliexpressOrderId: id }, data: { response: result as object },
  });
  return result;
}

/** Read-only tracking; keeps the tracking in the snapshot when it exists. */
export async function getAliExpressTracking(aeOrderId: string, db: typeof prisma = prisma) {
  const id = aeOrderIdSchema.parse(aeOrderId);
  const result = await service.client().then(c => c.orderTrackingGet({ ae_order_id: id }));
  await db.aliExpressOrderSnapshot.updateMany({
    where: { aliexpressOrderId: id }, data: { tracking: result as object },
  });
  return result;
}

