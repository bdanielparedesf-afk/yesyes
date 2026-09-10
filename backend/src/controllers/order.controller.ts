import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

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

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: true, orderItems: true },
    });

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Enriquecimiento al vuelo para el botón "Ver producto original" sin
    // asumir que OrderItem tiene relación formal con Product.
    for (const item of order.orderItems) {
      let product = null;

      if ((item as any).productId) {
        product = await prisma.product.findUnique({ where: { id: (item as any).productId } });
      } else if ((item as any).supplierProductId) {
        product = await prisma.product.findFirst({ where: { supplierProductId: (item as any).supplierProductId } });
      } else if (item.productName) {
        product = await prisma.product.findFirst({ where: { name: item.productName } });
      }

      (item as any).supplierUrl = product?.sourceUrl || product?.supplierUrl || null;
      (item as any).sourceUrl = product?.sourceUrl || null;
      (item as any).sourcePlatform = product?.sourcePlatform || null;
    }

    res.json(order);
  } catch (error: any) {
    console.error('Error fetching order by id:', error);
    res.status(500).json({ message: 'Error fetching order', error: error.message });
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
