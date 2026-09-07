import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from '../middlewares/auth';
import {
  getRecentProducts,
  getAllProducts,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { getOrders, updateOrderStatus } from '../controllers/order.controller';
import { getUsers, updateUserRole } from '../controllers/user.controller';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireAdmin);

router.get('/stats', async (req, res) => {
  try {
    const [totalProducts, pendingOrders, totalUsers] = await Promise.all([
      prisma.product.count(),
      prisma.order.count({ where: { status: { in: ['PENDING_PAYMENT', 'PAID', 'PROCESSING'] } } }),
      prisma.user.count(),
    ]);
    res.json({ totalProducts, pendingOrders, totalUsers });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
});

router.get('/products', getAllProducts);
router.get('/products/recent', getRecentProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);

router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);

export default router;
