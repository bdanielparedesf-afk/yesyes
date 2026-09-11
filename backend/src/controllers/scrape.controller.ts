import { Request, Response } from 'express';
import {
  resolveCJProductFromUrl,
  parseCJImages,
  extractShippingCost,
  extractCJStock,
  autoCategory,
  mapCJVariant,
  getDollarRate,
  detectCategory,
  resolveMainSubCategory,
  MARGIN_MULTIPLIER,
  calculateFinalPrice,
} from './cj.controller';
import { detectCollection, translateToChileanSpanish, translateDescriptionToSpanish } from '../lib/cj';
import { prisma } from '../lib/prisma';

// FASE 4A/4C — Importación masiva CJ (hasta 30-50 links). Solo CJ.
const MAX_BULK_LINKS = 30;
const MAX_BULK_PREVIEW_LINKS = 50;
const MAX_IMAGES_PER_PRODUCT = 5;

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
    const { links, categorySlugs, margin } = req.body || {};
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

    const marginMultiplier = Number(margin) > 0 ? Number(margin) : MARGIN_MULTIPLIER;
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
        // Usa la misma función que los importadores (single y bulk)
        const { precioFinalCLP: priceClp } = calculateFinalPrice(totalCost, marginMultiplier, dollarRate);
        const autoCat = category?.trim() || autoCategory(cjData);

        results.push({
          link: url,
          sourceId: String(pid),
          titleEs: translateToChileanSpanish(productNameEn),
          description: translateDescriptionToSpanish(description),
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
        const finalDescription = translateDescriptionToSpanish(description);

        const costTotalUSD = totalCost;
        const costTotalCLP = costTotalUSD * dollarRate;
        const { precioFinalCLP: fallbackCLP } = calculateFinalPrice(costTotalUSD, marginMultiplier, dollarRate);
        // Variantes: precio final POR VARIANTE (vid/nameEs/stock/imagen/precio)
        const bulkShipping = Number.isFinite(shippingCost) ? shippingCost : 0;
        const bulkMapped = variants.map((v: any) =>
          mapCJVariant(v, cjPrice, bulkShipping, marginMultiplier, dollarRate, undefined, Number(stock) > 0 ? Number(stock) : 100)
        );
        const bulkVariantsJSON = bulkMapped.map((v: any) => ({
          vid: v.vid || v.sku,
          name: v.name,
          nameEs: v.nameEs,
          sku: v.sku,
          sellPrice: v.sellPrice,
          shipping: v.shipping,
          finalPrice: v.finalPriceCLP,
          finalPriceCLP: v.finalPriceCLP,
          finalPriceUSD: v.finalPriceUSD,
          stock: v.stock,
          image: v.image,
          size: v.size,
          color: v.color,
        }));
        const bulkCheapest =
          bulkMapped.length
            ? Math.min(...bulkMapped.map((v: any) => Number(v.finalPriceCLP) || 0).filter((n: number) => n > 0))
            : 0;
        const bulkFinalPrice =
          Number.isFinite(bulkCheapest) && bulkCheapest > 0 ? Math.round(bulkCheapest) : Math.round(fallbackCLP);
        const bulkVariantsStock = bulkMapped.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
        const bulkFinalStock = bulkVariantsStock > 0 ? bulkVariantsStock : stock;
        const bulkAllImages = Array.from(
          new Set([...cjImages, ...bulkMapped.map((v: any) => v.image).filter(Boolean)])
        ).slice(0, 10);

        const finalCollectionSlug: string =
          (collectionSlug && String(collectionSlug).trim()) || detectCollection(finalTitle, finalDescription);
        // FEATURE B: categoría main > sub automática (crea las que no existan)
        const { main: bulkCatMain, sub: bulkCatSub } = detectCategory(finalTitle, autoCategory(cjData));
        const category = await resolveMainSubCategory(bulkCatMain, bulkCatSub);
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
            images: bulkAllImages,
            tags: [finalCollectionSlug],
            categoryId: category.id,
            salePrice: bulkFinalPrice,
            margin:
              bulkFinalPrice > 0
                ? parseFloat((((bulkFinalPrice - costTotalCLP) / bulkFinalPrice) * 100).toFixed(2))
                : 0,
            totalCost,
            productCost: cjPrice,
            shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
            stock: bulkFinalStock,
            weight: cjWeight,
            status: 'PUBLISHED',
            importSource: 'CJ_DROPSHIPPING',
            cjProductId: String(pid),
            cjVariants: bulkVariantsJSON,
            variants: bulkVariantsJSON,
            collectionId,
            // FASE 4A: trazabilidad de fuente
            sourceUrl: rawUrl,
            sourcePlatform: 'CJ',
            sourceId: String(pid),
            costUsd: Number.isFinite(totalCost) ? totalCost : null,
            lastCheckedAt: new Date(),
            productImages: {
              create: bulkAllImages.map((imgUrl, imgIndex) => ({ url: imgUrl, position: imgIndex })),
            },
            productVariants: {
              create: bulkMapped.map((v: any) => ({
                sku: String(v.sku),
                // Prisma ProductVariant NO tiene name/image: el nombre de la variante
                // va en `size` y nameEs/image/finalPrice se cruzan desde el JSON `variants`.
                size: (v.name || v.size) ? String(v.name || v.size).slice(0, 60) : undefined,
                color: v.color ? String(v.color).slice(0, 60) : undefined,
                price: Math.round(Number(v.finalPriceCLP) || 0),
                stock: Number(v.stock) || 0,
              })),
            },
          },
          include: { productImages: true, collection: true },
        });

        results.push({
          index: i + 1,
          url: rawUrl,
          ok: true,
          productId: product.id,
          name: String(finalTitle),
          price: Number(bulkFinalPrice),
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