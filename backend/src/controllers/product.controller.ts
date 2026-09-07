import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection, search, limit = 50, offset = 0 } = req.query;
    const where: any = { status: 'PUBLISHED' };

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
        include: {
          productImages: { orderBy: { position: 'asc' } },
          productVariants: true,
          collection: true,
        },
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

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 100, offset = 0, search } = req.query;
    const where: any = {};
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
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

export const getCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        products: {
          where: { status: 'PUBLISHED' },
          include: { productImages: { orderBy: { position: 'asc' } }, collection: true },
          take: 8,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

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

    const resolvedCategoryId = categoryId || (await prisma.category.findFirst({ where: { slug: 'general' } }))?.id;

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
    const { name, slug, description, salePrice, categoryId, collectionId, status, stock, tags, sku } = req.body;

    const resolvedCategoryId = categoryId || (await prisma.category.findFirst({ where: { slug: 'general' } }))?.id;

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
        productCost: 0,
        totalCost: 0,
        margin: 0,
        images: [],
        variants: [],
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
