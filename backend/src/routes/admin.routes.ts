import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, type AuthRequest } from '../middlewares/auth';
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
import { getOrders, getOrderById, updateOrderStatus, bulkUpdateOrderStatus, bulkDeleteOrders } from '../controllers/order.controller';
import { getUsers, updateUserRole, toggleUserActive } from '../controllers/user.controller';
import { getProductsTemplateExcel, bulkCreateProducts } from '../controllers/excel.controller';
import {
  archiveBusinessSoft,
  pauseBusiness,
  publishBusiness,
} from '../services/business-publish.service';
import { uniqueBusinessSlugFor } from '../services/business.service';


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
router.put('/orders/bulk-status', bulkUpdateOrderStatus);
router.delete('/orders/bulk-delete', bulkDeleteOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/status', updateOrderStatus);

router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/active', toggleUserActive);

router.get('/businesses', async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { template: true, owner: { select: { id: true, email: true, name: true } } },
    });
    res.json({ businesses });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching businesses', error: error.message });
  }
});

router.put('/businesses/:id/status', async (req: AuthRequest, res) => {
  const businessId = String(req.params.id);
  const status = String((req.body as any)?.status || '').toUpperCase();
  if (!['PUBLISHED', 'PAUSED', 'ARCHIVED'].includes(status)) {
    res.status(400).json({ message: 'Estado invalido' });
    return;
  }
  try {
    if (status === 'PUBLISHED') {
      const result = await publishBusiness({ businessId, userId: req.user!.id, ip: req.ip });
      if (!result.ok) {
        res.status(result.error.status).json({
          code: result.error.code,
          message: result.error.message,
          checklist: result.checklist,
        });
        return;
      }
      res.json({ business: result.business, checklist: result.checklist });
      return;
    }
    if (status === 'PAUSED') {
      const business = await pauseBusiness({ businessId, userId: req.user!.id, ip: req.ip, reason: 'admin' });
      res.json({ business });
      return;
    }
    const business = await archiveBusinessSoft({ businessId, userId: req.user!.id, ip: req.ip });
    res.json({ business, archived: true });
  } catch {
    res.status(500).json({ message: 'Error updating business status' });
  }
});

router.post('/businesses', async (req: AuthRequest, res) => {
  const parsed = z.object({ ownerId: z.string().uuid(), name: z.string().trim().min(2).max(120), category: z.enum(['HAIR','BARBER','BAKERY','FLOWERS','FOOD','BOUTIQUE','FURNITURE','REAL_ESTATE','MECHANIC','PHONE','CLEANING','PHOTO','TUTORING','CONSTRUCTION','BEAUTY','PET','DETAILING','CAFE','NAILS','FITNESS','AUTO','PRO']), templateId: z.string().uuid().nullable().optional() }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'ownerId, name, category y templateId son requeridos' }); return; }
  const { ownerId, name, category, templateId } = parsed.data as any;
  const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true }, select: { id: true } });
  if (!owner) { res.status(404).json({ message: 'Cliente no encontrado o inactivo' }); return; }
  const template = templateId ? await prisma.businessTemplate.findFirst({ where: { id: templateId, active: true }, select: { id: true, category: true } }) : null;
  if (templateId && (!template || template.category !== category)) { res.status(400).json({ message: 'Plantilla invalida o incompatible con la categoria' }); return; }
  const slug = await uniqueBusinessSlugFor(name);
  const business = await prisma.$transaction(async (tx) => {
    return tx.business.create({ data: { ownerId, name: String(name).trim(), slug, category, templateId: templateId || null, status: 'DRAFT' } as any });
  });
  res.status(201).json({ business });
});

router.get('/businesses/candidates', async (_req, res) => {
  const users = await prisma.user.findMany({ where: { isActive: true, role: { in: ['CUSTOMER', 'BUSINESS'] } }, select: { id: true, name: true, lastName: true, email: true }, orderBy: { name: 'asc' }, take: 500 });
  res.json({ users });
});

router.get('/business-categories', async (_req, res) => {
  const categories = await prisma.businessCategory.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  res.json({ categories });
});

export default router;
