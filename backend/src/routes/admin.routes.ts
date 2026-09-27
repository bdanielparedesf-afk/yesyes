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
import {
  listAdminBusinesses,
  takeDownBusinessPage,
  restoreBusinessPage,
  markSubscriptionActive,
  deleteUnpublishedBusiness,
  deleteManyBusinesses,
} from '../services/admin-business-pages.service';
import {
  listLibrary,
  saveToLibrary,
  reuseFromLibrary,
  setLibraryArchived,
  deleteLibraryEntry,
} from '../services/business-page-library.service';


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

/**
 * GESTIÓN DE PÁGINAS PUBLICADAS.
 *
 * Lista con el estado REAL de cada página (viva / en gracia / dada de baja) y
 * las acciones de soporte. El filtro es por estado de vida, no solo por status
 * del negocio: una página "PUBLISHED" sin plan está dada de baja aunque el
 * negocio diga lo contrario.
 */
router.get('/business-pages', async (req, res) => {
  try {
    const result = await listAdminBusinesses({
      filter: String(req.query.filter || 'TODOS'),
      search: String(req.query.search || ''),
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'No se pudo cargar el estado de las páginas', error: error.message });
  }
});

/** Da de baja la página. NO borra contenido: solo la saca de línea. */
router.put('/business-pages/:id/take-down', async (req: AuthRequest, res) => {
  try {
    const row = await takeDownBusinessPage({
      businessId: String(req.params.id),
      adminId: req.user!.id,
      reason: (req.body as any)?.reason,
    });
    res.json({ row });
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo dar de baja' });
  }
});

/** Restablece la página sin volver a cobrar ni revalidar el checklist. */
router.put('/business-pages/:id/restore', async (req: AuthRequest, res) => {
  try {
    const row = await restoreBusinessPage({
      businessId: String(req.params.id),
      adminId: req.user!.id,
      reason: (req.body as any)?.reason,
    });
    res.json({ row });
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo restablecer' });
  }
});

/** Biblioteca de ejemplos reutilizables (solo admin). */
router.get('/page-library', async (req, res) => {
  try {
    const entries = await listLibrary({
      includeArchived: String(req.query.includeArchived || '') === '1',
      search: String(req.query.search || ''),
    });
    res.json({ entries });
  } catch (error: any) {
    res.status(500).json({ message: 'No se pudo cargar la biblioteca', error: error.message });
  }
});

/** Guarda una página como ejemplo. La página NO se modifica. */
router.post('/page-library', async (req: AuthRequest, res) => {
  const body = (req.body || {}) as any;
  if (!body.businessId) { res.status(400).json({ message: 'Indica la página que quieres guardar como ejemplo.' }); return; }
  try {
    const entry = await saveToLibrary({
      businessId: String(body.businessId),
      name: body.name ? String(body.name) : undefined,
      description: body.description ? String(body.description) : undefined,
      label: body.label ? String(body.label) : undefined,
      adminId: req.user!.id,
    });
    res.status(201).json({ entry });
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo guardar el ejemplo' });
  }
});

/** Crea una página nueva a partir de un ejemplo. No toca la página original. */
router.post('/page-library/:id/reuse', async (req: AuthRequest, res) => {
  const body = (req.body || {}) as any;
  if (!body.name || !body.ownerId) { res.status(400).json({ message: 'Indica el nombre de la página nueva y el cliente.' }); return; }
  try {
    const result = await reuseFromLibrary({
      libraryId: String(req.params.id),
      name: String(body.name),
      ownerId: String(body.ownerId),
      category: body.category ? String(body.category) : undefined,
      adminId: req.user!.id,
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo reutilizar el ejemplo' });
  }
});

/** Aparta o reactiva un ejemplo sin borrarlo. */
router.put('/page-library/:id', async (req: AuthRequest, res) => {
  const archived = (req.body as any)?.archived;
  if (typeof archived !== 'boolean') { res.status(400).json({ message: 'Indica si el ejemplo queda apartado (archived).' }); return; }
  try {
    const entry = await setLibraryArchived(String(req.params.id), archived, req.user!.id);
    res.json({ entry });
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo actualizar el ejemplo' });
  }
});

/** Borra un ejemplo de la biblioteca. */
router.delete('/page-library/:id', async (req: AuthRequest, res) => {
  try {
    const result = await deleteLibraryEntry(String(req.params.id), req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo eliminar el ejemplo' });
  }
});

/**
 * ELIMINA VARIAS PÁGINAS de una vez. Va ANTES que `/:id` a propósito: si se
 * declarara después, Express leería "bulk" como un id y nunca llegaría acá.
 * Devuelve el detalle de cada una, porque un lote parcial es un resultado
 * normal y el admin tiene que saber qué quedó.
 */
router.post('/business-pages/bulk-delete', async (req: AuthRequest, res) => {
  const ids = (req.body as any)?.ids;
  if (!Array.isArray(ids) || !ids.length) {
    res.status(400).json({ message: 'Selecciona al menos una página para eliminar.' });
    return;
  }
  try {
    const result = await deleteManyBusinesses({
      businessIds: ids.map(String),
      adminId: req.user!.id,
      force: (req.body as any)?.force === true,
      reason: (req.body as any)?.reason,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo eliminar el lote' });
  }
});

/**
 * ELIMINA una página. Por defecto solo borra lo que nunca se publicó; con
 * `force` borra cualquiera (limpieza de páginas de prueba). Si hay un cobro
 * vivo de Mercado Pago, se cancela en el proveedor antes de borrar la fila.
 */
router.delete('/business-pages/:id', async (req: AuthRequest, res) => {
  try {
    const result = await deleteUnpublishedBusiness({
      businessId: String(req.params.id),
      adminId: req.user!.id,
      force: (req.body as any)?.force === true,
      reason: (req.body as any)?.reason,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo eliminar la página' });
  }
});

/** Ajuste manual del plan (soporte). Queda auditado. */
router.put('/business-pages/:id/subscription', async (req: AuthRequest, res) => {
  const status = String((req.body as any)?.status || '').toUpperCase();
  if (!['ACTIVE', 'PAST_DUE', 'EXPIRED'].includes(status)) {
    res.status(400).json({ message: 'Estado de suscripción inválido' });
    return;
  }
  try {
    const row = await markSubscriptionActive({
      businessId: String(req.params.id),
      adminId: req.user!.id,
      status: status as 'ACTIVE' | 'PAST_DUE' | 'EXPIRED',
      graceDays: (req.body as any)?.graceDays,
    });
    res.json({ row });
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'No se pudo actualizar la suscripción' });
  }
});

router.get('/businesses', async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { template: true, subscription: { include: { plan: true } }, owner: { select: { id: true, email: true, name: true } } },
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
      const result = await publishBusiness({ businessId, userId: req.user!.id, ip: req.ip, isAdmin: true });
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
