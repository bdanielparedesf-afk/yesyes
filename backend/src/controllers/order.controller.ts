import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const where: any = {};
    if (status) where.status = String(status);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true, lastName: true } }, orderItems: true },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, total });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: String(id) },
      data: { status: status as any },
    });
    res.json({ order });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
