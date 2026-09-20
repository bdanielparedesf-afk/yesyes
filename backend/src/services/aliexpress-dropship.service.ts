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
import {
  COMMERCIAL_FALLBACK_SHIPPING_USD_CENTS, computeYesYesPrice,
  type YesYesShippingState,
} from '../aliexpress/yesyes-pricing';
import { matchesAliExpressProduct, parseAliExpressUrl } from '../aliexpress/product-url';

export { AliExpressDropshipError, MARGIN_PRESETS, resolveCategory };

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

/** Cheapest freight option in cents; null when the provider reported nothing.
 * Real provider quirk (verified live 2026-09-18, product 1005011692664194):
 * `shipping_fee_cent` arrives as `"2.99"` (decimal USD dollars) while other
 * options arrive as `"400"` (integer minor-unit cents) and `free_shipping`
 * may be boolean. Integer strings stay as cents; decimal strings are
 * dollars → cents. Anything else stays null (never 0 by default). */
export function cheapestFreightCents(
  options: { free_shipping?: boolean | string; shipping_fee_cent?: string | number; shipping_fee_currency?: string }[] | undefined,
): number | null {
  if (!options?.length) return null;
  const values = options.map(option => {
    // The request targets USD. Never reinterpret an explicitly different currency as USD.
    if (option.shipping_fee_currency !== undefined && option.shipping_fee_currency !== 'USD') return null;
    const isFree = option.free_shipping === true || option.free_shipping === 'true';
    if (isFree) return 0;
    const raw = option.shipping_fee_cent;
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw) || raw < 0) return null;
      // Numeric payload: integer → cents; decimal → dollars.
      const cents = Number.isInteger(raw) ? raw : Math.round(raw * 100);
      return Number.isSafeInteger(cents) ? cents : null;
    }
    if (typeof raw !== 'string') return null;
    const text = raw.trim();
    if (/^\d+$/.test(text)) {
      const cents = Number(text);
      return Number.isSafeInteger(cents) ? cents : null;
    }
    if (/^\d+\.\d+$/.test(text)) {
      const dollars = Number(text);
      if (!Number.isFinite(dollars) || dollars < 0) return null;
      const cents = Math.round(dollars * 100);
      return Number.isSafeInteger(cents) ? cents : null;
    }
    return null;
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
  shippingUsdCents: number | null;
  shippingUsd: number | null;
  supplierAcquisitionCostUsdCents: number | null;
  productSalePriceUsd: number | null;
  customerShippingUsdCents: number | null;
  customerTotalUsd: number | null;
  salePriceClp: number | null;
  shippingStatus: ShippingStatus;
  shippingSource: ShippingSource;
  shippingMessage: string;
}

/** Explicit shipping resolution — never collapse unknown into 0.
 * YesYes nomenclature (definitive). Legacy literals (AVAILABLE/FREE/…)
 * stay in the union for backward compat with stored snapshots; new code
 * always emits SHIPPING_* values. */
export type ShippingStatus =
  | 'AVAILABLE' | 'FREE' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_ERROR' | 'UNKNOWN'
  | 'SHIPPING_CONFIRMED_FREE' | 'SHIPPING_CONFIRMED' | 'SHIPPING_UNKNOWN'
  | 'SHIPPING_ERROR' | 'SHIPPING_COMMERCIAL_FALLBACK' | 'SHIPPING_CACHED';
export type ShippingSource = 'ALIEXPRESS' | 'MANUAL' | 'COMMERCIAL' | 'NONE';

export const SHIPPING_STATUS_MESSAGE: Record<ShippingStatus, string> = {
  FREE: 'Envío gratis confirmado por AliExpress ($0).',
  AVAILABLE: 'Costo de envío proporcionado por AliExpress.',
  SHIPPING_CONFIRMED_FREE: 'Envío gratis confirmado por AliExpress ($0).',
  SHIPPING_CONFIRMED: 'Costo de envío proporcionado por AliExpress.',
  PROVIDER_UNAVAILABLE: 'AliExpress no proporcionó costo de envío para esta variante/destino.',
  PROVIDER_ERROR: 'Error temporal consultando el envío en AliExpress; reintentar más tarde.',
  SHIPPING_UNKNOWN: 'AliExpress no proporcionó costo de envío para esta variante/destino.',
  SHIPPING_ERROR: 'Error temporal consultando el envío en AliExpress; reintentar más tarde.',
  SHIPPING_COMMERCIAL_FALLBACK: 'Respaldo comercial YesYes (US$10); no es cotización de AliExpress.',
  SHIPPING_CACHED: 'Cotización AliExpress reutilizada desde caché reciente.',
  UNKNOWN: 'Fuente de envío desconocida.',
};

/** Map any legacy status to the new nomenclature (compat helper). */
export function normalizeShippingStatus(status: string): ShippingStatus {
  switch (status) {
    case 'FREE': return 'SHIPPING_CONFIRMED_FREE';
    case 'AVAILABLE': return 'SHIPPING_CONFIRMED';
    case 'PROVIDER_UNAVAILABLE': return 'SHIPPING_UNKNOWN';
    case 'PROVIDER_ERROR': return 'SHIPPING_ERROR';
    case 'UNKNOWN': return 'SHIPPING_UNKNOWN';
    default: return status as ShippingStatus;
  }
}

interface ShippingResolutionInput {
  providerShippingCents: number | null;
  cachedShippingCents: number | null;
  manualShippingCents: number | null;
  commercialShippingCents: number | null;
  shippingError?: boolean;
}

interface ShippingResolution {
  shippingCents: number | null;
  shippingSource: ShippingSource;
  shippingStatus: ShippingStatus;
  yesYesShippingState: YesYesShippingState;
  shippingMessage: string;
  supplierConfirmedForMargin: number | null;
  customerShippingUsdCents: number | null;
}

