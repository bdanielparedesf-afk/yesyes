import { Router } from 'express';
import { prisma } from '../lib/prisma';
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

router.get('/stats', authenticate, requireAdmin, async (req, res) => {
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

router.get('/products', authenticate, requireAdmin, getAllProducts);
router.get('/products/recent', authenticate, requireAdmin, getRecentProducts);
router.post('/products', authenticate, requireAdmin, createProduct);
router.put('/products/:id', authenticate, requireAdmin, updateProduct);
router.delete('/products/:id', authenticate, requireAdmin, deleteProduct);

router.get('/categories', authenticate, requireAdmin, getCategories);
router.post('/categories', authenticate, requireAdmin, createCategory);
router.put('/categories/:id', authenticate, requireAdmin, updateCategory);
router.delete('/categories/:id', authenticate, requireAdmin, deleteCategory);

router.get('/orders', authenticate, requireAdmin, getOrders);
router.put('/orders/:id/status', authenticate, requireAdmin, updateOrderStatus);

router.get('/users', authenticate, requireAdmin, getUsers);
router.put('/users/:id/role', authenticate, requireAdmin, updateUserRole);

export default router;
