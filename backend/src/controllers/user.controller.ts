import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: String(search), mode: 'insensitive' } },
        { name: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        select: { id: true, email: true, name: true, lastName: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await prisma.user.update({
      where: { id: String(id) },
      data: { role: role as any },
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name, lastName: user.lastName, role: user.role } });
  } catch (error: any) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Error updating user role', error: error.message });
  }
};

export const toggleUserActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: { isActive: !user.isActive },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error toggling user active:', error);
    res.status(500).json({ message: 'Error updating user active', error: error.message });
  }
};