function resolveShippingResolution(input: ShippingResolutionInput): ShippingResolution {
  const { providerShippingCents, cachedShippingCents, manualShippingCents, commercialShippingCents } = input;
  const supplierConfirmedForMargin = providerShippingCents ?? cachedShippingCents;
  const isCommercialFallback = providerShippingCents === null && cachedShippingCents === null
    && manualShippingCents === null && commercialShippingCents !== null;
  const isManual = providerShippingCents === null && cachedShippingCents === null && manualShippingCents !== null;
  const shippingSource: ShippingSource = supplierConfirmedForMargin !== null ? 'ALIEXPRESS'
    : manualShippingCents !== null ? 'MANUAL'
    : commercialShippingCents !== null ? 'COMMERCIAL' : 'NONE';
  const shippingStatus: ShippingStatus = providerShippingCents !== null
    ? (providerShippingCents === 0 ? 'SHIPPING_CONFIRMED_FREE' : 'SHIPPING_CONFIRMED')
    : cachedShippingCents !== null ? 'SHIPPING_CACHED'
    : manualShippingCents !== null ? (input.shippingError === true ? 'SHIPPING_ERROR' : 'SHIPPING_UNKNOWN')
    : commercialShippingCents !== null
      ? (input.shippingError === true ? 'SHIPPING_ERROR' : 'SHIPPING_COMMERCIAL_FALLBACK')
    : (input.shippingError === true ? 'SHIPPING_ERROR' : 'SHIPPING_UNKNOWN');
  const yesYesShippingState: YesYesShippingState = shippingStatus === 'SHIPPING_CONFIRMED_FREE'
    ? 'SHIPPING_CONFIRMED_FREE'
    : shippingStatus === 'SHIPPING_CONFIRMED' ? 'SHIPPING_CONFIRMED'
    : shippingStatus === 'SHIPPING_CACHED' ? 'SHIPPING_CACHED'
    : shippingStatus === 'SHIPPING_ERROR' ? 'SHIPPING_ERROR'
    : shippingStatus === 'SHIPPING_COMMERCIAL_FALLBACK' ? 'SHIPPING_COMMERCIAL_FALLBACK'
    : 'SHIPPING_UNKNOWN';
  const customerShippingUsdCents = supplierConfirmedForMargin !== null
    ? (supplierConfirmedForMargin === 0
      ? 500 : supplierConfirmedForMargin)
    : isManual && manualShippingCents !== null ? manualShippingCents
    : commercialShippingCents ?? null;
  const shippingCents = supplierConfirmedForMargin ?? customerShippingUsdCents;
  const shippingMessage = shippingCents === null
    ? SHIPPING_STATUS_MESSAGE[shippingStatus]
    : isCommercialFallback
      ? (input.shippingError === true
          ? 'Envío AliExpress: No disponible (error temporal). Envío al cliente: US$10. Fuente: Respaldo comercial (los US$10 no son cotización de AliExpress, no llevan margen y no forman parte del costo de adquisición).'
          : 'Envío AliExpress: No disponible. Envío al cliente: US$10. Fuente: Respaldo comercial (los US$10 no son cotización de AliExpress, no llevan margen y no forman parte del costo de adquisición).')
    : shippingSource === 'MANUAL'
      ? 'Costo de envío manual del administrador; no confirmado por AliExpress.'
      : cachedShippingCents !== null && supplierConfirmedForMargin === cachedShippingCents
        ? 'Cotización AliExpress reutilizada desde caché reciente.'
        : SHIPPING_STATUS_MESSAGE[shippingStatus];
  return {
    shippingCents, shippingSource, shippingStatus, yesYesShippingState, shippingMessage,
    supplierConfirmedForMargin, customerShippingUsdCents,
  };
}

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
  /** New YesYes nomenclature (definitive). Always SHIPPING_* for new previews. */
  yesYesShippingState: YesYesShippingState;
  /** YesYes commercial model (USD, exact — rounding only for display). */
  supplierProductCostUsdCents: number | null;
  supplierShippingCostUsdCents: number | null;
  supplierAcquisitionCostUsdCents: number | null;
  productSalePriceUsd: number | null;
  customerShippingUsdCents: number | null;
  customerTotalUsd: number | null;
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
  freight?: { delivery_options?: { free_shipping?: boolean | string; shipping_fee_cent?: string | number; shipping_fee_currency?: string }[] };
  freightBySkuId?: Record<string, { delivery_options?: { free_shipping?: boolean | string; shipping_fee_cent?: string | number; shipping_fee_currency?: string }[] }>;
  sourceUrl: string;
  aliexpressId: string;
  marginPercent: number;
  fxValue: number;
  fxSource?: string;
  quantity?: number;
  /** Backend-only: override manual legacy (ya no expuesto en UI). */
  manualShippingUsd?: number;
  /** Backend-only: fallback comercial automático US$10 cuando no hay freight válido. */
  commercialShippingUsdCents?: number;
  commercialShippingUsdCentsBySkuId?: Record<string, number>;
  /** Backend-only: cotización AliExpress válida reutilizada desde caché. */
  cachedShippingUsdCents?: number;
  cachedShippingUsdCentsBySkuId?: Record<string, number>;
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

  const selectedSkuId = payload.skuId
    ?? product.ae_item_sku_info_dtos[0]?.sku_id;
  if (payload.skuId && !product.ae_item_sku_info_dtos.some(sku => sku.sku_id === payload.skuId)) {
    throw new AliExpressDropshipError('INPUT');
  }
  const stocks = product.ae_item_sku_info_dtos
    .map(sku => typeof sku.sku_available_stock === 'number' ? Math.trunc(sku.sku_available_stock) : null)
    .filter((stock): stock is number => stock !== null);
  const quantity = z.number().int().min(1).max(10000).parse(payload.quantity ?? 1);
  const manualShipping = payload.manualShippingUsd === undefined ? null
    : parseAmountToCents(z.number().finite().nonnegative().parse(payload.manualShippingUsd));

  const variants: PreviewVariant[] = product.ae_item_sku_info_dtos.map(sku => {
    const props = (sku.ae_sku_property_dtos || []).map(prop => ({
      name: prop.sku_property_name || '',
      value: prop.property_value_definition_name || prop.sku_property_value || '',
      image: prop.sku_image || undefined,
    }));
    const stock = typeof sku.sku_available_stock === 'number'
      ? Math.trunc(sku.sku_available_stock) : null;
    const costCents = parseAmountToCents(sku.sku_price);
    const variantFreight = payload.freightBySkuId?.[sku.sku_id]
      ?? (sku.sku_id === selectedSkuId ? payload.freight : undefined);
    const providerShipping = cheapestFreightCents(variantFreight?.delivery_options);
    const cachedShipping = payload.cachedShippingUsdCentsBySkuId?.[sku.sku_id]
      ?? (sku.sku_id === selectedSkuId ? payload.cachedShippingUsdCents ?? null : null);
    const commercialShipping = payload.commercialShippingUsdCentsBySkuId?.[sku.sku_id]
      ?? (sku.sku_id === selectedSkuId ? payload.commercialShippingUsdCents ?? null : null);
    const shipping = resolveShippingResolution({
      providerShippingCents: providerShipping,
      cachedShippingCents: cachedShipping === undefined ? null : cachedShipping,
      manualShippingCents: manualShipping,
      commercialShippingCents: commercialShipping === undefined ? null : commercialShipping,
      shippingError: payload.shippingError,
    });
    const productCostCents = costCents === null ? null : costCents * quantity;
    let supplierAcquisitionCostUsdCents: number | null = null;
    let productSalePriceUsd: number | null = null;
    let customerShippingUsdCents: number | null = null;
    let customerTotalUsd: number | null = null;
    if (productCostCents !== null && shipping.supplierConfirmedForMargin !== null) {
      try {
        const priced = computeYesYesPrice({
          supplierProductCostUsdCents: productCostCents,
          supplierShippingCostUsdCents: shipping.supplierConfirmedForMargin,
          marginPercent,
        });
        supplierAcquisitionCostUsdCents = priced.supplierAcquisitionCostUsdCents;
        productSalePriceUsd = priced.productSalePriceUsd;
        customerShippingUsdCents = priced.customerShippingUsdCents;
        customerTotalUsd = priced.customerTotalUsd;
      } catch { /* deja nulos */ }
    } else if (productCostCents !== null && shipping.customerShippingUsdCents !== null) {
      try {
        const priced = computeYesYesPrice({
          supplierProductCostUsdCents: productCostCents,
          supplierShippingCostUsdCents: null,
          marginPercent,
        });
        productSalePriceUsd = priced.productSalePriceUsd;
        customerShippingUsdCents = shipping.customerShippingUsdCents;
        // El US$10 comercial/manual NO recibe margen: total = venta + envio.
        customerTotalUsd = productSalePriceUsd + customerShippingUsdCents / 100;
      } catch { /* deja nulos */ }
    }
    let salePriceClp: number | null = null;
    if (productSalePriceUsd !== null) {
      const clp = Math.round(productSalePriceUsd * fxValue);
      salePriceClp = Number.isSafeInteger(clp) ? clp : null;
    }
    return {
      supplierVariantId: sku.sku_id,
      skuAttr: sku.sku_attr || '',
      attributes: props,
      image: props.find(p => p.image)?.image || undefined,
      costUsd: costCents === null ? null : costCents / 100,
      costUsdCents: costCents,
      stock, stockKnown: stock !== null,
      shippingUsdCents: shipping.supplierConfirmedForMargin,
      shippingUsd: shipping.supplierConfirmedForMargin === null ? null : shipping.supplierConfirmedForMargin / 100,
      supplierAcquisitionCostUsdCents,
      productSalePriceUsd,
      customerShippingUsdCents,
      customerTotalUsd,
      salePriceClp,
      shippingStatus: shipping.shippingStatus,
      shippingSource: shipping.shippingSource,
      shippingMessage: shipping.shippingMessage,
    };
  });

  const selectedVariant = variants.find(variant => variant.supplierVariantId === selectedSkuId) ?? null;
  const selectedCostCents = selectedVariant?.costUsdCents ?? null;
  const selectedSku = product.ae_item_sku_info_dtos.find(s => s.sku_id === selectedSkuId);
  const taxUnit = selectedSku?.tax_currency_code === 'USD' ? parseAmountToCents(selectedSku.tax_amount) : null;
  const taxUsdCents = taxUnit === null ? null : taxUnit * quantity;
  const otherUsdCents = null;
  const taxIncluded = selectedSku?.price_include_tax === true;
  const ambiguousCharges = Boolean(selectedSku?.estimated_import_charges?.trim())
    || (Boolean(selectedSku?.tax_amount?.trim()) && (taxUnit === null || selectedSku?.price_include_tax === undefined));
  const productCostUsdCents = selectedCostCents === null ? null : selectedCostCents * quantity;
  const legacySupplierShipping = selectedVariant?.shippingUsdCents ?? null;
  const totalUsdCents = productCostUsdCents === null || legacySupplierShipping === null || ambiguousCharges ? null
    : productCostUsdCents + legacySupplierShipping + (taxIncluded ? 0 : taxUsdCents ?? 0);
  const acquisition: AcquisitionCost = {
    quantity, selectedSkuId: selectedVariant?.supplierVariantId, productCostUsdCents,
    shippingCostUsdCents: legacySupplierShipping, taxCostUsdCents: taxUsdCents,
    otherCostUsdCents: otherUsdCents, totalCostUsdCents: totalUsdCents,
  };
  const salePriceClp = selectedVariant?.salePriceClp ?? null;

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
    costUsdCents: selectedCostCents,
    shippingUsdCents: legacySupplierShipping,
    shippingUnknown: !selectedVariant
      || (selectedVariant.customerShippingUsdCents === null && legacySupplierShipping === null),
    shippingStatus: selectedVariant?.shippingStatus ?? 'SHIPPING_UNKNOWN',
    shippingSource: selectedVariant?.shippingSource ?? 'NONE',
    shippingMessage: selectedVariant?.shippingMessage ?? SHIPPING_STATUS_MESSAGE.SHIPPING_UNKNOWN,
    yesYesShippingState: selectedVariant
      ? (selectedVariant.shippingStatus === 'SHIPPING_CONFIRMED_FREE' ? 'SHIPPING_CONFIRMED_FREE'
        : selectedVariant.shippingStatus === 'SHIPPING_CONFIRMED' ? 'SHIPPING_CONFIRMED'
        : selectedVariant.shippingStatus === 'SHIPPING_CACHED' ? 'SHIPPING_CACHED'
        : selectedVariant.shippingStatus === 'SHIPPING_ERROR' ? 'SHIPPING_ERROR'
        : selectedVariant.shippingStatus === 'SHIPPING_COMMERCIAL_FALLBACK' ? 'SHIPPING_COMMERCIAL_FALLBACK'
        : 'SHIPPING_UNKNOWN')
      : 'SHIPPING_UNKNOWN',
    supplierProductCostUsdCents: productCostUsdCents,
    supplierShippingCostUsdCents: legacySupplierShipping,
    supplierAcquisitionCostUsdCents: selectedVariant?.supplierAcquisitionCostUsdCents ?? null,
    productSalePriceUsd: selectedVariant?.productSalePriceUsd ?? null,
    customerShippingUsdCents: selectedVariant?.customerShippingUsdCents ?? null,
    customerTotalUsd: selectedVariant?.customerTotalUsd ?? null,
    quantity,
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
  freightQuery?: (input: FreightQueryInput) => Promise<{ delivery_options?: { free_shipping?: boolean | string; shipping_fee_cent?: string | number; shipping_fee_currency?: string }[] }>;
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

