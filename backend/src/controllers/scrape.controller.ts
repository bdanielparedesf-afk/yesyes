import { Request, Response } from 'express';
import {
  resolveCJProductFromUrl,
  parseCJImages,
  extractShippingCost,
  extractCJStock,
  autoCategory,
  mapCJVariant,
  getDollarRate,
  resolveCategory,
  MARGIN_MULTIPLIER,
} from './cj.controller';
import { detectCollection, translateToChileanSpanish } from '../lib/cj';
import { prisma } from '../lib/prisma';

// FASE 4A/4C — Importación masiva CJ (hasta 30-50 links). Solo CJ.
const MAX_BULK_LINKS = 30;
const MAX_BULK_PREVIEW_LINKS = 50;
const MAX_IMAGES_PER_PRODUCT = 5;

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

interface BulkRowResult {
  index: number;
  url: string;
  ok: boolean;
  productId?: string;
  name?: string;
  price?: number;
  error?: string;
}

/**
 * FASE 4C — Preview masivo CJ SIN crear productos.
 * Body: { links: string[], categorySlugs?: string[] }  (categorySlug opcional por fila)
 *
 * Reutiliza la lógica de FASE 4A (resolución CJ, traducción, USD->CLP x2),
 * pero NO escribe nada en la BD. Devuelve por cada link:
 *   { link, sourceId, titleEs, costUsd, priceClp, images[5], category, status, error? }
 */
export const bulkPreviewCJ = async (req: Request, res: Response): Promise<void> => {
  try {
    const { links, categorySlugs } = req.body || {};
    const list: { url: string; category?: string }[] = [];
    if (Array.isArray(links)) {
      links.forEach((l: any, i: number) => {
        const url = String(l?.link ?? l ?? '').trim();
        if (!url) return;
        const cat = Array.isArray(categorySlugs)
          ? String(categorySlugs[i] ?? '').trim()
          : String(l?.category ?? '').trim();
        list.push({ url, category: cat || undefined });
      });
    }
    if (!list.length) {
      res.status(400).json({ message: 'Envía al menos un link en el array "links".' });
      return;
    }
    if (list.length > MAX_BULK_PREVIEW_LINKS) list.length = MAX_BULK_PREVIEW_LINKS;

    const dollarRate = await getDollarRate();
    const results: any[] = [];

    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (!row) continue;
      const { url, category } = row;
      try {
        const resolved = await resolveCJProductFromUrl(url);
        if (!resolved) {
          results.push({ link: url, status: 'Error', error: 'CJ no encontró el producto con ese link' });
          continue;
        }
        const { cjData, pid } = resolved;

        const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
        const description = cjData.description || '';
        const images = parseCJImages(cjData).slice(0, MAX_IMAGES_PER_PRODUCT);
        const cjPrice = parseFloat(cjData.price || cjData.sellPrice || '0') || 0;
        const shippingCost = extractShippingCost(cjData, cjPrice);
        const totalCost = cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);
        const priceClp = roundToTen(totalCost * MARGIN_MULTIPLIER * dollarRate);
        const autoCat = category?.trim() || autoCategory(cjData);

        results.push({
          link: url,
          sourceId: String(pid),
          titleEs: translateToChileanSpanish(productNameEn),
          description,
          costUsd: Number(totalCost.toFixed(2)),
          priceClp,
          images,
          category: autoCat,
          status: 'OK',
        });
      } catch (rowError: any) {
        console.error(`[scrape/cj/bulk-preview] error en link ${i + 1}:`, rowError?.message || rowError);
        results.push({ link: url, status: 'Error', error: rowError?.message || 'Error desconocido' });
      }
    }

    res.json({ total: list.length, dollarRate, results });
  } catch (error: any) {
    console.error('Error in bulk CJ preview:', error);
    res.status(500).json({ message: 'Error en la vista previa masiva CJ', error: error.message });
  }
};

/**
 * POST /api/scrape/cj/bulk
 * Body: { links: string[], collectionSlug?: string, margin?: number }
 * Procesa cada link de CJ (uno por línea desde el admin) y crea el producto con:
 *  - sourceUrl (link pegado por el admin), sourcePlatform 'CJ', sourceId (pid de CJ)
 *  - costUsd (costo total en USD) y lastCheckedAt (fecha del chequeo)
 *  - máximo 5 fotos (parseCJImages(...).slice(0, 5))
 *
 * Un link fallido NO aborta el lote: devuelve una fila OK/Error por link.
 */
