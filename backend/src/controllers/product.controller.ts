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
