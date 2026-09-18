/**
 * AliExpress → Sync Engine → YesYes.
 *
 * - Singleton settings in aliexpress_sync_settings (interval, policies, batch).
 * - runAliExpressSync: batched, sequential, checkpointed (lastCursor), with
 *   retry + backoff per product and per-product error isolation.
 * - syncStats: admin dashboard counters from aliexpress_sync_logs.
 * - validateAliExpressProductForOrder: stale-price protection at purchase time
 *   (AUTO_UPDATE | REQUIRE_REVIEW | BLOCK_ORDER).
 * No secrets are ever stored or logged here.
 */
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  AliExpressDropshipError, syncAliExpressProduct, resolveFreightCents,
  findAliExpressProductForSync, ShippingStatus, MARGIN_PRESETS,
} from './aliexpress-dropship.service';
import service from './aliexpress-dropship.service';

export const SYNC_INTERVALS = [30, 60, 360, 720, 1440] as const;
export const STALE_PRICE_POLICIES = ['AUTO_UPDATE', 'REQUIRE_REVIEW', 'BLOCK_ORDER'] as const;
export const NO_QUOTE_POLICIES = ['BLOCK', 'PUBLISH_WITHOUT_PRICE', 'USE_ALTERNATIVE'] as const;
export type StalePricePolicy = (typeof STALE_PRICE_POLICIES)[number];

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().refine(v => (SYNC_INTERVALS as readonly number[]).includes(v),
    { message: `intervalo permitido: ${SYNC_INTERVALS.join(', ')} minutos` }).optional(),
  stalePricePolicy: z.enum(STALE_PRICE_POLICIES).optional(),
  noQuotePolicy: z.enum(NO_QUOTE_POLICIES).optional(),
  batchSize: z.number().int().min(1).max(50).optional(),
});

export async function getSyncSettings(db: typeof prisma = prisma) {
  const row = await db.aliExpressSyncSettings.findUnique({ where: { id: 'singleton' } });
  if (row) return row;
  return db.aliExpressSyncSettings.create({ data: { id: 'singleton' } });
}

export async function updateSyncSettings(input: unknown, db: typeof prisma = prisma) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success || !parsed.data) throw new AliExpressDropshipError('INPUT');
  await getSyncSettings(db);
  return db.aliExpressSyncSettings.update({ where: { id: 'singleton' }, data: parsed.data });
}

/** Computes the next scheduled run from the stored interval. */
export function nextRunFrom(settings: { enabled: boolean; intervalMinutes: number; lastRunAt: Date | null }): Date | null {
  if (!settings.enabled || !settings.lastRunAt) return null;
  return new Date(settings.lastRunAt.getTime() + settings.intervalMinutes * 60_000);
}

const RETRY_BACKOFF_MS = [1000, 4000, 16000];
const SYNC_DELAY_MS = 700; // rate-limit friendly pacing between products

/** One product with per-product retry/backoff; errors never stop the run. */
async function syncOneWithRetry(productId: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await syncAliExpressProduct({ productId });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
    }
  }
  throw lastError;
}

export interface SyncRunResult {
  processed: number; changed: number; errors: number;
  priceChanges: number; stockChanges: number; shippingUnknown: number;
}

/**
 * Batched full sync of every imported AliExpress product. Sequential batches
 * with a checkpoint cursor so long runs resume where they stopped.
 */
