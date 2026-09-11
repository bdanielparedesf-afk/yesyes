import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/** Garantiza una categoría válida (crea "General" si no existe). */
async function resolveCategoryId(categoryId?: string): Promise<string> {
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (cat) return cat.id;
  }
  const general = await prisma.category.findFirst({ where: { slug: 'general' } });
  if (general) return general.id;
  return prisma.category.create({
    data: { name: 'General', slug: 'general' },
  }).then((c) => c.id);
}

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection, search, limit = 50, offset = 0 } = req.query;
    // El modelo Product usa `status` (enum: DRAFT, PUBLISHED, PAUSED, OUT_OF_STOCK, NOT_PROFITABLE, ARCHIVED)
    // FASE 5: los productos con `hidden=true` (ocultados desde Admin) no se muestran en tienda.
    const where: any = { status: 'PUBLISHED', hidden: false };

    if (collection) {
      where.collection = { slug: collection };
    }
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        // Se eliminó productVariants: true del listado: la página de productos no
        // muestra variantes y cargar todas las variantes de 50 productos multiplica
        // innecesariamente el tamaño de la respuesta y el tiempo de consulta.
        include: {
          productImages: { orderBy: { position: 'asc' } },
          collection: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    // Log para debugging: cuántos productos hay en total en BD
    const totalInDb = await prisma.product.count();
    const publishedInDb = await prisma.product.count({ where: { status: 'PUBLISHED' } });
    console.log(`[getProducts] Productos en BD: ${totalInDb} total, ${publishedInDb} publicados, ${products.length} devueltos`);

    res.json({ products, total });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug: id },
      include: {
        productImages: { orderBy: { position: 'asc' } },
        productVariants: true,
        collection: true,
      },
    });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json({ product });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 100, offset = 0, search, hasAlert } = req.query;
    const where: any = {};
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }
    // FASE 5: filtro de productos con alerta de sync (link no disponible o precio cambió)
    if (hasAlert === 'true') {
      where.hasAlert = true;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        include: { productImages: { orderBy: { position: 'asc' } }, collection: true, category: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, total });
  } catch (error: any) {
    console.error('Error fetching all products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

/**
 * FASE 5: oculta un producto (PUT /admin/products/:id/hide).
 * Marca hidden=true y devuelve { active: false, product }.
 */
export const hideProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.update({
      where: { id: String(id) },
      data: { hidden: true, hasAlert: false, alert: null, alertLevel: 'info' },
      include: { productImages: true, collection: true, category: true },
    });
    res.json({ active: false, hidden: true, product });
  } catch (error: any) {
    console.error('Error hiding product:', error);
    res.status(500).json({ message: 'Error ocultando producto', error: error.message });
  }
};

export const getCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        products: {
          // Filtra solo productos publicados
          where: { status: 'PUBLISHED' },
          // Se eliminó collection: true del include anidado: los productos ya
          // pertenecen a la colección consultada, incluirla de nuevo es redundanto.
          include: { productImages: { orderBy: { position: 'asc' } } },
          take: 8,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Log para debugging
    const totalInDb = await prisma.product.count();
    const publishedInDb = await prisma.product.count({ where: { status: 'PUBLISHED' } });
    const collectionsWithProducts = collections.filter((c: any) => c.products && c.products.length > 0).length;
    console.log(`[getCollections] Productos en BD: ${totalInDb} total, ${publishedInDb} publicados, ${collections.length} colecciones, ${collectionsWithProducts} con productos`);

    res.json({ collections });
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ message: 'Error fetching collections', error: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, salePrice, description, status, categoryId, collectionId, stock, tags, sku } = req.body;

    const resolvedCategoryId = await resolveCategoryId(categoryId);

    const product = await prisma.product.update({
      where: { id: String(id) },
      data: {
        name,
        salePrice: Number(salePrice),
        description,
        status: status as any,
        categoryId: resolvedCategoryId,
        collectionId: collectionId || undefined,
        stock: Number(stock) || 0,
        tags: tags || [],
        sku,
      },
      include: { productImages: { orderBy: { position: 'asc' } }, collection: true, category: true },
    });

    res.json({ product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, slug, description, salePrice, categoryId, collectionId, status, stock, tags, sku,
      // FASE 4B: importación AliExpress (trazabilidad + fotos + costo)
      images, sourceUrl, sourcePlatform, sourceId, costUsd, productCost, totalCost,
    } = req.body;

    const resolvedCategoryId = await resolveCategoryId(categoryId);
    const productImages = Array.isArray(images) ? images.slice(0, 5) : [];
    const numericCostUsd = Number(costUsd) > 0 ? Number(costUsd) : null;

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        salePrice: Number(salePrice),
        categoryId: resolvedCategoryId,
        collectionId: collectionId || undefined,
        status: (status as any) || 'DRAFT',
        stock: Number(stock) || 0,
        tags: tags || [],
        sku,
        productCost: Number(productCost) || 0,
        totalCost: Number(totalCost) || Number(productCost) || 0,
        margin:
          Number(salePrice) > 0
            ? parseFloat(
                (((Number(salePrice) - (Number(totalCost) || Number(productCost) || 0)) / Number(salePrice)) * 100).toFixed(2)
              )
            : 0,
        images: productImages,
        variants: [],
        // FASE 4B: trazabilidad de fuente (opcional; CJ bulk usa su propio controller)
        ...(sourceUrl ? { sourceUrl: String(sourceUrl) } : {}),
        ...(sourcePlatform ? { sourcePlatform: String(sourcePlatform) } : {}),
        ...(sourceId ? { sourceId: String(sourceId) } : {}),
        ...(numericCostUsd ? { costUsd: numericCostUsd, lastCheckedAt: new Date() } : {}),
        ...(productImages.length
          ? { productImages: { create: productImages.map((url: string, position: number) => ({ url, position })) } }
          : {}),
      },
      include: { productImages: { orderBy: { position: 'asc' } }, collection: true, category: true },
    });

    res.status(201).json({ product });
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
};

export const getRecentProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { productImages: { orderBy: { position: 'asc' } }, collection: true },
    });

    res.json({ products });
  } catch (error: any) {
    console.error('Error fetching recent products:', error);
    res.status(500).json({ message: 'Error fetching recent products', error: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.product.delete({ where: { id: String(id) } });

    res.json({ message: 'Product deleted' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};

/**
 * FEATURE A — Bulk delete. DELETE /api/admin/products/bulk
 * Body: { ids: string[] }. Elimina todos los productos cuyo id esté en `ids`.
 */
export const bulkDeleteProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body || {};
    const list: string[] = Array.isArray(ids)
      ? ids.map((i: any) => String(i ?? '').trim()).filter(Boolean)
      : [];
    if (!list.length) {
      res.status(400).json({ message: 'Envía al menos un id en "ids".' });
      return;
    }
    const result = await prisma.product.deleteMany({ where: { id: { in: list } } });
    res.json({ deleted: result.count });
  } catch (error: any) {
    console.error('Error bulk deleting products:', error);
    res.status(500).json({ message: 'Error bulk deleting products', error: error.message });
  }
};
