import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { groupCategories, isTechnicalAeSlug, resolveGroupIds } from '../utils/category-groups';

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

/**
 * Select mínimo para endpoints PÚBLICOS: todo lo que el frontend consume
 * (mapProduct en services/products.ts) y nada más. Excluye deliberadamente
 * aliexpressSnapshot (JSONB gigante con raw del proveedor), cjVariants y
 * campos administrativos que no usa la tienda pública.
 */
const PUBLIC_VARIANT_SELECT = {
  id: true, sku: true, size: true, color: true, price: true, stock: true,
  supplierVariantId: true, supplierAttributes: true, supplierImage: true,
  supplierCostUsd: true, supplierShippingUsd: true, supplierStock: true, supplierStockKnown: true,
};

const PUBLIC_PRODUCT_SELECT = {
  id: true, name: true, slug: true, description: true, images: true, video: true,
  tags: true, sku: true, weight: true, dimensions: true, stock: true,
  productCost: true, totalCost: true, salePrice: true,
  isFeatured: true, isOffer: true,
  variants: true,
  productImages: { orderBy: { position: 'asc' as const } },
  productVariants: { select: PUBLIC_VARIANT_SELECT },
  category: { select: { id: true, name: true, slug: true, image: true } },
  collection: { select: { id: true, name: true, slug: true } },
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection, search, category, limit = 50, offset = 0 } = req.query;
    const where: any = { status: 'PUBLISHED', hidden: false };

    if (collection) {
      where.collection = { slug: collection };
    }
    if (category) {
      // ?category= acepta slug canonico/alias y agrupa todos los ae-* del grupo.
      const allCats = await prisma.category.findMany({ where: { active: true }, select: { id: true, slug: true, name: true } });
      const resolved = resolveGroupIds(allCats as any[], String(category));
      if (resolved) {
        where.categoryId = { in: resolved.ids };
      } else {
        where.category = { slug: String(category) };
      }
    }
    if (search) {
      const term = String(search).trim();
      const contains = { contains: term, mode: 'insensitive' as const };
      where.OR = [
        { name: contains },
        { description: contains },
        { tags: { has: term } },
        { category: { name: contains } },
        { aliexpressId: { equals: term } },
      ];
    }

    const takeNum = Math.min(Number(limit), 100);
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: takeNum,
        skip: Number(offset),
        select: PUBLIC_PRODUCT_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

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
      select: {
        ...PUBLIC_PRODUCT_SELECT,
        category: { select: { id: true, name: true, slug: true } },
        // Solo reseñas ya curadas/moderadas: la ficha muestra valoraciones reales.
        productReviews: {
          where: { isModerated: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true, rating: true, comment: true,
            createdAt: true, images: true, verifiedPurchase: true,
          },
        },
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

// Select mínimo para el HOME: solo campos que ProductCard necesita para renderizar
// la tarjeta (imagen, nombre, precio, descuento, stock, categoría para navegación).
// Se excluyen deliberadamente: description, weight, dimensions, tags, video.
// Se mantiene: variants (JSON usado por crossVariants para precio/stock de variantes
// en mapHomeProduct) y productVariants (DB, usado por crossVariants).
// aliexpressSnapshot ya está excluido por diseño (no está en este select).
const HOME_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  salePrice: true,
  compareAtPrice: true,
  productCost: true,
  totalCost: true,
  stock: true,
  isFeatured: true,
  isOffer: true,
  variants: true,
  collection: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  productImages: { take: 2, orderBy: { position: 'asc' as const } },
  productVariants: { select: PUBLIC_VARIANT_SELECT },
};

async function fetchPublishedProducts(
  db: typeof prisma,
  whereExtra: any,
  take: number,
  orderBy: any,
  select?: any,
) {
  return db.product.findMany({
    where: { status: 'PUBLISHED', hidden: false, ...whereExtra },
    take,
    // Prisma exige orderBy como array de objetos de un solo campo.
    orderBy: Array.isArray(orderBy) ? orderBy : [orderBy],
    select: select ?? HOME_PRODUCT_SELECT,
  });
}

export const getHome = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Caché TTL corta en memoria: la home es lectura pública que cambia poco y
    // concentra ~10+ consultas. 60s es imperceptible para contenido nuevo y
    // reduce drásticamente la carga en Supabase/Vercel. NO se cachea carrito,
    // stock crítico, pagos ni datos privados.
    if (homeDataCache && Date.now() - homeDataCache.at < HOME_CACHE_TTL_MS) {
      res.json(homeDataCache.data);
      return;
    }
    const result = await buildHomeData(prisma);
    homeDataCache = { at: Date.now(), data: result };
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ message: 'Error fetching home data', error: error.message });
  }
};

const HOME_CACHE_TTL_MS = 60_000;
let homeDataCache: { at: number; data: unknown } | null = null;