export async function runAliExpressSync(input: { limit?: number } = {},
  db: typeof prisma = prisma): Promise<SyncRunResult> {
  const settings = await getSyncSettings(db);
  const total = input.limit ?? settings.batchSize * 10;
  const result: SyncRunResult = { processed: 0, changed: 0, errors: 0, priceChanges: 0, stockChanges: 0, shippingUnknown: 0 };
  let cursor = settings.lastCursor ?? '';
  for (;;) {
    const batch = await db.product.findMany({
      where: { aliexpressId: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: Math.min(settings.batchSize, total - result.processed),
      select: { id: true },
    });
    if (!batch.length) break;
    for (const { id } of batch) {
      try {
        const outcome = await syncOneWithRetry(id) as { changed?: string[]; shippingUnknown?: boolean };
        result.processed += 1;
        if (Array.isArray(outcome?.changed) && outcome.changed.length) {
          result.changed += 1;
          if (outcome.changed.includes('cost')) result.priceChanges += 1;
          if (outcome.changed.includes('stock')) result.stockChanges += 1;
        }
        if (outcome?.shippingUnknown) result.shippingUnknown += 1;
      } catch (error) {
        result.processed += 1;
        result.errors += 1;
        console.warn('[aliexpress-sync] producto falló tras reintentos', {
          productId: id, error: error instanceof AliExpressDropshipError ? error.reason : 'UNKNOWN',
        });
      }
      cursor = id;
      await db.aliExpressSyncSettings.update({ where: { id: 'singleton' }, data: { lastCursor: cursor } });
      await new Promise(r => setTimeout(r, SYNC_DELAY_MS));
      if (result.processed >= total) break;
    }
    if (result.processed >= total) break;
  }
  await db.aliExpressSyncSettings.update({
    where: { id: 'singleton' }, data: { lastRunAt: new Date() },
  });
  return result;
}

/** Dashboard counters: last/next sync, changes, errors, products without freight quote. */
export async function syncStats(db: typeof prisma = prisma) {
  const settings = await getSyncSettings(db);
  const since = settings.lastRunAt ?? new Date(0);
  const [affectedProducts, errors, noShippingQuote, totalImported] = await Promise.all([
    db.aliExpressSyncLog.count({ where: { createdAt: { gte: since }, status: 'CHANGED' } }),
    db.aliExpressSyncLog.count({ where: { createdAt: { gte: since }, status: 'ERROR' } }),
    db.product.count({ where: { aliexpressId: { not: null }, aliexpressShippingUnknown: true } }),
    db.product.count({ where: { aliexpressId: { not: null } } }),
  ]);
  const counters = await recentChangeCounters(db, since);
  return {
    settings, lastRunAt: settings.lastRunAt, nextRunAt: nextRunFrom(settings),
    affectedProducts, errors, noShippingQuote, totalImported,
    priceChanges: counters.priceChanges, stockChanges: counters.stockChanges,
  };
}

async function recentChangeCounters(db: typeof prisma, since: Date) {
  const rows = await db.aliExpressSyncLog.findMany({
    where: { createdAt: { gte: since }, status: 'CHANGED' },
    select: { changes: true }, take: 500, orderBy: { createdAt: 'desc' },
  });
  let priceChanges = 0, stockChanges = 0;
  for (const row of rows) {
    const changes = row.changes as Record<string, unknown> | null;
    if (changes?.cost) priceChanges += 1;
    if (changes?.stock) stockChanges += 1;
  }
  return { priceChanges, stockChanges };
}

/** Recent sync history across products for the admin "Ver historial" panel. */
export async function recentSyncLogs(db: typeof prisma = prisma, take = 50) {
  return db.aliExpressSyncLog.findMany({
    orderBy: { createdAt: 'desc' }, take,
    select: { id: true, productId: true, aliexpressId: true, skuId: true, status: true,
      costBeforeUsd: true, costAfterUsd: true, stockBefore: true, stockAfter: true,
      shippingBeforeUsdCents: true, shippingAfterUsdCents: true, shippingStatus: true,
      changes: true, error: true, createdAt: true },
  });
}

export interface OrderPriceValidation {
  policy: StalePricePolicy;
  decision: 'ALLOW' | 'BLOCK' | 'REVIEW';
  priceChanged: boolean;
  previousCostUsd: number | null;
  currentCostUsd: number | null;
  shippingStatus: ShippingStatus;
  message: string;
}

/**
 * Pre-purchase validation: re-queries the provider price/freight for one
 * imported product and applies the configured stale-price policy.
 */
export async function validateAliExpressProductForOrder(input: {
  productId: string; quantity?: number;
}, db: typeof prisma = prisma): Promise<OrderPriceValidation> {
  const settings = await getSyncSettings(db);
  const policy = (settings.stalePricePolicy as StalePricePolicy) ?? 'AUTO_UPDATE';
  const { product, aliexpressId } = await findAliExpressProductForSync(input.productId, db);
  const snapshot = (product.aliexpressSnapshot && typeof product.aliexpressSnapshot === 'object'
    ? product.aliexpressSnapshot : {}) as Record<string, unknown>;
  const skuId = (typeof snapshot.selectedSkuId === 'string' && snapshot.selectedSkuId) || null;
  const [freight, current] = await Promise.all([
    skuId ? resolveFreightCents({ productId: aliexpressId, skuId, quantity: input.quantity ?? 1 })
      : Promise.resolve({ cents: null as number | null, status: 'PROVIDER_ERROR' as ShippingStatus }),
    currentProviderCost(aliexpressId),
  ]);
  const currentCostUsd = current.currentCostUsd;
  const previousCostUsd = product.productCost ?? null;
  const priceChanged = currentCostUsd !== null && previousCostUsd !== null && currentCostUsd !== previousCostUsd;
  const noQuote = freight.cents === null || currentCostUsd === null;
  const decision: OrderPriceValidation['decision'] = noQuote
    ? (settings.noQuotePolicy === 'BLOCK' ? 'BLOCK' : 'ALLOW')
    : !priceChanged ? 'ALLOW'
      : policy === 'BLOCK_ORDER' ? 'BLOCK'
        : policy === 'REQUIRE_REVIEW' ? 'REVIEW' : 'ALLOW';
  if (decision === 'ALLOW' && priceChanged) {
    // AUTO_UPDATE: refresh provider data + recalculate prices; the change is
    // recorded in the sync log with previous/new values.
    await syncAliExpressProduct({ productId: input.productId }, db);
  }
  return {
    policy, decision, priceChanged, previousCostUsd, currentCostUsd,
    shippingStatus: freight.status,
    message: decision === 'ALLOW'
      ? (priceChanged ? 'Precio del proveedor actualizado automáticamente.' : 'Precio del proveedor válido.')
      : decision === 'BLOCK' ? 'Compra bloqueada: costo del proveedor no confiable.' : 'Requiere revisión del administrador.',
  };
}

async function currentProviderCost(aliexpressId: string): Promise<{ currentCostUsd: number | null }> {
  try {
    const wholesale = await service.productWholesaleGet(aliexpressId);
    const price = wholesale.ae_item_sku_info_dtos[0]?.sku_price;
    const value = typeof price === 'string' ? Number(price) : typeof price === 'number' ? price : NaN;
    return { currentCostUsd: Number.isFinite(value) && value > 0 ? value : null };
  } catch { return { currentCostUsd: null }; }
}