export const bulkImportCJ = async (req: Request, res: Response): Promise<void> => {
  try {
    const { links, collectionSlug, margin } = req.body || {};
    const list: string[] = Array.isArray(links)
      ? links.map((l: any) => String(l ?? '').trim()).filter(Boolean)
      : [];
    if (!list.length) {
      res.status(400).json({ message: 'Envía al menos un link en el array "links".' });
      return;
    }

    const marginMultiplier = Number(margin) > 0 ? Number(margin) : MARGIN_MULTIPLIER;
    const dollarRate = await getDollarRate();
    const results: BulkRowResult[] = [];

    for (let i = 0; i < list.length && i < MAX_BULK_LINKS; i++) {
      const rawUrl = list[i];
      if (!rawUrl) continue;
      try {
        const resolved = await resolveCJProductFromUrl(rawUrl);
        if (!resolved) {
          results.push({ index: i + 1, url: rawUrl, ok: false, error: 'CJ no encontró el producto con ese link' });
          continue;
        }
        const { cjData, pid } = resolved;

        // Duplicado: el producto CJ ya fue importado (por pid)
        const existing = await prisma.product.findFirst({ where: { cjProductId: String(pid) } });
        if (existing) {
          results.push({
            index: i + 1,
            url: rawUrl,
            ok: false,
            productId: existing.id,
            name: existing.name,
            error: 'Duplicado: este producto CJ ya fue importado',
          });
          continue;
        }

        const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
        const description = cjData.description || '';
        const cjImages = parseCJImages(cjData).slice(0, MAX_IMAGES_PER_PRODUCT);
        const variants = cjData.variants || [];
        const cjPrice = parseFloat(cjData.price || cjData.sellPrice || '0') || 0;
        const shippingCost = extractShippingCost(cjData, cjPrice);
        const totalCost = cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);
        const cjStock = extractCJStock(cjData);
        const stock = cjStock > 0 ? cjStock : 100;
        const cjWeight = parseFloat(cjData.packingWeight || cjData.productWeight || '0') || undefined;

        const finalTitle = translateToChileanSpanish(productNameEn);
        const finalDescription = description;

        const costTotalUSD = totalCost;
        const costTotalCLP = costTotalUSD * dollarRate;
        const precioFinalUSD = costTotalUSD * marginMultiplier;
        const precioFinalCLP = roundToTen(precioFinalUSD * dollarRate);

        const categorySlug = autoCategory(cjData);
        const finalCollectionSlug: string =
          (collectionSlug && String(collectionSlug).trim()) || detectCollection(finalTitle, finalDescription);
        const category = await resolveCategory(categorySlug);
        const collection = await prisma.collection.findUnique({ where: { slug: finalCollectionSlug } });
        const collectionId =
          collection?.id ??
          (
            await prisma.collection.create({
              data: {
                name: finalCollectionSlug
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' '),
                slug: finalCollectionSlug,
              },
            })
          ).id;

        const slug = `${finalTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${Date.now()}-${i}`.slice(0, 100);

        const product = await prisma.product.create({
          data: {
            name: finalTitle,
            slug,
            description: finalDescription,
            images: cjImages,
            tags: [finalCollectionSlug],
            categoryId: category.id,
            salePrice: precioFinalCLP,
            margin:
              precioFinalCLP > 0
                ? parseFloat((((precioFinalCLP - costTotalCLP) / precioFinalCLP) * 100).toFixed(2))
                : 0,
            totalCost,
            productCost: cjPrice,
            shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
            stock,
            weight: cjWeight,
            status: 'PUBLISHED',
            importSource: 'CJ_DROPSHIPPING',
            cjProductId: String(pid),
            cjVariants: variants,
            variants: [],
            collectionId,
            // FASE 4A: trazabilidad de fuente
            sourceUrl: rawUrl,
            sourcePlatform: 'CJ',
            sourceId: String(pid),
            costUsd: Number.isFinite(totalCost) ? totalCost : null,
            lastCheckedAt: new Date(),
            productImages: {
              create: cjImages.map((imgUrl, imgIndex) => ({ url: imgUrl, position: imgIndex })),
            },
            productVariants: {
              create: variants.map((v: any) => mapCJVariant(v, cjPrice)),
            },
          },
          include: { productImages: true, collection: true },
        });

        results.push({
          index: i + 1,
          url: rawUrl,
          ok: true,
          productId: product.id,
          name: product.name,
          price: precioFinalCLP,
        });
      } catch (rowError: any) {
        console.error(`[scrape/cj/bulk] error en link ${i + 1}:`, rowError?.message || rowError);
        results.push({ index: i + 1, url: rawUrl, ok: false, error: rowError?.message || 'Error desconocido' });
      }
    }

    const imported = results.filter((r) => r.ok).length;
    res.json({
      total: list.length,
      imported,
      failed: results.length - imported,
      dollarRate,
      results,
    });
  } catch (error: any) {
    console.error('Error in bulk CJ import:', error);
    res.status(500).json({ message: 'Error en la importación masiva CJ', error: error.message });
  }
};