/** Fallback comercial automático (NO manual): US$10 = 1000 cents.
 * Solo se usa cuando freight.query + retry + buyer.calculate + caché
 * reciente no entregan una cotización válida. Fuente: COMMERCIAL.
 * Los US$10 NO son costo proveedor, NO llevan margen y NO se suman dos veces. */
export const COMMERCIAL_FREIGHT_FALLBACK_USD_CENTS = COMMERCIAL_FALLBACK_SHIPPING_USD_CENTS;

interface FreightCacheEntry { cents: number; at: number }
const freightCache = new Map<string, FreightCacheEntry>();
/** Cotización válida reciente reutilizable (24h). Solo AliExpress confirmado. */
export const FREIGHT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function freightCacheKey(productId: string, skuId: string): string {
  return `${productId}::${skuId}::CL::1`;
}

/** Guarda una cotización válida del proveedor para reutilizarla si luego falla. */
export function rememberFreightQuote(productId: string, skuId: string, cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) return;
  freightCache.set(freightCacheKey(productId, skuId), { cents, at: Date.now() });
}

/** Lee caché solo si es reciente. Nunca inventa: null si no hay o expiró. */
export function readFreightCache(productId: string, skuId: string, now = Date.now()): number | null {
  const entry = freightCache.get(freightCacheKey(productId, skuId));
  if (!entry || now - entry.at > FREIGHT_CACHE_TTL_MS) {
    if (entry) freightCache.delete(freightCacheKey(productId, skuId));
    return null;
  }
  return entry.cents;
}

/** Solo para tests: limpia la caché en memoria. */
export function clearFreightCache(): void {
  freightCache.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Bounded retry with controlled backoff (no infinite loops).
 * Safe instrumentation only: method, attempt, duration, error label,
 * option counts and parser outcome — never secrets or raw payloads. */
async function withFreightRetry<T>(
  method: 'aliexpress.ds.freight.query' | 'aliexpress.logistics.buyer.freight.calculate',
  run: () => Promise<T>,
  meta: { productId: string; skuId: string | null; quantity: number },
  backoffsMs: readonly number[] = [1000, 3000],
): Promise<{ value?: T; attempts: number; failed: boolean }> {
  const maxAttempts = backoffsMs.length + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    try {
      const value = await run();
      logImport(`respuesta de ${method}`, { ...meta, attempt, attempts: maxAttempts,
        durationMs: Date.now() - started });
      return { value, attempts: attempt, failed: false };
    } catch (error) {
      const last = attempt === maxAttempts;
      logImport(`fallo en ${method}`, { ...meta, attempt, attempts: maxAttempts,
        durationMs: Date.now() - started, error: sanitizeImportError(error),
        willRetry: !last });
      if (last) return { attempts: attempt, failed: true };
      await sleep(backoffsMs[attempt - 1] ?? 1000);
    }
  }
  return { attempts: maxAttempts, failed: true };
}

type FreightPayload = {
  delivery_options?: { free_shipping?: boolean | string; shipping_fee_cent?: string | number; shipping_fee_currency?: string }[];
};

interface ResolvedPreviewFreight {
  freight?: FreightPayload;
  providerShippingCents: number | null;
  cachedShippingCents: number | null;
  commercialShippingCents: number | null;
  failed: boolean;
}

