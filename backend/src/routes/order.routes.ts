import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, type AuthRequest } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { orderItems: true },
  });
  res.json({ orders });
});

router.get('/:id', async (req: AuthRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: String(req.params.id), userId: req.user!.id },
    include: { orderItems: true },
  });
  if (!order) {
    res.status(404).json({ message: 'Pedido no encontrado' });
    return;
  }
  res.json({ order });
});

export default router;
