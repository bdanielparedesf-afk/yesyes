import { Request, Response } from 'express';
import { getCJProduct, extractPID, detectCollection, calculatePrice, translateToChileanSpanish } from '../lib/cj';
import { prisma } from '../lib/prisma';

/**
 * Devuelve la categoría a usar. Si no existe una con el slug indicado,
 * la crea (y si no se pasa slug, garantiza la categoría "General").
 * El esquema exige `categoryId` no nulo en Product, por eso NUNCA debe
 * quedar undefined/'general' como string suelto (violaría la FK).
 */
async function resolveCategory(slug?: string): Promise<{ id: string; name: string; slug: string }> {
  const targetSlug = slug?.trim().toLowerCase() || 'general';

  const existing = await prisma.category.findUnique({ where: { slug: targetSlug } });
  if (existing) return existing;

  return prisma.category.create({
    data: {
      name: targetSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug: targetSlug,
    },
  });
}

export const importCJProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, titleEs, price, collectionSlug, description: editedDescription } = req.body;
    if (!url) {
      res.status(400).json({ message: 'URL is required' });
      return;
    }

    const pid = extractPID(url);
    if (!pid) {
      res.status(400).json({ message: 'Could not extract product ID from URL' });
      return;
    }

    const cjData = await getCJProduct(pid);
    if (!cjData) {
      res.status(404).json({ message: 'Product not found on CJ' });
      return;
    }

    const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
    const description = cjData.description || '';
    const productImage = cjData.productImage || cjData.productImages?.[0] || '';
    const productImages = cjData.productImages || [];
    const variants = cjData.variants || [];
    const cjPrice = parseFloat(cjData.price || cjData.sellPrice || 0);

    // Respetar las ediciones hechas en el panel admin (si vienen en el body)
    const finalTitle = (titleEs && String(titleEs).trim()) || translateToChileanSpanish(productNameEn);
    const finalDescription = (editedDescription !== undefined && String(editedDescription).trim()) || description;
    const { price: computedPrice, comparePrice } = calculatePrice(cjPrice);
    const finalPrice = price !== undefined && price !== null && String(price).trim() !== '' ? Number(price) : computedPrice;
    const finalCollectionSlug = collectionSlug?.trim() || detectCollection(finalTitle, finalDescription);

    const category = await resolveCategory();
    const collection = await prisma.collection.findUnique({ where: { slug: finalCollectionSlug } });
    const collectionId = collection?.id ?? (await prisma.collection.create({
      data: {
        name: finalCollectionSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        slug: finalCollectionSlug,
      },
    })).id;

    const slug = `${finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`.slice(0, 100);

    // Evitar duplicados si el producto CJ ya fue importado
    const existingCj = await prisma.product.findFirst({ where: { cjProductId: String(pid) } });
    if (existingCj) {
      res.status(409).json({ message: 'Este producto CJ ya fue importado', productId: existingCj.id });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: finalTitle,
        slug,
        description: finalDescription,
        images: [productImage, ...productImages].filter(Boolean),
        tags: [finalCollectionSlug],
        categoryId: category.id,
        salePrice: finalPrice,
        margin: parseFloat(((finalPrice - cjPrice) / finalPrice * 100).toFixed(2)),
        totalCost: cjPrice,
        productCost: cjPrice,
        status: 'PUBLISHED',
        importSource: 'CJ_DROPSHIPPING',
        cjProductId: String(pid),
        cjVariants: variants,
        variants: [],
        collectionId,
        productImages: {
          create: [productImage, ...productImages].filter(Boolean).map((url, i) => ({ url, position: i })),
        },
        productVariants: {
          create: variants.map((v: any, i: number) => ({
            sku: `cj-${pid}-${i}`,
            price: parseFloat(v.price || cjPrice),
            stock: parseInt(v.stock || '999', 10),
            size: v.size || v.spec || null,
            color: v.color || null,
          })),
        },
      },
      include: { productImages: true, productVariants: true, collection: true },
    });

    res.status(201).json({ message: 'Product imported successfully', product });
  } catch (error: any) {
    console.error('Error importing CJ product:', error);
    res.status(500).json({ message: 'Error importing product', error: error.message });
  }
};

export const previewCJProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ message: 'URL is required' });
      return;
    }

    const pid = extractPID(url);
    if (!pid) {
      res.status(400).json({ message: 'Could not extract product ID from URL' });
      return;
    }

    const cjData = await getCJProduct(pid);
    if (!cjData) {
      res.status(404).json({ message: 'Product not found on CJ' });
      return;
    }

    const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
    const description = cjData.description || '';
    const productImage = cjData.productImage || cjData.productImages?.[0] || '';
    const productImages = cjData.productImages || [];
    const variants = cjData.variants || [];
    const cjPrice = parseFloat(cjData.price || cjData.sellPrice || 0);
    const titleEs = translateToChileanSpanish(productNameEn);
    const collectionSlug = detectCollection(titleEs, description);
    const { price, comparePrice } = calculatePrice(cjPrice);

    const collections = await prisma.collection.findMany({ orderBy: { name: 'asc' } });

    res.json({
      pid,
      titleEs,
      description,
      productImage,
      productImages,
      variants,
      cjPrice,
      price,
      comparePrice,
      collectionSlug,
      collections,
    });
  } catch (error: any) {
    console.error('Error previewing CJ product:', error);
    res.status(500).json({ message: 'Error previewing product', error: error.message });
  }
};

export const listRecentProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { collection: true, productImages: true },
    });
    res.json({ products });
  } catch (error: any) {
    console.error('Error listing products:', error);
    res.status(500).json({ message: 'Error listing products', error: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};