async function resolvePreviewFreight(input: {
  productId: string;
  skuId: string;
  quantity: number;
  options: PreviewOptions;
  deps: PreviewDeps;
}): Promise<ResolvedPreviewFreight> {
  const freightQuery = input.deps.freightQuery
    ?? ((freight: FreightQueryInput) => service.freightQuery(freight));
  const buyerFreightCalculate = input.deps.buyerFreightCalculate
    ?? ((freight: BuyerFreightCalculateInput) => service.buyerFreightCalculate(freight));
  const meta = {
    productId: input.productId, skuId: input.skuId, quantity: input.quantity,
    destinationCountry: input.options.countryCode ?? 'CL',
  };
  const freightInput: FreightQueryInput = {
    productId: input.productId, quantity: input.quantity,
    shipToCountry: input.options.countryCode ?? 'CL', selectedSkuId: input.skuId,
    ...(input.options.provinceCode ? { provinceCode: input.options.provinceCode } : {}),
    ...(input.options.cityCode ? { cityCode: input.options.cityCode } : {}),
  };
  logImport('método AliExpress utilizado', { method: 'aliexpress.ds.freight.query', ...meta });
  const freightOutcome = input.deps.freightQuery
    ? await withFreightRetry('aliexpress.ds.freight.query',
      () => freightQuery(freightInput), { ...meta, skuId: input.skuId }, [])
    : await withFreightRetry('aliexpress.ds.freight.query',
      () => freightQuery(freightInput), { ...meta, skuId: input.skuId });
  let buyerFailed = false;
  let effectiveFreight: FreightPayload | undefined = freightOutcome.value;
  const freightOptions = effectiveFreight?.delivery_options?.length ?? 0;
  let parsedCents = cheapestFreightCents(effectiveFreight?.delivery_options);
  logImport('parser de aliexpress.ds.freight.query', { ...meta,
    deliveryOptions: freightOptions, parsedCents,
    decisionSoFar: parsedCents !== null
      ? (parsedCents === 0 ? 'FREE_CANDIDATE' : 'PAID_CANDIDATE') : 'NO_QUOTE_YET' });
  if (!freightOptions || parsedCents === null) {
    const buyerInput: BuyerFreightCalculateInput = {
      product_id: input.productId, product_num: input.quantity, sku_id: input.skuId,
    };
    logImport('método AliExpress utilizado', {
      method: 'aliexpress.logistics.buyer.freight.calculate', ...meta,
    });
    const buyerOutcome = input.deps.buyerFreightCalculate
      ? await withFreightRetry('aliexpress.logistics.buyer.freight.calculate',
        () => buyerFreightCalculate(buyerInput), { ...meta, skuId: input.skuId }, [])
      : await withFreightRetry('aliexpress.logistics.buyer.freight.calculate',
        () => buyerFreightCalculate(buyerInput), { ...meta, skuId: input.skuId });
    if (buyerOutcome.failed) {
      buyerFailed = true;
    } else {
      const result = buyerOutcome.value!;
      const options = (result.aeop_freight_calculate_result_for_buyer_d_t_o_list || [])
        .map(option => {
          const cent = typeof option.freight?.cent === 'number'
            ? option.freight.cent : parseAmountToCents(option.freight?.amount);
          return cent === null ? null : {
            free_shipping: cent === 0 ? 'true' : 'false', shipping_fee_cent: String(cent),
          };
        }).filter((option): option is { free_shipping: string; shipping_fee_cent: string } => option !== null);
      parsedCents = cheapestFreightCents(options);
      logImport('parser de aliexpress.logistics.buyer.freight.calculate', { ...meta,
        deliveryOptions: options.length, parsedCents,
        decisionSoFar: parsedCents !== null
          ? (parsedCents === 0 ? 'FREE_CANDIDATE' : 'PAID_CANDIDATE') : 'NO_QUOTE_YET' });
      effectiveFreight = options.length ? { delivery_options: options } : undefined;
    }
  }
  const providerShippingCents = cheapestFreightCents(effectiveFreight?.delivery_options);
  if (providerShippingCents !== null) rememberFreightQuote(input.productId, input.skuId, providerShippingCents);
  let cachedShippingCents: number | null = null;
  let commercialShippingCents: number | null = null;
  if (providerShippingCents === null) {
    cachedShippingCents = readFreightCache(input.productId, input.skuId);
    if (cachedShippingCents === null && input.options.manualShippingUsd === undefined) {
      commercialShippingCents = COMMERCIAL_FREIGHT_FALLBACK_USD_CENTS;
    }
  }
  return {
    freight: effectiveFreight, providerShippingCents, cachedShippingCents,
    commercialShippingCents, failed: freightOutcome.failed || buyerFailed,
  };
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
  const freightSkuId = options.selectedSkuId ?? urlSkuId
    ?? (String(product.ae_item_sku_info_dtos[0]?.sku_id ?? '') || undefined);
  if (!freightSkuId || !product.ae_item_sku_info_dtos.some(sku => sku.sku_id === freightSkuId)) {
    throw new AliExpressDropshipError('INPUT');
  }
  const duplicateOfProductId = await (deps.findDuplicate ?? findDuplicateProduct)(productId);
  // Freight: UNA sola cotización por el SKU de referencia (seleccionado/default).
  // Antes se cotizaba freight por CADA SKU (hasta 6 llamadas al proveedor por SKU
  // con reintentos): con 160 variantes la preview tardaba minutos. El costo de
  // envío sigue participando en productCost + shippingCost = totalCost y luego
  // totalCost + margen = salePrice. Las diferencias de precio entre variantes
  // provienen del sku_price (intacto). Si hay caché reciente por SKU se reutiliza.
  const freightResolutions: Record<string, ResolvedPreviewFreight> = {};
  const referenceResolution = await resolvePreviewFreight({
    productId, skuId: freightSkuId, quantity, options, deps,
  });
  for (const sku of product.ae_item_sku_info_dtos) {
    if (sku.sku_id === freightSkuId) {
      freightResolutions[sku.sku_id] = referenceResolution;
      continue;
    }
    const cachedCents = readFreightCache(productId, sku.sku_id);
    freightResolutions[sku.sku_id] = cachedCents !== null
      ? { providerShippingCents: cachedCents, cachedShippingCents: null,
          commercialShippingCents: null, failed: false }
      : referenceResolution;
  }
  const selectedResolution = freightResolutions[freightSkuId];
  if (!selectedResolution) throw new AliExpressDropshipError('INPUT');
  const freightBySkuId: Record<string, FreightPayload> = {};
  const cachedShippingUsdCentsBySkuId: Record<string, number> = {};
  const commercialShippingUsdCentsBySkuId: Record<string, number> = {};
  for (const [skuId, resolution] of Object.entries(freightResolutions)) {
    if (resolution.freight) freightBySkuId[skuId] = resolution.freight;
    if (resolution.cachedShippingCents !== null) cachedShippingUsdCentsBySkuId[skuId] = resolution.cachedShippingCents;
    if (resolution.commercialShippingCents !== null) commercialShippingUsdCentsBySkuId[skuId] = resolution.commercialShippingCents;
  }
  const freightMeta = { productId, skuId: freightSkuId, quantity,
    destinationCountry: options.countryCode ?? 'CL' };
  const finalCents = selectedResolution.providerShippingCents;
  const cachedFallbackCents = selectedResolution.cachedShippingCents;
  const commercialFallbackCents = selectedResolution.commercialShippingCents;
  logImport('resolver decidió', { ...freightMeta,
    finalCents: finalCents ?? cachedFallbackCents ?? commercialFallbackCents ?? null,
    finalDecision: finalCents !== null
      ? (finalCents === 0 ? 'SHIPPING_CONFIRMED_FREE' : 'SHIPPING_CONFIRMED')
      : cachedFallbackCents !== null ? 'SHIPPING_CACHED'
      : 'SHIPPING_COMMERCIAL_FALLBACK',
    reason: finalCents !== null ? 'QUOTE_FOUND'
      : cachedFallbackCents !== null ? 'RECENT_CACHED_QUOTE_REUSED'
      : 'NO_QUOTE_US10_COMMERCIAL_FALLBACK' });
  return buildImportPreview({
    product, freight: selectedResolution.freight, freightBySkuId, sourceUrl,
    aliexpressId: productId, marginPercent, fxValue: fxRate.value, fxSource: fxRate.source,
    cachedShippingUsdCents: finalCents === null ? cachedFallbackCents ?? undefined : undefined,
    cachedShippingUsdCentsBySkuId,
    commercialShippingUsdCents: finalCents === null && cachedFallbackCents === null
      && options.manualShippingUsd === undefined
      ? commercialFallbackCents ?? undefined : undefined,
    commercialShippingUsdCentsBySkuId,
    manualShippingUsd: options.manualShippingUsd,
    duplicateOfProductId, skuId: freightSkuId, quantity,
    shippingError: selectedResolution.failed,
  });
}
// ─── Category resolution (auto, no frontend input) ────────────────────────────
// Sources in order: AliExpress category_id → controlled keywords → General.
// AliExpress category_id → slug `ae-{category_id}` (stable, reutilizable).
// Keywords → predefined/allowed slugs only. No arbitrary slugs from titles.

