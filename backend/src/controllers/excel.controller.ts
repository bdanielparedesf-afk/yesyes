import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma';
import { resolveCategory } from './cj.controller';

const MAX_IMAGES = 5;
const MAX_ROWS = 50;

function slugify(input: string): string {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || `producto-${Date.now()}`;
}

/**
 * FASE 4C — GET /api/admin/products/template-excel
 * Genera una plantilla .xlsx con columnas: link | categoria (opcional).
 * Máximo 50 filas en blanco listas para llenar.
 */
export const getProductsTemplateExcel = async (_req: Request, res: Response): Promise<void> => {
  try {
    const headers = [['link', 'categoria']];
    const rows: (string | undefined)[][] = [
      ...headers,
      ...Array.from({ length: MAX_ROWS }, () => [undefined, undefined]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'links');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-links-cj.xlsx"');
    res.send(Buffer.from(buffer as Buffer));
  } catch (error: any) {
    console.error('Error generating template excel:', error);
    res.status(500).json({ message: 'Error generando plantilla Excel', error: error.message });
  }
};

interface BulkCreateRow {
  link: string;
  sourceId: string;
  titleEs: string;
  description?: string;
  costUsd: number;
  priceClp: number;
  images?: string[];
  category?: string;
}

/**
 * FASE 4C — POST /api/admin/products/bulk-create
 * Body: { products: BulkCreateRow[] }  (solo los marcados en el preview)
 * Crea cada producto guardando trazabilidad de fuente CJ:
 * sourceUrl, sourcePlatform='CJ', sourceId, costUsd, lastCheckedAt y máx 5 fotos.
 */
export const bulkCreateProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { products } = req.body || {};
    const list: BulkCreateRow[] = Array.isArray(products) ? products.slice(0, MAX_ROWS) : [];
    if (!list.length) {
      res.status(400).json({ message: 'Envía al menos un producto en "products".' });
      return;
    }

    const results: { ok: boolean; index: number; name?: string; productId?: string; error?: string }[] = [];
    let created = 0;

    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (!row) continue;
      try {
        const link = String(row.link ?? '').trim();
        if (!link) {
          results.push({ ok: false, index: i + 1, error: 'Falta el link' });
          continue;
        }
        const sourceId = String(row.sourceId ?? '').trim();

        // Duplicado: mismo sourceId + plataforma CJ
        if (sourceId) {
          const existing = await prisma.product.findFirst({
            where: { sourceId, sourcePlatform: 'CJ' },
            select: { id: true, name: true },
          });
          if (existing) {
            results.push({ ok: false, index: i + 1, productId: existing.id, name: existing.name, error: 'Duplicado: ya fue importado' });
            continue;
          }
        }

        const name = String(row.titleEs || 'Producto CJ').trim();
        const images = Array.isArray(row.images) ? row.images.filter((u: any) => typeof u === 'string' && u).slice(0, MAX_IMAGES) : [];
        const costUsd = Number(row.costUsd);
        const salePrice = Math.round(Number(row.priceClp) || 0);
        const categorySlug = String(row.category || 'general').trim().toLowerCase().replace(/\s+/g, '-');
        const category = await resolveCategory(categorySlug || 'general');

        const product = await prisma.product.create({
          data: {
            name,
            slug: `${slugify(name)}-${Date.now()}-${i}`.slice(0, 100),
            description: String(row.description || row.titleEs || ''),
            salePrice,
            categoryId: category.id,
            margin:
              salePrice > 0
                ? parseFloat((((salePrice - Number(costUsd)) / salePrice) * 100).toFixed(2))
                : 0,
            totalCost: costUsd,
            productCost: costUsd,
            shippingCost: 0,
            stock: 100,
            status: 'PUBLISHED',
            importSource: 'CJ_DROPSHIPPING',
            cjProductId: sourceId,
            variants: [],
            images,
            tags: [categorySlug],
            sourceUrl: link,
            sourcePlatform: 'CJ',
            sourceId,
            costUsd: costUsd > 0 ? costUsd : null,
            lastCheckedAt: new Date(),
            productImages: {
              create: images.map((url: string, position: number) => ({ url, position })),
            },
          },
          include: { productImages: true, collection: true, category: true },
        });

        created++;
        results.push({ ok: true, index: i + 1, productId: product.id, name: product.name });
      } catch (rowError: any) {
        console.error(`[bulk-create] error fila ${i + 1}:`, rowError?.message || rowError);
        results.push({ ok: false, index: i + 1, error: rowError?.message || 'Error desconocido' });
      }
    }

    res.status(201).json({ created, failed: results.length - created, results });
  } catch (error: any) {
    console.error('Error in bulk create:', error);
    res.status(500).json({ message: 'Error en la creación masiva', error: error.message });
  }
};