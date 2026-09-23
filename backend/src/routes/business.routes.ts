import { Router, raw } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth';
import { requireBusinessOwner, ownerWhere } from '../middlewares/businessAuth';
import { businessUpsertSchema, serviceSchema, propertySchema, gallerySchema, cleanDescription } from '../utils/business';
import { uniqueBusinessSlugFor, businessCompleteness } from '../services/business.service';
import { createBusiness, updateBusiness } from '../controllers/business.controller';
import { uploadBusinessImage, MAX_UPLOAD_BYTES } from '../lib/storage';
const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const where = req.user!.role === 'ADMIN' ? {} : { ownerId: req.user!.id };
  const businesses = await prisma.business.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { template: true } });
  res.json({ businesses });
});

router.post('/', createBusiness);

// Listado de plantillas activas para el picker del dashboard.
// IMPORTANTE: debe ir ANTES de GET /:id, si no '/templates' se captura como id.
router.get('/templates', async (req: AuthRequest, res) => {
  const category = req.query.category ? String(req.query.category) : undefined;
  const templates = await prisma.businessTemplate.findMany({
    where: { active: true, ...(category ? { category: category as any } : {}) },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, category: true, capabilities: true },
  });
  res.json({ templates });
});

// Vista previa autenticada: solo owner (via ownerWhere) o ADMIN.
// Devuelve el negocio en CUALQUIER estado (DRAFT/PAUSED/ARCHIVED) con su
// contenido, para que el owner pueda previsualizar antes de publicar.
// Nunca es publica: no existe counterpart en public-business.routes.
router.get('/preview/:slug', async (req: AuthRequest, res) => {
  const slug = String(req.params.slug);
  // Ownership por slug: ADMIN ve cualquiera; el owner solo los suyos.
  const where = req.user!.role === 'ADMIN' ? { slug } : { slug, ownerId: req.user!.id };
  const b = await prisma.business.findFirst({
    where,
    include: {
      template: { select: { code: true, name: true, category: true, capabilities: true } },
      services: { orderBy: { order: 'asc' } },
      gallery: { orderBy: { position: 'asc' } },
      properties: { include: { images: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const products = await prisma.product.findMany({
    where: { businessId: b.id, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  const { ownerId: _ownerId, ...publicShape } = b as any;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ business: publicShape, services: b.services, products, properties: b.properties, gallery: b.gallery });
});

router.get('/:id', requireBusinessOwner, async (req: AuthRequest, res) => {
  const b = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: { template: true, services: { orderBy: { order: 'asc' } }, gallery: { orderBy: { position: 'asc' } }, properties: { include: { images: { orderBy: { position: 'asc' } } } } },
  });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.json({ business: b, completeness: businessCompleteness(b) });
});
router.put('/:id', requireBusinessOwner, updateBusiness);
router.delete('/:id', requireBusinessOwner, async (req: AuthRequest, res) => {
  const { archiveBusiness } = await import('../controllers/business.controller');
  return archiveBusiness(req, res);
});

// Upload de imagenes (Supabase Storage). Body binario image/* hasta 5MB;
// el tipo real se valida por magic bytes en lib/storage. Nunca guarda en PG.
router.post(
  '/:id/upload',
  requireBusinessOwner,
  raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'], limit: MAX_UPLOAD_BYTES }),
  async (req: AuthRequest, res) => {
    const businessId = String(req.params.id);
    const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
    if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
    const kind = String((req.query as any).kind || '');
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length === 0) {
      res.status(400).json({ message: 'Archivo invalido: envia una imagen JPG/PNG/WEBP/GIF/AVIF de maximo 5MB' });
      return;
    }
    try {
      const url = await uploadBusinessImage({ businessId, kind, buffer });
      res.json({ url });
    } catch (e: any) {
      res.status(e?.status || 500).json({ message: e?.message || 'Error subiendo imagen' });
    }
  },
);


router.get('/:businessId/services', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const services = await prisma.businessService.findMany({ where: { businessId }, orderBy: { order: 'asc' } });
  res.json({ services });
});

router.post('/:businessId/services', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const s = await prisma.businessService.create({ data: { businessId, ...(parsed.data as any), description: cleanDescription((parsed.data as any).description) ?? null } as any });
  res.status(201).json({ service: s });
});

router.put('/:businessId/services/:serviceId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = serviceSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const data: any = { ...(parsed.data as any) };
  if (data.description !== undefined) data.description = cleanDescription(data.description) ?? null;
  const r = await prisma.businessService.updateMany({ where: { id: String(req.params.serviceId), businessId }, data });
  if (!r.count) { res.status(404).json({ message: 'Servicio no encontrado' }); return; }
  const updated = await prisma.businessService.findFirst({ where: { id: String(req.params.serviceId), businessId } });
  res.json({ service: updated });
});

router.delete('/:businessId/services/:serviceId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  await prisma.businessService.deleteMany({ where: { id: String(req.params.serviceId), businessId } });
  res.json({ deleted: true });
});
router.get('/:businessId/products', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const products = await prisma.product.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ products });
});