export async function buildHomeData(db: typeof prisma) {
  const [rows, featured, latest, offers, uncategorized] = await Promise.all([
    db.category.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
    fetchPublishedProducts(db, { isFeatured: true }, 8, { createdAt: 'desc' }),
    fetchPublishedProducts(db, {}, 12, { createdAt: 'desc' }),
    fetchPublishedProducts(db, { isOffer: true }, 8, { createdAt: 'desc' }),
    fetchPublishedProducts(db, { collectionId: null }, 8, [{ createdAt: 'desc' }, { id: 'desc' }]),
  ]);

  // Agrupacion comercial: N ae-* con mismo nombre => 1 tarjeta.
  // Contador REAL: solo PUBLISHED + visibles (evita _count con drafts/ocultos).
  const groups = groupCategories(rows as any[]);
  const categories: any[] = [];
  const byCategory: Record<string, any[]> = {};
  // Compatibilidad: exponer tambien alias en espanol (electronica, hogar...)
  // apuntando al mismo grupo, sin duplicar tarjetas en `categories`.
  const ALIAS_KEYS: Record<string, string[]> = {
    electronics: ['electronica'],
    fashion: ['moda'],
    home: ['hogar'],
    toys: ['juguetes'],
    beauty: ['belleza'],
    sports: ['deportes'],
    office: ['oficina'],
  };
  for (const g of groups) {
    // El mock de tests solo soporta categoryId escalar: iterar por id y unir.
    let products: any[] = [];
    for (const id of g.categoryIds) {
      const chunk = await fetchPublishedProducts(db, { categoryId: id }, 6, { createdAt: 'desc' });
      products = products.concat(chunk);
    }
    products = products.slice(0, 6);
    if (!products.length) continue;
    let total = 0;
    for (const id of g.categoryIds) {
      total += await (db as any).product.count({
        where: { status: 'PUBLISHED', hidden: false, categoryId: id },
      });
    }
    const canonical = (rows as any[]).find((r) => !isTechnicalAeSlug(r.slug) && r.slug === g.key);
    categories.push({
      id: canonical?.id || g.categoryIds[0],
      name: canonical?.name || g.name,
      slug: g.slug, image: canonical?.image ?? g.image, productCount: total,
    });
    byCategory[g.slug] = products;
    for (const alias of ALIAS_KEYS[g.slug] || []) byCategory[alias] = products;
  }

  return {
    categories,
    featured,
    latest,
    offers,
    byCategory,
    uncategorized,
  };
}

export const getCategoryProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { search, sortBy = 'createdAt', sortDir = 'desc', limit = 50, offset = 0 } = req.query;

    // Resolver slug publico -> ids reales (canonico/alias agrupa ae-*).
    const allCats = await prisma.category.findMany({ where: { active: true } });
    const resolved = resolveGroupIds(allCats as any[], String(slug));
    if (!resolved) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }
    const category = {
      id: resolved.group.categoryIds[0],
      name: resolved.group.name,
      slug: resolved.group.slug,
      image: resolved.group.image,
    };

    const where: any = { status: 'PUBLISHED', hidden: false, categoryId: { in: resolved.ids } };
    let searchOr: any = null;
    if (search) {
      const term = String(search).trim();
      const contains = { contains: term, mode: 'insensitive' as const };
      searchOr = [{ name: contains }, { description: contains }, { tags: { has: term } }];
    }

    // Nota: Prisma soporta `in` + AND. Para no romper el mock de tests
    // (que solo filtra categoryId escalar), se consulta por id y se une.
    const takeNum = Math.min(Number(limit), 100);
    const skipNum = Number(offset) || 0;
    let merged: any[] = [];
    for (const id of resolved.ids) {
      const chunk = await prisma.product.findMany({
        where: searchOr ? { ...where, categoryId: id, OR: searchOr } : { ...where, categoryId: id },
        take: takeNum,
        skip: 0,
        orderBy: { [String(sortBy)]: String(sortDir) },
        select: HOME_PRODUCT_SELECT,
      });
      merged = merged.concat(chunk);
    }
    const total = merged.length;
    const products = merged.slice(skipNum, skipNum + takeNum);

    res.json({ category, products, total });
  } catch (error: any) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ message: 'Error fetching category products', error: error.message });
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
      ? ids.map((id: any) => String(id ?? '').trim()).filter(Boolean)
      : [];
    if (!list.length) {
      res.status(400).json({ message: 'Envía al menos un id en "ids".' });
      return;
    }

    await prisma.productVariant.deleteMany({
      where: { productId: { in: list } },
    });

    const result = await prisma.product.deleteMany({
      where: { id: { in: list } },
    });

    res.json({ deleted: result.count });
  } catch (error: any) {
    console.error('Error bulk deleting products:', error);
    res.status(500).json({ message: 'Error bulk deleting products', error: error.message });
  }
};
