/**
 * FASE 5 — Sync de precios CJ (CRON).
 *
 * Recorre productos con sourceUrl != null y sourcePlatform = 'CJ',
 * re-scrapea el costo actual en CJ y compara con el costo guardado (costUsd).
 *  - Si CJ ya no responde (producto no existe): alert="LINK NO DISPONIBLE", alertLevel=danger
 *  - Si el costo cambió más del 10%: alert="PRECIO CAMBIÓ Antes $X ahora $Y", alertLevel=warning
 *  - Actualiza lastCheckedAt en cada pasada y limpia hasAlert cuando vuelve a estar OK.
 */
import { prisma } from '../lib/prisma';
import { resolveCJProductFromUrl, extractCJPrice } from '../controllers/cj.controller';
import { getCJFreight } from '../lib/cj';

const THRESHOLD_PCT = 0.1;

interface SyncResult {
  total: number;
  scanned: number;
  withAlert: number;
  failed: number;
  updatedAt: string;
  alerts: { id: string; name: string; alert: string }[];
}

export async function runPriceSync(): Promise<SyncResult> {
  const result: SyncResult = { total: 0, scanned: 0, withAlert: 0, failed: 0, updatedAt: new Date().toISOString(), alerts: [] };

  try {
    const products = await prisma.product.findMany({
      where: { sourceUrl: { not: null }, sourcePlatform: 'CJ' },
      select: {
        id: true, name: true, sourceUrl: true, sourceId: true, costUsd: true, cjProductId: true,
        hasAlert: true, alert: true,
      },
    });
    result.total = products.length;

    for (const product of products) {
      result.scanned++;
      try {
        const resolved = await resolveCJProductFromUrl(String(product.sourceUrl));
        if (!resolved) {
          // Link muerto: CJ ya no devuelve el producto.
          await prisma.product.update({
            where: { id: product.id },
            data: {
              hasAlert: true,
              alert: 'LINK NO DISPONIBLE',
              alertLevel: 'danger',
              lastCheckedAt: new Date(),
            },
          });
          if (!product.hasAlert || product.alert !== 'LINK NO DISPONIBLE') {
            result.alerts.push({ id: product.id, name: product.name, alert: 'LINK NO DISPONIBLE' });
          }
          result.withAlert++;
          continue;
        }

        const { cjData, pid } = resolved;
        const cjPrice = extractCJPrice(cjData);
        const variants = Array.isArray(cjData?.variants) ? cjData.variants : [];

        // Obtener freight real por la primera variante (para el cálculo del costo total)
        let shippingCost = 0;
        if (variants.length > 0) {
          const firstVariant = variants[0];
          const firstVid = String(firstVariant?.vid || firstVariant?.variantId || '').trim();
          if (firstVid) {
            try {
              shippingCost = await getCJFreight(pid, { vid: firstVid, country: 'CL' });
            } catch (err: any) {
              console.warn(`[priceSync] freight pid:${pid} vid:${firstVid} fallo:`, err?.message ?? err);
              shippingCost = 0;
            }
          }
        }

        const newCostUsd = cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);

        // Quantificar cambio vs. costo guardado (costUsd) asumiendo que la primera
        // pasada graba costUsd y las siguientes comparan contra ese valor.
        const oldCostUsd = Number(product.costUsd ?? 0);
        let changed = false;
        let alertText = '';

        if (Number.isFinite(oldCostUsd) && oldCostUsd > 0) {
          const delta = Math.abs(newCostUsd - oldCostUsd) / oldCostUsd;
          if (delta > THRESHOLD_PCT) {
            changed = true;
            alertText = `PRECIO CAMBIÓ Antes $${oldCostUsd.toFixed(2)} ahora $${newCostUsd.toFixed(2)}`;
          }
        }

        await prisma.product.update({
          where: { id: product.id },
          data: {
            costUsd: Number.isFinite(newCostUsd) ? Number(newCostUsd.toFixed(2)) : product.costUsd,
            lastCheckedAt: new Date(),
            ...(changed
              ? { hasAlert: true, alert: alertText, alertLevel: 'warning' }
              : { hasAlert: false, alert: null, alertLevel: 'info' }),
          },
        });

        if (changed) {
          if (!product.hasAlert || product.alert !== alertText) {
            result.alerts.push({ id: product.id, name: product.name, alert: alertText });
          }
          result.withAlert++;
        }
      } catch (err: any) {
        console.warn(`[priceSync] fallo con producto ${product.id}:`, err?.message || err);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            hasAlert: true,
            alert: `ERROR SYNC: ${String(err?.message || 'desconocido').slice(0, 120)}`,
            alertLevel: 'danger',
            lastCheckedAt: new Date(),
          },
        });
        result.failed++;
      }
    }
  } catch (error: any) {
    console.error('[priceSync] error general:', error?.message || error);
    throw error;
  }

  return result;
}