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
  bulkDeleteProducts,
  hideProduct,
} from '../controllers/product.controller';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { getOrders, getOrderById, updateOrderStatus } from '../controllers/order.controller';
import { getUsers, updateUserRole, toggleUserActive } from '../controllers/user.controller';
import { getProductsTemplateExcel, bulkCreateProducts } from '../controllers/excel.controller';

const router = Router();

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

// ── FASE 4C: Excel masivo CJ ──
// GET /api/admin/products/template-excel → plantilla .xlsx (link | categoria, 50 filas)
router.get('/products/template-excel', getProductsTemplateExcel);
// POST /api/admin/products/bulk-create  → crea productos del Excel marcados
router.post('/products/bulk-create', bulkCreateProducts);

router.get('/products', getAllProducts);
router.get('/products/recent', getRecentProducts);
router.post('/products', createProduct);
// FEATURE A: bulk delete (debe ir ANTES de /products/:id para no chocar con el segmento dinámico)
router.delete('/products/bulk', bulkDeleteProducts);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
// FASE 5: oculta un producto (link caído o alerta resuelta)
router.put('/products/:id/hide', hideProduct);

// Reseñas importadas de un producto (se usan desde el importador CJ).
// Body: { reviews: [{ rating: 4|5, comment: string, image?: string }] }
router.post('/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviews } = req.body || {};
    const list: any[] = Array.isArray(reviews) ? reviews : [];
    if (!list.length) {
      res.status(400).json({ message: 'Envía al menos una reseña en "reviews".' });
      return;
    }
    const product = await prisma.product.findUnique({ where: { id: String(id) } });
    if (!product) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
    if (!admin) {
      res.status(500).json({ message: 'No hay usuario ADMIN activo para asignar las reseñas.' });
      return;
    }
    const created: any[] = [];
    for (const r of list.slice(0, 20)) {
      const rating = Math.min(5, Math.max(1, Number(r?.rating) || 5));
      const comment = String(r?.comment || '').trim();
      const image = typeof r?.image === 'string' && r.image ? r.image : null;
      const review = await prisma.productReview.create({
        data: {
          productId: product.id,
          userId: admin.id,
          rating,
          comment: comment || 'Excelente producto',
          verifiedPurchase: true,
          images: image ? [image] : [],
          isModerated: true,
          isVerified: true,
        },
      });
      created.push(review);
    }
    res.status(201).json({ created: created.length, reviews: created });
  } catch (error: any) {
    console.error('Error creating imported reviews:', error);
    res.status(500).json({ message: 'Error creando reseñas', error: error.message });
  }
});

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/status', updateOrderStatus);

router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/active', toggleUserActive);

export default router;
