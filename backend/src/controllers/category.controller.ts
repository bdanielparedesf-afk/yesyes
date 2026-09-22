import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { groupCategories } from '../utils/category-groups';

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.category.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    });
    // Contar SOLO productos visibles (PUBLISHED + no ocultos) por categoria real.
    const counts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { status: 'PUBLISHED', hidden: false },
      _count: { categoryId: true },
    });
    const countByCat = new Map(counts.map((c) => [c.categoryId, c._count.categoryId]));
    // Agrupar por clave comercial: N ae-* con mismo nombre => 1 tarjeta.
    const groups = groupCategories(rows as any[]);
    const categories = groups
      .map((g) => {
        const canonical = (rows as any[]).find((r) => !/^ae-\d+$/i.test(r.slug) && r.slug === g.key);
        const productCount = g.categoryIds.reduce((acc, id) => acc + (countByCat.get(id) || 0), 0);
        return {
          id: canonical?.id || g.categoryIds[0],
          name: canonical?.name || g.name,
          slug: g.slug,
          image: canonical?.image ?? g.image,
          order: canonical?.order ?? g.order,
          active: true,
          productCount,
          _count: { products: productCount },
        };
      })
      .filter((c) => c.productCount > 0);
    // Lectura pública que casi no cambia: el CDN puede servirla 5 min.
    // stale-while-revalidate evita que el header espere al backend en frío.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({ categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, slug, description, image, parentId, order, active } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        image,
        parentId,
        order: Number(order) || 0,
        active: active ?? true,
      },
    });
    res.status(201).json({ category });
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, slug, description, image, parentId, order, active } = req.body;
    const category = await prisma.category.update({
      where: { id: String(id) },
      data: {
        name,
        slug,
        description,
        image,
        parentId,
        order: Number(order) || 0,
        active: active ?? true,
      },
    });
    res.json({ category });
  } catch (error: any) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id: String(id) } });
    res.json({ message: 'Category deleted' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
};