router.post('/:businessId/products', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const { name, salePrice, stock, images, description } = (req.body || {}) as any;
  if (!name || salePrice == null) { res.status(400).json({ message: 'name y salePrice requeridos' }); return; }
  const { slugify } = await import('../utils/business');
  let candidate = slugify(String((req.body as any).slug || name));
  let n = 0;
  for (;;) {
    const s = n === 0 ? candidate : `${candidate}-${n}`;
    const exists = await prisma.product.findUnique({ where: { slug: s } });
    if (!exists) { candidate = s; break; }
    n += 1;
  }
  let categoryId = (req.body as any).categoryId;
  if (!categoryId) {
    const general = await prisma.category.findFirst({ where: { slug: 'general' } });
    categoryId = general?.id || (await prisma.category.create({ data: { name: 'General', slug: `general-${Date.now()}` } })).id;
  }
  const created = await prisma.product.create({
    data: {
      name: String(name), slug: candidate,
      description: cleanDescription(description) || String(name),
      images: Array.isArray(images) ? images : [],
      categoryId, variants: [],
      stock: Number(stock) || 0,
      productCost: Number((req.body as any).productCost) || Number(salePrice) || 0,
      totalCost: Number((req.body as any).totalCost) || Number(salePrice) || 0,
      salePrice: Number(salePrice), margin: 0,
      status: 'PUBLISHED' as any, businessId,
    } as any,
  });
  res.status(201).json({ product: created });
});

router.put('/:businessId/products/:productId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const existing = await prisma.product.findFirst({ where: { id: String(req.params.productId), businessId } });
  if (!existing) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
  const allowed: any = {};
  for (const k of ['name', 'description', 'salePrice', 'stock', 'images', 'status']) {
    if ((req.body as any)[k] !== undefined) allowed[k] = (req.body as any)[k];
  }
  if (allowed.description) allowed.description = cleanDescription(allowed.description);
  const updated = await prisma.product.update({ where: { id: existing.id }, data: allowed });
  res.json({ product: updated });
});

// DELETE de producto Business. Si existe integridad referencial (ordenes),
// cae a borrado logico (ARCHIVED + hidden) para no romper la tienda.
router.delete('/:businessId/products/:productId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const where = { id: String(req.params.productId), businessId };
  try {
    const r = await prisma.product.deleteMany({ where });
    if (!r.count) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
    res.json({ deleted: true, mode: 'HARD' });
  } catch {
    const u = await prisma.product.updateMany({ where, data: { status: 'ARCHIVED' as any, hidden: true } });
    if (!u.count) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
    res.json({ deleted: true, mode: 'ARCHIVED' });
  }
});

router.get('/:businessId/properties', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const properties = await prisma.property.findMany({ where: { businessId }, include: { images: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  res.json({ properties });
});

router.post('/:businessId/properties', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const { images, ...rest } = (parsed.data as any);
  const created = await prisma.property.create({
    data: {
      businessId, ...(rest as any),
      description: cleanDescription((rest as any).description) ?? null,
      ...(images ? { images: { create: (images as string[]).map((url: string, position: number) => ({ url, position })) } } : {}),
    } as any,
    include: { images: true },
  });
  res.status(201).json({ property: created });
});

router.put('/:businessId/properties/:propertyId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = propertySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const existing = await prisma.property.findFirst({ where: { id: String(req.params.propertyId), businessId } });
  if (!existing) { res.status(404).json({ message: 'Propiedad no encontrada' }); return; }
  const { images, ...rest } = (parsed.data as any);
  const updated = await prisma.property.update({
    where: { id: existing.id },
    data: {
      ...(rest as any),
      ...((rest as any).description !== undefined ? { description: cleanDescription((rest as any).description) ?? null } : {}),
      ...(images ? { images: { deleteMany: {}, create: (images as string[]).map((url: string, position: number) => ({ url, position })) } } : {}),
    } as any,
    include: { images: true },
  });
  res.json({ property: updated });
});

router.delete('/:businessId/properties/:propertyId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const r = await prisma.property.deleteMany({ where: { id: String(req.params.propertyId), businessId } });
  if (!r.count) { res.status(404).json({ message: 'Propiedad no encontrada' }); return; }
  res.json({ deleted: true });
});

router.put('/:businessId/gallery', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = gallerySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  await prisma.businessGalleryImage.deleteMany({ where: { businessId } });
  await prisma.businessGalleryImage.createMany({
    data: parsed.data.images.map((img, position) => ({ businessId, url: img.url, alt: img.alt || null, position })),
  });
  const gallery = await prisma.businessGalleryImage.findMany({ where: { businessId }, orderBy: { position: 'asc' } });
  res.json({ gallery });
});

router.get('/:businessId/leads', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const leads = await prisma.businessLead.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ leads });
});

router.get('/:businessId/stats', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const stats = await prisma.businessStatDaily.findMany({ where: { businessId }, orderBy: { date: 'asc' }, take: 90 });
  const totals = stats.reduce((acc: any, s: any) => {
    acc.pageViews += s.pageViews; acc.waClicks += s.waClicks; acc.phoneClicks += s.phoneClicks;
    acc.emailClicks += s.emailClicks; acc.leads += s.leads; acc.productViews += s.productViews; acc.propertyViews += s.propertyViews;
    return acc;
  }, { pageViews: 0, waClicks: 0, phoneClicks: 0, emailClicks: 0, leads: 0, productViews: 0, propertyViews: 0 });
  res.json({ stats, totals });
});

router.get('/admin/all', authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  const businesses = await prisma.business.findMany({ orderBy: { updatedAt: 'desc' }, include: { template: true, owner: { select: { id: true, email: true, name: true } } } });
  res.json({ businesses });
});

export default router;