type AEKeywordCategory = { slug: string; name: string; keywords: string[] };

const AE_KEYWORD_CATEGORIES: AEKeywordCategory[] = [
  { slug: 'electronics', name: 'Electrónica', keywords: ['electronic', 'phone', 'smartphone', 'mobile', 'charger', 'cable', 'headphone', 'earphone', 'speaker', 'tablet', 'laptop', 'computer', 'camera', 'camara', 'telephone', 'teléfono', 'battery', 'power bank', 'usb', 'adapter', 'screen', 'monitor', 'mouse', 'keyboard'] },
  { slug: 'fashion', name: 'Moda', keywords: ['shirt', 'pants', 'jeans', 'dress', 'robe', 'camiseta', 'polo', 'zapatos', 'zapato', 'zapatilla', 'shoes', 'shoe', 'sneaker', 'sandals', 'remeras', 'sudaderas', 'hoodie', 'chaqueta', 'jacket', 'calcetines', 'socks', 'skirt', 'falda', 'blouse', 'blusa', 'bermudas', 'short', 'shorts', 'vest', 'sueter', 'sweatshirt', 'mochila', 'bolso', 'gorra', 'cap'] },
  { slug: 'home', name: 'Hogar', keywords: ['casa', 'home', 'mesa', 'chair', 'silla', 'lamp', 'lámpara', 'bed', 'cama', 'sofa', 'sofá', 'decor', 'decoración', 'kitchen', 'cocina', 'bathroom', 'baño', 'curtain', 'cortina', 'rug', 'alfombra', 'pillow', 'almohada', 'frame', 'marco', 'organizer', 'organizador', 'shelf', 'estante'] },
  { slug: 'beauty', name: 'Belleza', keywords: ['beauty', 'makeup', 'maquillaje', 'skincare', 'crema', 'perfume', 'perfumería', 'cosmetic', 'cosmética', 'hair', 'cabello', 'shampoo', 'acondicionador', 'lipstick', 'labial', 'blush', 'bronceador', 'serum', 'mascarilla'] },
  { slug: 'toys', name: 'Juguetes', keywords: ['toy', 'juguete', 'juguetes', 'game', 'juego', 'juegos', 'puzzle', 'peluche', 'stuffed', 'doll', 'muñeca', 'action figure', 'figura', 'board game', 'rompecabezas'] },
  { slug: 'sports', name: 'Deportes', keywords: ['sports', 'sport', 'deporte', 'deportes', 'fitness', 'gym', 'yoga', 'exercise', 'ejercicio', 'bicycle', 'bicicleta', 'treadmill', 'elíptica', 'dumbbell', 'pesas', 'ball', 'balón', 'raqueta', 'chute', 'fútbol'] },
  { slug: 'office', name: 'Oficina', keywords: ['office', 'oficina', 'paper', 'papel', 'pen', 'bolígrafo', 'notebook', 'cuaderno', 'binder', 'carpeta', 'folder', 'desk', 'escritorio', 'stapler', 'clip', 'corrector', 'calculadora'] },
];

