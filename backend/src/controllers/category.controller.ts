import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { products: true } } },
    });
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
