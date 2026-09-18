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
  BuyerFreightCalculateInput, BuyerFreightResult, FreightQueryInput,
  ImageSearchV2Input, ProductGetResult, TextSearchInput,
} from '../lib/aliexpress/dropship-client';
import { AliExpressOAuthError } from '../aliexpress/oauth-client';
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
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value.trim()))) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n * 100))) return null;
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
  options: { free_shipping?: boolean | string; shipping_fee_cent?: string; shipping_fee_currency?: string }[] | undefined,
): number | null {
  if (!options?.length) return null;
  const values = options.map(option => {
    // The request targets USD. Never reinterpret an explicitly different currency as USD.
    if (option.shipping_fee_currency !== undefined && option.shipping_fee_currency !== 'USD') return null;
    const isFree = option.free_shipping === true || option.free_shipping === 'true';
    if (isFree) return 0;
    const raw = option.shipping_fee_cent;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return null;
    const cents = Number(raw);
    return Number.isSafeInteger(cents) ? cents : null;
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
  costUsdCents: number | null;
  stock: number | null;
  stockKnown: boolean;
}

/** Explicit shipping resolution — never collapse unknown into 0. */
export type ShippingStatus = 'AVAILABLE' | 'FREE' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_ERROR' | 'UNKNOWN';
export type ShippingSource = 'ALIEXPRESS' | 'MANUAL' | 'NONE';

export const SHIPPING_STATUS_MESSAGE: Record<ShippingStatus, string> = {
  FREE: 'Envío gratis confirmado por AliExpress ($0).',
  AVAILABLE: 'Costo de envío proporcionado por AliExpress.',
  PROVIDER_UNAVAILABLE: 'AliExpress no proporcionó costo de envío para esta variante/destino.',
  PROVIDER_ERROR: 'Error temporal consultando el envío en AliExpress; reintentar más tarde.',
  UNKNOWN: 'Fuente de envío desconocida.',
};

export interface AcquisitionCost {
  quantity: number;
  selectedSkuId?: string;
  productCostUsdCents: number | null;
  shippingCostUsdCents: number | null;
  taxCostUsdCents: number | null;
  otherCostUsdCents: number | null;
  totalCostUsdCents: number | null;
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
  shippingStatus: ShippingStatus;
  shippingSource: ShippingSource;
  shippingMessage: string;
  shipFrom?: string | null;
  quantity: number;
  selectedSkuId?: string;
  destination: { countryCode: 'CL'; provinceCode?: string; cityCode?: string; postalCode?: string };
  acquisition: AcquisitionCost;
  taxUsdCents: number | null;
  otherUsdCents: number | null;
  totalUsdCents: number | null;
  fx: number;
  fxRate: number;
  fxSource: string;
  salePriceClp: number | null;
  duplicateOfProductId: string | null;
  /** SKU from the source URL when present (never a replacement for the product ID). */
  skuId?: string;
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
  fxSource?: string;
  quantity?: number;
  manualShippingUsd?: number;
  shipFrom?: string | null;
  destination?: ImportPreview['destination'];
  duplicateOfProductId?: string | null;
  skuId?: string;
  /** True when the freight APIs themselves failed (transport/provider error). */
  shippingError?: boolean;
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
      costUsdCents: costCents,
      stock, stockKnown: stock !== null,
    };
  });

  const selectedVariant = payload.skuId
    ? variants.find(variant => variant.supplierVariantId === payload.skuId)
    : variants[0];
  if (payload.skuId && !selectedVariant) throw new AliExpressDropshipError('INPUT');
  const costCents = selectedVariant?.costUsd === null || !selectedVariant
    ? null : Math.round(selectedVariant.costUsd * 100);
  const stocks = variants.map(v => v.stock).filter((s): s is number => s !== null);
  const quantity = z.number().int().min(1).max(10000).parse(payload.quantity ?? 1);
  const providerShipping = cheapestFreightCents(payload.freight?.delivery_options);
  const manualShipping = payload.manualShippingUsd === undefined ? null
    : parseAmountToCents(z.number().finite().nonnegative().parse(payload.manualShippingUsd));
  const shippingCents = providerShipping ?? manualShipping;
  const shippingSource: ShippingSource = providerShipping !== null ? 'ALIEXPRESS'
    : manualShipping !== null ? 'MANUAL' : 'NONE';
  const shippingStatus: ShippingStatus = shippingCents === null
    ? (payload.shippingError === true ? 'PROVIDER_ERROR' : 'PROVIDER_UNAVAILABLE')
    : shippingCents === 0 ? 'FREE' : 'AVAILABLE';
  const shippingMessage = shippingCents === null
    ? SHIPPING_STATUS_MESSAGE[shippingStatus]
    : shippingSource === 'MANUAL' ? 'Costo de envío manual del administrador; no confirmado por AliExpress.'
      : SHIPPING_STATUS_MESSAGE[shippingStatus];
  const sku = product.ae_item_sku_info_dtos.find(s => s.sku_id === selectedVariant?.supplierVariantId);
  // Missing charges are not reported as zero. Only explicit, interpretable USD amounts are added.
  const taxUnit = sku?.tax_currency_code === 'USD' ? parseAmountToCents(sku.tax_amount) : null;
  const taxUsdCents = taxUnit === null ? null : taxUnit * quantity;
  const otherUsdCents = null; // estimated_import_charges has no documented currency/inclusion semantics.
  const taxIncluded = sku?.price_include_tax === true;
  const ambiguousCharges = Boolean(sku?.estimated_import_charges?.trim())
    || (Boolean(sku?.tax_amount?.trim()) && (taxUnit === null || sku?.price_include_tax === undefined));
  const productCostUsdCents = costCents === null ? null : costCents * quantity;
  const totalUsdCents = productCostUsdCents === null || shippingCents === null || ambiguousCharges ? null
    : productCostUsdCents + shippingCents + (taxIncluded ? 0 : taxUsdCents ?? 0);
  const acquisition: AcquisitionCost = {
    quantity, selectedSkuId: selectedVariant?.supplierVariantId, productCostUsdCents,
    shippingCostUsdCents: shippingCents, taxCostUsdCents: taxUsdCents,
    otherCostUsdCents: otherUsdCents, totalCostUsdCents: totalUsdCents,
  };
  let salePriceClp: number | null = null;
  if (totalUsdCents !== null) {
    try {
      salePriceClp = calculateSupplierQuote({
        productUsdCents: totalUsdCents, shippingUsdCents: 0, marginPercent, quantity: 1,
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
    shippingStatus, shippingSource, shippingMessage, quantity,
    shipFrom: payload.shipFrom ?? null, selectedSkuId: selectedVariant?.supplierVariantId,
    destination: payload.destination ?? { countryCode: 'CL' }, acquisition,
    taxUsdCents, otherUsdCents, totalUsdCents,
    fx: fxValue, fxRate: fxValue, fxSource: payload.fxSource ?? 'UNKNOWN',
    salePriceClp,
    duplicateOfProductId: payload.duplicateOfProductId ?? null,
    skuId: payload.skuId,
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

export interface PreviewOptions {
  marginPercent?: number;
  quantity?: number;
  /** Variante elegida (SKU AliExpress). Si se omite, se usa el sku_id de la URL o el primer SKU. */
  selectedSkuId?: string;
  /** Destino logístico. Hoy siempre CL; preparado para provincia/ciudad/postal. */
  countryCode?: 'CL';
  provinceCode?: string;
  cityCode?: string;
  postalCode?: string;
  /** Override manual SOLO como fallback cuando AliExpress no entrega freight. */
  manualShippingUsd?: number;
}

/** Injectable deps for tests; defaults use the real dropship service. */
export interface PreviewDeps {
  fx?: () => Promise<{ value: number; source?: string }>;
  productGet?: (productId: string) => Promise<ProductGetResult>;
  freightQuery?: (input: FreightQueryInput) => Promise<{ delivery_options?: { free_shipping?: boolean | string; shipping_fee_cent?: string }[] }>;
  buyerFreightCalculate?: (input: BuyerFreightCalculateInput) => Promise<BuyerFreightResult>;
  findDuplicate?: (aliexpressId: string) => Promise<string | null>;
}

/** Structured import logs: stages and IDs only — never tokens, secrets or raw provider payloads. */
function logImport(stage: string, data: Record<string, unknown>): void {
  try { console.info(`[aliexpress-import] ${stage}`, JSON.stringify(data)); } catch { /* logging must never break an import */ }
}

/** Safe, secret-free error label persisted to job items and returned to the UI. */
export function sanitizeImportError(error: unknown): string {
  if (error instanceof AliExpressOAuthError) return error.reason;
  if (error instanceof AliExpressDropshipError) {
    return error.providerCode ? `${error.reason}:${error.providerCode}` : error.reason;
  }
  return 'UNKNOWN';
}

export async function previewAliExpressProduct(
  rawUrl: string, options: PreviewOptions = {}, deps: PreviewDeps = {},
): Promise<ImportPreview> {
  const parsed = parseAliExpressUrl(rawUrl);
  const { productId, skuId: urlSkuId, sourceUrl } = parsed;
  logImport('URL recibida', { productId, skuId: urlSkuId ?? null });
  const marginPercent = marginSchema.catch(100).parse(options.marginPercent ?? 100);
  const quantity = z.number().int().min(1).max(10000).catch(1).parse(options.quantity ?? 1);
  const productGet = deps.productGet ?? ((id: string) => service.productGet(id));
  const fx = deps.fx ?? getUsdClpRate;
  const [product, fxRate] = await Promise.all([
    productGet(productId).catch(error => {
      logImport('fallo en aliexpress.ds.product.get', { productId, error: sanitizeImportError(error) });
      if (error instanceof AliExpressDropshipError) throw error;
      throw new AliExpressDropshipError('TRANSPORT');
    }),
    fx(),
  ]);
  logImport('respuesta de aliexpress.ds.product.get', {
    productId, variants: product.ae_item_sku_info_dtos.length,
    images: (product.ae_multimedia_info_dto?.image_urls || '').split(';').filter(Boolean).length,
  });
  // Freight for Chile via the official aliexpress.ds.freight.query. The provider
  // contract requires the SKU: use the URL sku_id when present, otherwise the
  // product's first SKU. ship_from=CL never implies free shipping — the real
  // freight response decides.
  let freightQueryFailed = false;
  const freightSkuId = options.selectedSkuId ?? urlSkuId
    ?? (String(product.ae_item_sku_info_dtos[0]?.sku_id ?? '') || undefined);
  if (!freightSkuId || !product.ae_item_sku_info_dtos.some(sku => sku.sku_id === freightSkuId)) {
    throw new AliExpressDropshipError('INPUT');
  }
  logImport('método AliExpress utilizado', { method: 'aliexpress.ds.freight.query', productId, skuId: freightSkuId ?? null });
  const freightQuery = deps.freightQuery ?? ((input: FreightQueryInput) => service.freightQuery(input));
  const [freight, duplicateOfProductId] = await Promise.all([
    freightQuery({ productId, quantity, shipToCountry: options.countryCode ?? 'CL',
      ...(freightSkuId ? { selectedSkuId: freightSkuId } : {}),
      ...(options.provinceCode ? { provinceCode: options.provinceCode } : {}),
      ...(options.cityCode ? { cityCode: options.cityCode } : {}),
    })
      .catch(error => {
        freightQueryFailed = true;
        logImport('fallo en aliexpress.ds.freight.query', { productId, skuId: freightSkuId ?? null, error: sanitizeImportError(error) });
        return undefined;
      }),
    (deps.findDuplicate ?? findDuplicateProduct)(productId),
  ]);
  const freightOptions = freight?.delivery_options?.length ?? 0;
  logImport('respuesta de aliexpress.ds.freight.query', { productId, deliveryOptions: freightOptions });
  // Official fallback for products where aliexpress.ds.freight.query is rejected:
  // aliexpress.logistics.buyer.freight.calculate (already-validated contract).
  let effectiveFreight = freight;
  if (!freightOptions) {
    const buyerFreightCalc = deps.buyerFreightCalculate
      ?? ((input: BuyerFreightCalculateInput) => service.buyerFreightCalculate(input));
    logImport('método AliExpress utilizado', { method: 'aliexpress.logistics.buyer.freight.calculate', productId, skuId: freightSkuId ?? null });
    effectiveFreight = await buyerFreightCalc({
      product_id: productId, product_num: quantity, ...(freightSkuId ? { sku_id: freightSkuId } : {}),
    }).then(result => {
      const options = (result.aeop_freight_calculate_result_for_buyer_d_t_o_list || [])
        .map(option => {
          const cent = typeof option.freight?.cent === 'number'
            ? option.freight.cent : parseAmountToCents(option.freight?.amount);
          return cent === null ? null : {
            free_shipping: cent === 0 ? 'true' : 'false', shipping_fee_cent: String(cent),
          };
        }).filter((o): o is { free_shipping: string; shipping_fee_cent: string } => o !== null);
      logImport('respuesta de aliexpress.logistics.buyer.freight.calculate', { productId, deliveryOptions: options.length });
      return options.length ? { delivery_options: options } : undefined;
    }).catch(error => {
      freightQueryFailed = true;
      logImport('fallo en aliexpress.logistics.buyer.freight.calculate', {
        productId, skuId: freightSkuId ?? null, error: sanitizeImportError(error),
      });
      return undefined;
    });
  }
  return buildImportPreview({
    product, freight: effectiveFreight, sourceUrl, aliexpressId: productId, marginPercent,
    fxValue: fxRate.value, fxSource: fxRate.source,
    manualShippingUsd: options.manualShippingUsd,
    duplicateOfProductId, skuId: freightSkuId, quantity,
    // Both freight methods failed → temporal provider error, not a real
    // "no quote for this variant/destination" answer.
    shippingError: freightQueryFailed && !effectiveFreight,
  });
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
  if (preview.shippingUnknown || preview.shippingUsdCents === null) {
    throw new AliExpressDropshipError('SHIPPING_UNKNOWN');
  }
  if (preview.salePriceClp === null) throw new AliExpressDropshipError('INPUT');
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
      aliexpressSnapshot: {
        ...(preview.raw as object),
        acquisition: preview.acquisition,
        shippingSource: preview.shippingSource,
        shippingStatus: preview.shippingStatus,
        destination: preview.destination,
        fxRate: preview.fxRate,
        fxSource: preview.fxSource,
      } as object,
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
      logImport('item de cola', { jobId, itemId: item.id, productId: preview.aliexpressId });
      if (preview.duplicateOfProductId) throw new AliExpressDropshipError('DUPLICATE');
      if (preview.shippingUnknown) throw new AliExpressDropshipError('SHIPPING_UNKNOWN');
      if (!job.categoryId) throw new AliExpressDropshipError('INPUT');
      const product = await publishAliExpressProduct({
        preview, categoryId: job.categoryId, marginPercent: job.marginPercent, publish: false,
      }, db);
      await db.aliExpressImportJobItem.update({
        where: { id: item.id },
        data: { status: 'DONE', aliexpressId: preview.aliexpressId, createdProductId: product.id, error: null },
      });
      succeeded += 1;
    } catch (error) {
      const failureReason = sanitizeImportError(error);
      logImport('item de cola falló', { jobId, itemId: item.id, error: failureReason });
      const attempts = item.attempts + 1;
      const done = attempts >= MAX_ATTEMPTS;
      await db.aliExpressImportJobItem.update({
        where: { id: item.id },
        data: { status: done ? 'FAILED' : 'PENDING', attempts, error: failureReason },
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
          createdProductId: true, error: true, createdAt: true },
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
      productCost: true, salePrice: true, margin: true, stock: true, status: true,
      totalCost: true, shippingCost: true, aliexpressMarginPercent: true,
      aliexpressShippingUsdCents: true, aliexpressSnapshot: true },
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

/** Re-queries freight (ds.freight.query → buyer.freight.calculate fallback).
 * Distinguishes FREE($0)/AVAILABLE/PROVIDER_UNAVAILABLE/PROVIDER_ERROR. Never $0 by default. */
export async function resolveFreightCents(input: {
  productId: string; skuId: string; quantity: number; shipToCountry?: 'CL';
}, deps: Partial<PreviewDeps> = {}): Promise<{ cents: number | null; status: ShippingStatus }> {
  const fq = deps.freightQuery ?? ((freight: FreightQueryInput) => service.freightQuery(freight));
  const bfc = deps.buyerFreightCalculate ?? ((freight: BuyerFreightCalculateInput) => service.buyerFreightCalculate(freight));
  let transportError = false;
  try {
    const result = await fq({
      productId: input.productId, quantity: input.quantity,
      shipToCountry: input.shipToCountry ?? 'CL', selectedSkuId: input.skuId,
    });
    const cents = cheapestFreightCents(result.delivery_options);
    if (cents !== null) return { cents, status: cents === 0 ? 'FREE' : 'AVAILABLE' };
  } catch (error) {
    transportError = true;
    logImport('fallo en aliexpress.ds.freight.query', { productId: input.productId, skuId: input.skuId, error: sanitizeImportError(error) });
  }
  try {
    const result = await bfc({
      product_id: input.productId, product_num: input.quantity, sku_id: input.skuId,
    });
    const options = (result.aeop_freight_calculate_result_for_buyer_d_t_o_list || [])
      .map(option => {
        const cent = typeof option.freight?.cent === 'number'
          ? option.freight.cent : parseAmountToCents(option.freight?.amount);
        return cent === null ? null : {
          free_shipping: cent === 0 ? 'true' : 'false', shipping_fee_cent: String(cent),
        };
      }).filter((o): o is { free_shipping: string; shipping_fee_cent: string } => o !== null);
    const cents = cheapestFreightCents(options as never);
    if (cents !== null) return { cents, status: cents === 0 ? 'FREE' : 'AVAILABLE' };
    // APIs answered but gave no option for this variant/destination.
    return { cents: null, status: 'PROVIDER_UNAVAILABLE' };
  } catch (error) {
    logImport('fallo en aliexpress.logistics.buyer.freight.calculate', {
      productId: input.productId, skuId: input.skuId, error: sanitizeImportError(error),
    });
    // Both APIs failed → temporal provider error (never a silent $0).
    return { cents: null, status: 'PROVIDER_ERROR' };
  }
}

/**
 * Synchronisation of one imported AliExpress product: price + stock + freight
 * re-query (both official APIs) → cost/total/salePrice recalculated with the
 * configured margin → per-SKU variant updates → history log. Sale price follows
 * the margin by default (updateSalePrice=false to opt out).
 */
export async function syncAliExpressProduct(input: {
  productId: string;
  updateSalePrice?: boolean;
}, db: typeof prisma = prisma) {
  const { product, aliexpressId } = await findAliExpressProductForSync(input.productId, db);
  try {
    const [wholesale, fx] = await Promise.all([service.productWholesaleGet(aliexpressId), getUsdClpRate()]);
    const marginPercent = product.aliexpressMarginPercent ?? product.margin ?? 100;
    const currentShippingCents = product.aliexpressShippingUsdCents ?? null;
    const snapshot = (product.aliexpressSnapshot && typeof product.aliexpressSnapshot === 'object'
      ? product.aliexpressSnapshot : {}) as Record<string, unknown>;
    const firstSku = String(wholesale.ae_item_sku_info_dtos[0]?.sku_id ?? '') || undefined;
    const freightSkuId = (typeof snapshot.selectedSkuId === 'string' && snapshot.selectedSkuId) || firstSku;
    if (!freightSkuId) throw new AliExpressDropshipError('INPUT');
    // Always attempt BOTH freight sources before deciding anything.
    const freight = await resolveFreightCents({ productId: aliexpressId, skuId: freightSkuId, quantity: 1 });
    const preview = buildImportPreview({
      product: wholesale, sourceUrl: product.sourceUrl || '', aliexpressId,
      marginPercent, fxValue: fx.value, skuId: freightSkuId, quantity: 1,
      // Unknown/failed freight falls back to the stored value ONLY if it was
      // previously reported by AliExpress (never invents a number).
      manualShippingUsd: freight.cents === null && currentShippingCents !== null
        ? currentShippingCents / 100 : undefined,
    });
    const shippingCents = preview.shippingUsdCents;
    const costAfter = preview.costUsdCents === null ? null : preview.costUsdCents / 100;
    const stockAfter = preview.totalStock;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (costAfter !== null && costAfter !== product.productCost) {
      changes.cost = { before: product.productCost, after: costAfter };
    }
    if (stockAfter !== null && stockAfter !== product.stock) {
      changes.stock = { before: product.stock, after: stockAfter };
    }
    if (shippingCents !== null && shippingCents !== currentShippingCents) {
      changes.shipping = { before: currentShippingCents, after: shippingCents };
    }
    const shouldUpdateSalePrice = (input.updateSalePrice ?? true) && preview.salePriceClp !== null;
    const previousStatus = product.status;
    let nextStatus = previousStatus;
    if (stockAfter === 0) nextStatus = 'OUT_OF_STOCK';
    else if (previousStatus === 'OUT_OF_STOCK') nextStatus = 'PUBLISHED';
    if (nextStatus !== previousStatus) changes.availability = { before: previousStatus, after: nextStatus };

    await db.product.update({
      where: { id: product.id },
      data: {
        ...(costAfter !== null ? { productCost: costAfter } : {}),
        ...(costAfter !== null && shippingCents !== null
          ? { shippingCost: shippingCents / 100, totalCost: costAfter + shippingCents / 100 } : {}),
        ...(stockAfter !== null ? { stock: stockAfter } : {}),
        ...(shouldUpdateSalePrice && preview.salePriceClp ? { salePrice: preview.salePriceClp } : {}),
        ...(shippingCents !== null ? { aliexpressShippingUsdCents: shippingCents } : {}),
        aliexpressShippingUnknown: shippingCents === null,
        aliexpressSyncedAt: new Date(),
        ...(nextStatus !== previousStatus ? { status: nextStatus } : {}),
        // Per-SKU stock/cost/shipping: each variant is synchronised individually.
        productVariants: {
          updateMany: preview.variants
            .filter(variant => variant.stockKnown || variant.costUsdCents !== null)
            .map(variant => ({
              where: { supplierVariantId: variant.supplierVariantId },
              data: {
                ...(variant.stockKnown ? { supplierStock: variant.stock, supplierStockKnown: true } : {}),
                ...(variant.costUsd !== null ? { supplierCostUsd: variant.costUsd } : {}),
                ...(shippingCents !== null ? { supplierShippingUsd: shippingCents / 100 } : {}),
              },
            })),
        },
      },
    });
    await db.aliExpressSyncLog.create({
      data: { productId: product.id, aliexpressId, skuId: freightSkuId,
        status: Object.keys(changes).length ? 'CHANGED' : 'UNCHANGED',
        costBeforeUsd: product.productCost, costAfterUsd: costAfter,
        stockBefore: product.stock, stockAfter,
        shippingBeforeUsdCents: currentShippingCents, shippingAfterUsdCents: shippingCents,
        shippingStatus: freight.cents === null ? freight.status : preview.shippingStatus,
        changes: changes as object },
    });
    return {
      productId: product.id, aliexpressId, changed: Object.keys(changes),
      shippingStatus: freight.cents === null ? freight.status : preview.shippingStatus,
      shippingUnknown: shippingCents === null,
      priceChanged: Boolean(changes.cost), salePriceClp: preview.salePriceClp,
    };
  } catch (error) {
    await db.aliExpressSyncLog.create({
      data: { productId: product.id, aliexpressId, status: 'ERROR',
        shippingStatus: 'PROVIDER_ERROR', error: sanitizeImportError(error) },
    });
    throw error;
  }
}

export async function syncHistory(productId: string, db: typeof prisma = prisma) {
  return db.aliExpressSyncLog.findMany({
    where: { productId }, orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, status: true, skuId: true, costBeforeUsd: true, costAfterUsd: true,
      stockBefore: true, stockAfter: true, shippingBeforeUsdCents: true,
      shippingAfterUsdCents: true, shippingStatus: true, changes: true, createdAt: true },
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
 *  2. ALIEXPRESS_ORDER_EXECUTION=true in the backend environment, and
 *  3. a Production runtime (NODE_ENV=production). Never enabled elsewhere.
 * Without all three, nothing reaches AliExpress.
 */
export async function executeAliExpressOrder(orderId: string, options: { confirm: boolean }, db: typeof prisma = prisma) {
  if (options.confirm !== true) throw new AliExpressDropshipError('NOT_CONFIRMED');
  if (process.env.NODE_ENV !== 'production') throw new AliExpressDropshipError('BLOCKED');
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