// Normalización: minúsculas + sin diacríticos ("Cámara" → "camara").
// Matching por palabra completa (\b) para evitar falsos positivos
// (ej: "phone" dentro de "xylophone").
function detectFriendlyCategory(title: string): AEKeywordCategory | null {
  const normalized = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchesKeyword = (kw: string) => {
    const norm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return new RegExp(`\\b${norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(normalized);
  };
  for (const cat of AE_KEYWORD_CATEGORIES) {
    if (cat.keywords.some(matchesKeyword)) return cat;
  }
  return null;
}

/** Nombre visible amigable para una categoría creada a partir de AliExpress
 * (categorías controladas/predefinidas existentes). `null` → usar `General`. */
export function detectFriendlyCategoryName(title: string): string | null {
  return detectFriendlyCategory(title)?.name ?? null;
}

async function resolveCategory(
  preview: ImportPreview,
  db: typeof prisma = prisma,
): Promise<string> {
  // 1) AliExpress category_id → slug `ae-{category_id}` (asociación estable,
  // reutilizable) PERO nombre visible amigable: nunca "AliExpress #ID".
  // Resolución del nombre: categorías controladas/predefinidas existentes
  // (keywords del título del producto) y, si no hay coincidencia, `General`.
  if (preview.categoryId) {
    const slug = `ae-${preview.categoryId}`;
    const existing = await db.category.findUnique({
      where: { slug },
      select: { id: true, name: true },
    }).catch(() => null);
    const friendlyName = detectFriendlyCategoryName(preview.name) ?? 'General';
    if (existing) {
      // Autocuración: categorías heredadas creadas como "AliExpress #...".
      if (/^AliExpress #/i.test(existing.name)) {
        await db.category.update({ where: { slug }, data: { name: friendlyName } });
      }
      return existing.id;
    }
    const category = await db.category.upsert({
      where: { slug },
      create: { name: friendlyName, slug },
      update: {},
      select: { id: true },
    });
    return category.id;
  }

  // 2) Keyword detection (solo categorías predefinidas/permitidas)
  const matched = detectFriendlyCategory(preview.name);
  if (matched) {
    const category = await db.category.upsert({
      where: { slug: matched.slug },
      create: { name: matched.name, slug: matched.slug },
      update: {},
      select: { id: true },
    });
    return category.id;
  }

  // 3) Fallback → General
  const general = await db.category.upsert({
    where: { slug: 'general' },
    create: { name: 'General', slug: 'general' },
    update: {},
    select: { id: true },
  });
  return general.id;
}



export interface PublishOptions {
  categoryId?: string;
  marginPercent?: number;
  publish?: boolean;
  preview: ImportPreview;
}

/** Creates the YesYes product (as DRAFT unless publish=true) from a validated preview. */
export async function publishAliExpressProduct(options: PublishOptions, db: typeof prisma = prisma) {
  const { preview, categoryId } = options;
  const marginPercent = marginSchema.parse(options.marginPercent ?? 100);
  if (preview.shippingUnknown || preview.customerShippingUsdCents === null) {
    throw new AliExpressDropshipError('SHIPPING_UNKNOWN');
  }
  // Precio nivel producto = minimo de los precios individuales de variantes.
  // Compatibilidad: previews legacy sin precio por variante usan el precio
  // unico del producto. Si alguna variante trae precio propio, todas deben
  // traerlo (evita copiar el precio principal a variantes sin precio).
  const hasAnyVariantPrice = preview.variants.some(variant => variant.salePriceClp !== null && variant.salePriceClp !== undefined);
  const variantPrices = preview.variants.length && hasAnyVariantPrice
    ? preview.variants.map(variant => variant.salePriceClp ?? null)
    : [preview.salePriceClp];
  if (variantPrices.some(price => price === null)) throw new AliExpressDropshipError('INPUT');
  const salePrice = Math.min(...variantPrices.filter((price): price is number => price !== null));
  const knownCostCents = preview.variants
    .map(variant => variant.costUsdCents)
    .filter((cost): cost is number => cost !== null);
  if (!knownCostCents.length && preview.costUsdCents === null) {
    throw new AliExpressDropshipError('INPUT');
  }
  const costUsd = (knownCostCents.length ? Math.min(...knownCostCents) : preview.costUsdCents!) / 100;
  const knownShippingCents = preview.variants
    .map(variant => variant.shippingUsdCents)
    .filter((shipping): shipping is number => shipping !== null);
  const supplierShippingCents = knownShippingCents.length
    ? Math.min(...knownShippingCents)
    : preview.supplierShippingCostUsdCents;
  const supplierShipUsd = supplierShippingCents === null ? null : supplierShippingCents / 100;
  // Resolver categoría automáticamente si no se proporcionó (frontend ya no lo envía)
  const resolvedCategoryId = categoryId ?? await resolveCategory(preview, db);
  const category = await db.category.findUnique({ where: { id: resolvedCategoryId }, select: { id: true } });
  if (!category) throw new AliExpressDropshipError('INPUT');
  const duplicate = preview.duplicateOfProductId ?? await findDuplicateProduct(preview.aliexpressId, db);
  if (duplicate) throw new AliExpressDropshipError('INPUT');
  return db.product.create({
    data: {
      name: preview.name, slug: slugify(preview.name, preview.aliexpressId),
      description: preview.description || preview.name,
       images: preview.images, video: preview.video ?? null, categoryId: resolvedCategoryId,
       tags: ['aliexpress'], supplier: 'ALIEXPRESS',
       supplierProductId: preview.aliexpressId, supplierUrl: preview.sourceUrl,
       aliexpressId: preview.aliexpressId, aliexpressUrl: preview.sourceUrl,
       importSource: 'ALIEXPRESS_DROPSHIP', sourcePlatform: 'ALIEXPRESS',
       sourceId: preview.aliexpressId, sourceUrl: preview.sourceUrl,
       stock: preview.totalStock ?? 0,
      productCost: costUsd,
      shippingCost: supplierShipUsd ?? 0,
      totalCost: costUsd + (supplierShipUsd ?? 0),
      salePrice, margin: marginPercent,
      weight: preview.weight ?? null,
      aliexpressMarginPercent: marginPercent,
      aliexpressShippingUsdCents: supplierShippingCents,
      aliexpressShippingUnknown: supplierShippingCents === null,
       aliexpressSnapshot: {
         ...(preview.raw as object),
         acquisition: preview.acquisition,
         shippingSource: preview.shippingSource,
         shippingStatus: preview.shippingStatus,
         yesYesShippingState: preview.yesYesShippingState,
         supplierProductCostUsdCents: preview.supplierProductCostUsdCents,
         supplierShippingCostUsdCents: supplierShippingCents,
         supplierAcquisitionCostUsdCents: preview.supplierAcquisitionCostUsdCents,
         productSalePriceUsd: preview.productSalePriceUsd,
         customerShippingUsdCents: preview.customerShippingUsdCents,
         customerTotalUsd: preview.customerTotalUsd,
         destination: preview.destination,
         fxRate: preview.fxRate,
         fxSource: preview.fxSource,
         variants: preview.variants,
         variantShippingUsdCents: Object.fromEntries(preview.variants.map(variant => [
           variant.supplierVariantId, variant.shippingUsdCents,
         ])),
         variantSalePriceClp: Object.fromEntries(preview.variants.map(variant => [
           variant.supplierVariantId, variant.salePriceClp,
         ])),
       } as object,
       status: options.publish ? 'PUBLISHED' : 'DRAFT',
       variants: preview.variants as unknown as object,
       productVariants: {
         create: preview.variants.map(variant => ({
           sku: `${preview.aliexpressId}-${variant.supplierVariantId}`,
           size: variant.attributes.find(a => /talla|size/i.test(a.name))?.value ?? null,
           color: variant.attributes.find(a => /colou?r/i.test(a.name))?.value ?? null,
           price: variant.salePriceClp ?? salePrice, stock: variant.stock ?? 0,
           supplierVariantId: variant.supplierVariantId,
           supplierAttributes: variant.attributes as object,
           supplierImage: variant.image ?? null,
           supplierCostUsd: variant.costUsd,
           supplierShippingUsd: variant.shippingUsd ?? supplierShipUsd,
           supplierStock: variant.stock,
           supplierStockKnown: variant.stockKnown,
         })),
       },
       productImages: {
         create: (preview.images || []).map((url: string, position: number) => ({
           url, position, alt: preview.name,
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
  // Margen del importador masivo: estricto 50–400% (predeterminado 50%). El resto
  // del sistema (import individual, sync) sigue usando marginSchema sin cambio.
  const marginPercent = z.number().int().min(50).max(400).safeParse(input.marginPercent ?? 50);
  if (!marginPercent.success) throw new AliExpressDropshipError('INPUT');
  return db.aliExpressImportJob.create({
    data: {
      marginPercent: marginPercent.data, categoryId: input.categoryId ?? null, createdBy: input.createdBy ?? null,
      total: urls.length, items: { create: urls.map(sourceUrl => ({ sourceUrl })) },
    },
    select: { id: true, total: true },
  });
}

const RATE_LIMIT_DELAY_MS = 700;
const MAX_ATTEMPTS = 3;

export interface ImportJobDeps {
  preview?: typeof previewAliExpressProduct;
  publish?: typeof publishAliExpressProduct;
  rateLimitMs?: number;
}

/**
 * Procesa EXACTAMENTE UN item del job (modelo serverless-safe: una request = un item).
 * Un fallo de item nunca detiene la cola; los fallos se reintentan hasta MAX_ATTEMPTS
 * con la misma semántica previa. Concurrency-safe: el claim PENDING → PROCESSING es
 * atómico, así dos steps concurrentes nunca procesan el mismo item dos veces.
 * Devuelve un snapshot de progreso para el driver del frontend; no queda ningún
 * worker vivo después de responder.
 */
export async function processNextImportJobItem(jobId: string, db: typeof prisma = prisma,
  deps: ImportJobDeps = {}): Promise<{
  jobId: string; itemId: string | null; processed: number; succeeded: number; failed: number;
  pending: number; processing: number; total: number; status: string; done: boolean;
}> {
  const previewFor = deps.preview ?? previewAliExpressProduct;
  const publishFor = deps.publish ?? publishAliExpressProduct;
  const rateLimitMs = deps.rateLimitMs ?? RATE_LIMIT_DELAY_MS;
  const job = await db.aliExpressImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AliExpressDropshipError('INPUT');

  const pendingFilter = { jobId, status: 'PENDING' as const, attempts: { lt: MAX_ATTEMPTS } };
  let pending = await db.aliExpressImportJobItem.count({ where: pendingFilter });
  if (pending === 0) {
    const processing = await db.aliExpressImportJobItem.count({ where: { jobId, status: 'PROCESSING' } });
    // Nada pendiente y nada en vuelo: cerrar el job (idempotente).
    if (processing === 0 && job.status !== 'DONE') {
      await db.aliExpressImportJob.update({ where: { id: jobId }, data: { status: 'DONE' } });
    }
    const done = processing === 0;
    return { jobId, itemId: null, processed: job.processed, succeeded: job.succeeded, failed: job.failed,
      pending: 0, processing, total: job.total, status: done ? 'DONE' : job.status, done };
  }

  // Marca el job como en proceso solo si hay trabajo real (evita jobs RUNNING eternos).
  if (job.status !== 'RUNNING') {
    await db.aliExpressImportJob.update({ where: { id: jobId }, data: { status: 'RUNNING' } });
  }

  const item = await db.aliExpressImportJobItem.findFirst({
    where: pendingFilter, orderBy: { createdAt: 'asc' },
  });
  if (!item) {
    return { jobId, itemId: null, processed: job.processed, succeeded: job.succeeded, failed: job.failed,
      pending, processing: 0, total: job.total, status: 'RUNNING', done: false };
  }
  // Claim atómico: solo un step puede llevar PENDING → PROCESSING.
  const claimed = await db.aliExpressImportJobItem.updateMany({
    where: { id: item.id, status: 'PENDING' }, data: { status: 'PROCESSING' },
  });
  if (claimed.count === 0) {
    // Otro worker/step lo tomó primero: devolver progreso sin procesar nada.
    return { jobId, itemId: null, processed: job.processed, succeeded: job.succeeded, failed: job.failed,
      pending, processing: 1, total: job.total, status: 'RUNNING', done: false };
  }
  let succeeded = job.succeeded, failed = job.failed;
  try {
    const preview = await previewFor(item.sourceUrl, { marginPercent: job.marginPercent });
    logImport('item de cola', { jobId, itemId: item.id, productId: preview.aliexpressId });
    if (preview.duplicateOfProductId) throw new AliExpressDropshipError('DUPLICATE');
    if (preview.shippingUnknown) throw new AliExpressDropshipError('SHIPPING_UNKNOWN');
    // Si el job no tiene categoryId, resolver por producto (reutiliza misma categoría
    // para productos con mismo category_id; keywords/general para el resto)
    const itemCategoryId = job.categoryId ?? await resolveCategory(preview, db);
    const product = await publishFor({
      preview, categoryId: itemCategoryId, marginPercent: job.marginPercent, publish: true,
    }, db);
    await db.aliExpressImportJobItem.update({
      where: { id: item.id },
      data: { status: 'DONE', aliexpressId: preview.aliexpressId, createdProductId: product.id, error: null },
    });
    succeeded += 1;
  } catch (error) {
    const failureReason = sanitizeImportError(error);
    logImport('item de cola falló', { jobId, itemId: item.id, error: failureReason });
    if (failureReason === 'DUPLICATE') {
      // Determinista: reintentar no cambia el resultado; fallar de inmediato
      // sin crear duplicados ni gastar llamadas al proveedor.
      await db.aliExpressImportJobItem.update({
        where: { id: item.id },
        data: { status: 'FAILED', attempts: MAX_ATTEMPTS, error: failureReason },
      });
      failed += 1;
    } else {
      const attempts = item.attempts + 1;
      const done = attempts >= MAX_ATTEMPTS;
      await db.aliExpressImportJobItem.updateMany({
        where: { id: item.id, status: 'PROCESSING' },
        data: { status: done ? 'FAILED' : 'PENDING', attempts, error: failureReason },
      });
      if (done) failed += 1;
    }
  }
  const processed = job.processed + 1;
  await db.aliExpressImportJob.update({ where: { id: jobId }, data: { processed, succeeded, failed } });
  // El pacing original se conserva dentro del step: limita la presión sobre la API.
  if (rateLimitMs > 0) await new Promise(resolve => setTimeout(resolve, rateLimitMs));

  pending = await db.aliExpressImportJobItem.count({ where: pendingFilter });
  const processing = await db.aliExpressImportJobItem.count({ where: { jobId, status: 'PROCESSING' } });
  const queueEmpty = pending === 0 && processing === 0;
  if (queueEmpty) {
    await db.aliExpressImportJob.update({ where: { id: jobId }, data: { status: 'DONE' } });
  }
  return { jobId, itemId: item.id, processed, succeeded, failed, pending, processing,
    total: job.total, status: queueEmpty ? 'DONE' : 'RUNNING', done: queueEmpty };
}

/**
 * Compatibilidad (dev local / tests): procesa la cola completa step a step.
 * En producción (Vercel serverless) el driver es el frontend vía
 * POST /dropship/import/jobs/:id/step; esta función ya NO se invoca
 * fire-and-forget desde las rutas.
 */
export async function processImportJob(jobId: string, db: typeof prisma = prisma,
  deps: ImportJobDeps = {}): Promise<void> {
  for (;;) {
    const step = await processNextImportJobItem(jobId, db, deps);
    if (step.done) break;
    if (!step.itemId) {
      // Otro worker reclamó el item; breve espera para no girar en vacío.
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

export async function retryImportJobItem(itemId: string, db: typeof prisma = prisma,
  deps: ImportJobDeps = {}) {
  const item = await db.aliExpressImportJobItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AliExpressDropshipError('INPUT');
  const updated = await db.aliExpressImportJobItem.update({
    where: { id: itemId }, data: { status: 'PENDING', attempts: 0, error: null },
    select: { id: true, status: true },
  });
  // Ya no se relanza ningún worker: el driver del frontend vuelve a llamar a
  // POST /dropship/import/jobs/:id/step para procesar el item reencolado
  // (los CLAIM atómicos evitan duplicar).
  return updated;
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
 * New YesYes nomenclature: SHIPPING_CONFIRMED_FREE / SHIPPING_CONFIRMED /
 * SHIPPING_UNKNOWN / SHIPPING_ERROR. Legacy AVAILABLE/FREE/PROVIDER_*
 * literals are still returned through normalizeShippingStatus compat where
 * old snapshots exist, but this resolver emits SHIPPING_* directly.
 * Retry: ds.freight.query up to 3 attempts (1s, 3s backoff), then
 * buyer.freight.calculate up to 3 attempts. No infinite loops. */
export async function resolveFreightCents(input: {
  productId: string; skuId: string; quantity: number; shipToCountry?: 'CL';
}, deps: Partial<PreviewDeps> = {}): Promise<{ cents: number | null; status: ShippingStatus }> {
  const meta = { productId: input.productId, skuId: input.skuId,
    quantity: input.quantity, destinationCountry: input.shipToCountry ?? 'CL' };
  const useRealRetry = !deps.freightQuery && !deps.buyerFreightCalculate;
  const fq = deps.freightQuery ?? ((freight: FreightQueryInput) => service.freightQuery(freight));
  const bfc = deps.buyerFreightCalculate ?? ((freight: BuyerFreightCalculateInput) => service.buyerFreightCalculate(freight));
  let transportError = false;
  const method1 = 'aliexpress.ds.freight.query' as const;
  const fqOutcome = useRealRetry
    ? await withFreightRetry(method1, () => fq({
        productId: input.productId, quantity: input.quantity,
        shipToCountry: input.shipToCountry ?? 'CL', selectedSkuId: input.skuId,
      }), meta)
    : await withFreightRetry(method1, () => fq({
        productId: input.productId, quantity: input.quantity,
        shipToCountry: input.shipToCountry ?? 'CL', selectedSkuId: input.skuId,
      }), meta, []);
  if (!fqOutcome.failed) {
    const cents = cheapestFreightCents(fqOutcome.value!.delivery_options);
    logImport('parser de aliexpress.ds.freight.query', { ...meta,
      deliveryOptions: fqOutcome.value!.delivery_options?.length ?? 0,
      parsedCents: cents });
    if (cents !== null) return { cents, status: cents === 0 ? 'SHIPPING_CONFIRMED_FREE' : 'SHIPPING_CONFIRMED' };
  } else {
    transportError = true;
  }
  const method2 = 'aliexpress.logistics.buyer.freight.calculate' as const;
  const bfcOutcome = useRealRetry
    ? await withFreightRetry(method2, () => bfc({
        product_id: input.productId, product_num: input.quantity, sku_id: input.skuId,
      }), meta)
    : await withFreightRetry(method2, () => bfc({
        product_id: input.productId, product_num: input.quantity, sku_id: input.skuId,
      }), meta, []);
  if (bfcOutcome.failed) {
    // Both APIs failed → temporal provider error (never a silent $0).
    // La cadena completa (caché + fallback US$10) la aplica el preview;
    // aquí se reporta el estado real del proveedor.
    return { cents: null, status: 'SHIPPING_ERROR' };
  }
  {
    const result = bfcOutcome.value!;
    const options = (result.aeop_freight_calculate_result_for_buyer_d_t_o_list || [])
      .map(option => {
        const cent = typeof option.freight?.cent === 'number'
          ? option.freight.cent : parseAmountToCents(option.freight?.amount);
        return cent === null ? null : {
          free_shipping: cent === 0 ? 'true' : 'false', shipping_fee_cent: String(cent),
        };
      }).filter((o): o is { free_shipping: string; shipping_fee_cent: string } => o !== null);
    const cents = cheapestFreightCents(options as never);
    logImport('parser de aliexpress.logistics.buyer.freight.calculate', { ...meta,
      deliveryOptions: options.length, parsedCents: cents,
      resolverDecision: cents !== null
        ? (cents === 0 ? 'SHIPPING_CONFIRMED_FREE' : 'SHIPPING_CONFIRMED')
        : (transportError ? 'SHIPPING_ERROR_CANDIDATE' : 'SHIPPING_UNKNOWN_CANDIDATE') });
    if (cents !== null) return { cents, status: cents === 0 ? 'SHIPPING_CONFIRMED_FREE' : 'SHIPPING_CONFIRMED' };
    // APIs answered but gave no option for this variant/destination.
    // A transport error on method 1 + valid empty on method 2 is still
    // SHIPPING_UNKNOWN (real "no quote"), not SHIPPING_ERROR.
    return { cents: null, status: 'SHIPPING_UNKNOWN' };
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
      // Freight unknown/failed reuses the stored quote ONLY when it was really
      // reported by AliExpress before (never invents a number, never reuses the
      // US$10 commercial fallback as supplier cost).
      cachedShippingUsdCents: freight.cents === null && currentShippingCents !== null
        ? currentShippingCents : undefined,
    });
    // Costo PROVEEDOR = envío confirmado por AliExpress (o caché válida). El
    // respaldo comercial US$10 jamás se persiste como shippingCost/totalCost.
    const supplierShippingCents = preview.supplierShippingCostUsdCents;
    const syncShippingStatus = supplierShippingCents !== null
      ? preview.shippingStatus : freight.status;
    const costAfter = preview.costUsdCents === null ? null : preview.costUsdCents / 100;
    const stockAfter = preview.totalStock;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (costAfter !== null && costAfter !== product.productCost) {
      changes.cost = { before: product.productCost, after: costAfter };
    }
    if (stockAfter !== null && stockAfter !== product.stock) {
      changes.stock = { before: product.stock, after: stockAfter };
    }
    if (supplierShippingCents !== null && supplierShippingCents !== currentShippingCents) {
      changes.shipping = { before: currentShippingCents, after: supplierShippingCents };
    }
    const shouldUpdateSalePrice = (input.updateSalePrice ?? true) && preview.salePriceClp !== null;
    const variantSalePrices = preview.variants.map(variant => variant.salePriceClp).filter((price): price is number => price !== null);
    const minSalePriceClp = variantSalePrices.length ? Math.min(...variantSalePrices) : preview.salePriceClp;
    const previousStatus = product.status;
    let nextStatus = previousStatus;
    if (stockAfter === 0) nextStatus = 'OUT_OF_STOCK';
    else if (previousStatus === 'OUT_OF_STOCK') nextStatus = 'PUBLISHED';
    if (nextStatus !== previousStatus) changes.availability = { before: previousStatus, after: nextStatus };

    await db.product.update({
      where: { id: product.id },
      data: {
        ...(costAfter !== null ? { productCost: costAfter } : {}),
        ...(costAfter !== null && supplierShippingCents !== null
          ? { shippingCost: supplierShippingCents / 100, totalCost: costAfter + supplierShippingCents / 100 } : {}),
        ...(stockAfter !== null ? { stock: stockAfter } : {}),
        ...(shouldUpdateSalePrice && minSalePriceClp ? { salePrice: minSalePriceClp } : {}),
        ...(supplierShippingCents !== null ? { aliexpressShippingUsdCents: supplierShippingCents } : {}),
        aliexpressShippingUnknown: supplierShippingCents === null,
        aliexpressSyncedAt: new Date(),
        ...(nextStatus !== previousStatus ? { status: nextStatus } : {}),
      },
    });
    // Per-SKU stock/cost/shipping/price: cada variante se sincroniza
    // individualmente con su propio costo, su propio envio y su propio
    // precio de venta (mismo margen del producto). El envio comun
    // confirmado solo se usa como respaldo cuando la variante no trae
    // el suyo. No se toca el calculo de envio.
    for (const variant of preview.variants) {
      const hasStock = variant.stockKnown;
      const hasCost = variant.costUsd !== null;
      const variantShipping = variant.shippingUsd ?? (supplierShippingCents !== null ? supplierShippingCents / 100 : null);
      const hasShipping = variantShipping !== null;
      const hasPrice = shouldUpdateSalePrice && variant.salePriceClp !== null && variant.salePriceClp !== undefined;
      if (!hasStock && !hasCost && !hasShipping && !hasPrice) continue;
      const updateVariant = (db.productVariant && (db.productVariant as unknown as { updateMany: unknown }).updateMany)
        ? ((where: object, data: object) => (db.productVariant as unknown as { updateMany: (args: object) => Promise<unknown> }).updateMany({ where: where as never, data: data as never }))
        : null;
      if (!updateVariant) continue;
      await updateVariant(
        { productId: product.id, supplierVariantId: variant.supplierVariantId },
        {
          ...(hasStock ? { stock: variant.stock ?? 0, supplierStock: variant.stock, supplierStockKnown: true } : {}),
          ...(hasCost ? { supplierCostUsd: variant.costUsd } : {}),
          ...(hasShipping ? { supplierShippingUsd: variantShipping } : {}),
          ...(hasPrice ? { price: variant.salePriceClp } : {}),
        },
      );
    }
    await db.aliExpressSyncLog.create({
      data: { productId: product.id, aliexpressId, skuId: freightSkuId,
        status: Object.keys(changes).length ? 'CHANGED' : 'UNCHANGED',
        costBeforeUsd: product.productCost, costAfterUsd: costAfter,
        stockBefore: product.stock, stockAfter,
        shippingBeforeUsdCents: currentShippingCents, shippingAfterUsdCents: supplierShippingCents,
        shippingStatus: syncShippingStatus,
        changes: changes as object },
    });
    return {
      productId: product.id, aliexpressId, changed: Object.keys(changes),
      shippingStatus: syncShippingStatus,
      shippingUnknown: supplierShippingCents === null,
      priceChanged: Boolean(changes.cost), salePriceClp: preview.salePriceClp,
    };
  } catch (error) {
    await db.aliExpressSyncLog.create({
      data: { productId: product.id, aliexpressId, status: 'ERROR',
        shippingStatus: 'SHIPPING_ERROR', error: sanitizeImportError(error) },
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

