import { Router, raw } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth';
import { requireBusinessOwner, ownerWhere } from '../middlewares/businessAuth';
import { businessUpsertSchema, cleanDescription, serviceSchema, propertySchema, gallerySchema, catalogItemSchema, teamMemberSchema, testimonialSchema, faqSchema, promotionSchema, bookingSlotSchema, bookingStatusSchema } from '../utils/business';
import { uniqueBusinessSlugFor, businessCompleteness } from '../services/business.service';
import { createBusiness, updateBusiness } from '../controllers/business.controller';
import { uploadBusinessImage, MAX_UPLOAD_BYTES } from '../lib/storage';
import { mediaOwnerDTO } from '../services/business-media.service';
import {
  publishBusiness,
  pauseBusiness,
  archiveBusinessSoft,
  businessBillingOverview,
} from '../services/business-publish.service';
import { createPreviewToken } from '../services/business-preview.service';
import { toSubscriptionDTO } from '../services/business-subscription.service';
import { isCapabilityCode, normalizeSections, resolveCapabilities, CAPABILITY_CATALOG } from '../utils/business-capabilities';
import { templateDisplayName, templateFamilyCodes, templateStyleOf } from '../utils/business-taxonomy';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const where = req.user!.role === 'ADMIN' ? {} : { ownerId: req.user!.id };
  const businesses = await prisma.business.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      template: true,
      subscription: { include: { plan: true } },
    },
  });
  res.json({ businesses });
});
router.post('/', createBusiness);

// Listado de plantillas activas para el picker del dashboard.
// IMPORTANTE: debe ir ANTES de GET /:id, si no '/templates' se captura como id.
// `label`/`style` son legibles; `code` y `capabilities` se conservan por compatibilidad.
router.get('/templates', async (req: AuthRequest, res) => {
  const category = req.query.category ? String(req.query.category) : undefined;
  const templates = await prisma.businessTemplate.findMany({
    where: { active: true, ...(category ? { category: { in: templateFamilyCodes(category) as any } } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, name: true, category: true, capabilities: true, style: true, legacy: true, previewImage: true },
  });
  res.json({
    templates: templates.map((template) => ({
      ...template,
      label: templateDisplayName(template),
      styleLabel: templateStyleOf(template.code, template.style),
    })),
  });
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
      // El manifest V2 del negocio: es lo que compone el renderer único en la
      // vista previa, con exactamente los mismos bloques que la página pública.
      siteInstance: { select: { manifest: true, manifestVersion: true, legacyCompatibility: true } },
      services: { orderBy: { order: 'asc' } },
      gallery: { orderBy: { position: 'asc' } },
      properties: { include: { images: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } },
      testimonials: { where: { active: true }, orderBy: { order: 'asc' } },
      faqs: { where: { active: true }, orderBy: { order: 'asc' } },
      promotions: { where: { active: true }, orderBy: { order: 'asc' } },
      teamMembers: { where: { active: true }, orderBy: { order: 'asc' } },
      bookingSlots: { where: { active: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
    },
  });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const products = await prisma.businessCatalogItem.findMany({
    where: { businessId: b.id, active: true },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  const { ownerId: _ownerId, ...publicShape } = b as any;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ business: publicShape, services: b.services, products, properties: b.properties, gallery: b.gallery, testimonials: b.testimonials, faqs: b.faqs, promotions: b.promotions, team: b.teamMembers, bookingSlots: b.bookingSlots });
});

router.post('/:id/publish', requireBusinessOwner, async (req: AuthRequest, res) => {
  const result = await publishBusiness({ businessId: String(req.params.id), userId: req.user!.id, ip: req.ip, isAdmin: req.user!.role === 'ADMIN' });
  if (!result.ok) {
    res.status(result.error.status).json({ code: result.error.code, message: result.error.message, checklist: result.checklist });
    return;
  }
  res.json({ business: result.business, checklist: result.checklist, subscription: result.subscription ? toSubscriptionDTO(result.subscription, result.business.id) : null });
});

router.post('/:id/pause', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await pauseBusiness({ businessId: String(req.params.id), userId: req.user!.id, ip: req.ip, reason: String((req.body as any)?.reason || 'owner') });
  res.json({ business });
});

router.post('/:id/archive', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await archiveBusinessSoft({ businessId: String(req.params.id), userId: req.user!.id, ip: req.ip });
  res.json({ business, archived: true });
});

router.post('/:id/preview', requireBusinessOwner, async (req: AuthRequest, res) => {
  const preview = await createPreviewToken({ businessId: String(req.params.id), createdBy: req.user!.id });
  const business = await prisma.business.findUnique({ where: { id: String(req.params.id) }, select: { slug: true } });
  res.json({ ...preview, url: business ? `/mi-negocio/${business.slug}?preview=${encodeURIComponent(preview.token)}` : undefined });
});

router.get('/:id/capabilities', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: { template: { select: { capabilities: true } } },
  });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const category = await prisma.businessCategory.findUnique({ where: { code: business.category }, select: { defaultCapabilities: true } });
  const resolved = resolveCapabilities({ templateCapabilities: business.template?.capabilities, categoryDefaults: category?.defaultCapabilities, savedSections: (business.visual as any)?.sections });
  res.json({ ...resolved, catalog: CAPABILITY_CATALOG });
});

router.put('/:id/capabilities', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: { template: { select: { capabilities: true } } },
  });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const category = await prisma.businessCategory.findUnique({ where: { code: business.category }, select: { defaultCapabilities: true } });
  const available = resolveCapabilities({ templateCapabilities: business.template?.capabilities, categoryDefaults: category?.defaultCapabilities }).available;
  const raw = (req.body as any)?.sections;
  if (!Array.isArray(raw)) { res.status(400).json({ message: 'sections debe ser un arreglo' }); return; }
  if (raw.some((s: any) => s && (typeof s.id !== 'string' || !isCapabilityCode(s.id)))) { res.status(400).json({ message: 'Capability invalida' }); return; }
  if (raw.some((s: any) => s && (!Number.isInteger(Number(s.order)) || Number(s.order) < 1 || Number(s.order) > 10000))) { res.status(400).json({ message: 'Orden invalido' }); return; }
  const sections = normalizeSections(raw, available).map(({ id, enabled, order }) => ({ id, enabled, order }));
  const visual = (business.visual && typeof business.visual === 'object' ? business.visual : {}) as Record<string, unknown>;
  const updated = await prisma.business.update({ where: { id: business.id }, data: { visual: { ...visual, sections } }, select: { id: true, visual: true } });
  res.json({ sections: (updated.visual as any)?.sections || [], available, catalog: CAPABILITY_CATALOG });
});

router.get('/:id/billing', requireBusinessOwner, async (req: AuthRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ billing: await businessBillingOverview(String(req.params.id)) });
});

router.get('/:id', requireBusinessOwner, async (req: AuthRequest, res) => {
  const b = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: {
      template: true,
      services: { orderBy: { order: 'asc' } },
      gallery: { orderBy: { position: 'asc' } },
      properties: { include: { images: { orderBy: { position: 'asc' } } } },
      // La instancia de sitio es el manifest que compone el renderer. Sin esto
      // el editor no podría cambiar diseño, variantes ni secciones.
      siteInstance: { select: { manifest: true, manifestVersion: true, legacyCompatibility: true, updatedAt: true } },
      // FASE 6 — el catálogo de medios del negocio. El editor lo necesita para
      // que el picker de imagen/video ofrezca lo que ya está subido, y para
      // resolver `media:<id>` al pintar el borrador.
      media: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.json({ business: { ...(b as any), media: (b as any).media.map((row: any) => mediaOwnerDTO(row)) }, completeness: businessCompleteness(b) });
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
// Catálogo propio del Business: nunca consulta Product, Category ni Store.
router.get('/:businessId/products', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const products = await prisma.businessCatalogItem.findMany({ where: { businessId }, orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }], take: 100 });
  res.json({ products });
});

router.post('/:businessId/products', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = catalogItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Datos de producto inválidos' }); return; }
  const body = parsed.data as Record<string, any>;
  const { slugify } = await import('../utils/business');
  const base = slugify(body.slug || body.name);
  let slug = base;
  for (let suffix = 0; await prisma.businessCatalogItem.findFirst({ where: { businessId, slug } }); suffix += 1) slug = `${base}-${suffix + 1}`;
  const created = await prisma.businessCatalogItem.create({ data: {
    businessId, name: body.name, slug,
    description: cleanDescription(body.description) ?? null,
    shortDescription: cleanDescription(body.shortDescription) ?? null,
    price: body.price, compareAtPrice: body.compareAtPrice ?? null,
    currency: body.currency || 'CLP', image: body.image || null,
    additionalImages: body.additionalImages || [],
    category: body.category || null, featured: body.featured ?? false, active: body.active !== false,
    sortOrder: body.sortOrder ?? 0, cta: body.cta || null, metadata: body.metadata ? body.metadata as any : undefined,
  } });
  res.status(201).json({ product: created });
});

router.put('/:businessId/products/:productId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const productId = String(req.params.productId);
  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const existing = await prisma.businessCatalogItem.findFirst({ where: { id: productId, businessId } });
  if (!existing) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
  const partial = catalogItemSchema.partial().safeParse(req.body);
  if (!partial.success) { res.status(400).json({ message: 'Datos de producto inválidos' }); return; }
  const body = partial.data as Record<string, any>;
  const data: any = {};
  for (const key of ['name', 'image', 'category', 'cta', 'currency']) if (body[key] !== undefined) data[key] = body[key] || null;
  for (const key of ['description', 'shortDescription']) if (body[key] !== undefined) data[key] = cleanDescription(body[key]) || null;
  for (const key of ['price', 'compareAtPrice', 'sortOrder']) if (body[key] !== undefined) data[key] = body[key];
  for (const key of ['featured', 'active']) if (body[key] !== undefined) data[key] = body[key];
  if (body.additionalImages !== undefined) data.additionalImages = body.additionalImages;
  if (body.metadata !== undefined) data.metadata = body.metadata ? body.metadata as any : undefined;
  const updated = await prisma.businessCatalogItem.update({ where: { id: existing.id }, data });
  res.json({ product: updated });
});

router.post('/:businessId/products/:productId/duplicate', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const source = await prisma.businessCatalogItem.findFirst({ where: { id: String(req.params.productId), businessId } });
  if (!source) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
  const { slugify } = await import('../utils/business');
  const base = `${source.slug}-copia`; let slug = base;
  for (let i = 0; await prisma.businessCatalogItem.findFirst({ where: { businessId, slug } }); i += 1) slug = `${base}-${i + 1}`;
  const { id, createdAt, updatedAt, metadata: _metadata, ...rest } = source;
  res.status(201).json({ product: await prisma.businessCatalogItem.create({ data: { ...rest, slug, name: `${source.name} (copia)`, featured: false } }) });
});

router.delete('/:businessId/products/:productId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const r = await prisma.businessCatalogItem.deleteMany({ where: { id: String(req.params.productId), businessId } });
  if (!r.count) { res.status(404).json({ message: 'Producto no encontrado' }); return; }
  res.json({ deleted: true, mode: 'HARD' });
});

router.get('/:businessId/content', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  if (!(await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } }))) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const [testimonials, faqs, promotions, team] = await Promise.all([
    prisma.businessTestimonial.findMany({ where: { businessId }, orderBy: { order: 'asc' } }),
    prisma.businessFaq.findMany({ where: { businessId }, orderBy: { order: 'asc' } }),
    prisma.businessPromotion.findMany({ where: { businessId }, orderBy: { order: 'asc' } }),
    prisma.businessTeamMember.findMany({ where: { businessId }, orderBy: { order: 'asc' } }),
  ]);
  res.json({ testimonials, faqs, promotions, team });
});

router.post('/:businessId/content/:section', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  if (!(await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } }))) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const section = String(req.params.section);
  const schema = section === 'testimonials' ? testimonialSchema : section === 'faqs' ? faqSchema : section === 'promotions' ? promotionSchema : section === 'team' ? teamMemberSchema : null;
  if (!schema) { res.status(404).json({ message: 'Tipo de contenido inválido' }); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Contenido inválido' }); return; }
  const data = parsed.data as Record<string, any>;
  const model = section === 'testimonials' ? prisma.businessTestimonial : section === 'faqs' ? prisma.businessFaq : section === 'promotions' ? prisma.businessPromotion : prisma.businessTeamMember;
  const item = await (model as any).create({ data: { businessId, ...data, socials: data.socials ? data.socials as any : undefined } });
  res.status(201).json({ item });
});


router.get('/:businessId/properties', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
router.put('/:businessId/content/:section/:itemId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const section = String(req.params.section);
  const itemId = String(req.params.itemId);
  const schema = section === 'testimonials' ? testimonialSchema : section === 'faqs' ? faqSchema : section === 'promotions' ? promotionSchema : section === 'team' ? teamMemberSchema : null;
  if (!schema) { res.status(404).json({ message: 'Tipo de contenido inválido' }); return; }
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Contenido inválido' }); return; }
  const model = section === 'testimonials' ? prisma.businessTestimonial : section === 'faqs' ? prisma.businessFaq : section === 'promotions' ? prisma.businessPromotion : prisma.businessTeamMember;
  const existing = await (model as any).findFirst({ where: { id: itemId, businessId } });
  if (!existing) { res.status(404).json({ message: 'Contenido no encontrado' }); return; }
  const data = parsed.data as Record<string, any>;
  const item = await (model as any).update({ where: { id: itemId }, data: { ...data, socials: data.socials === undefined ? undefined : data.socials as any } });
  res.json({ item });
});

router.delete('/:businessId/content/:section/:itemId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const section = String(req.params.section);
  if (!['testimonials', 'faqs', 'promotions', 'team'].includes(section)) { res.status(404).json({ message: 'Tipo de contenido inválido' }); return; }
  const model = section === 'testimonials' ? prisma.businessTestimonial : section === 'faqs' ? prisma.businessFaq : section === 'promotions' ? prisma.businessPromotion : prisma.businessTeamMember;
  const result = await (model as any).deleteMany({ where: { id: String(req.params.itemId), businessId } });
  if (!result.count) { res.status(404).json({ message: 'Contenido no encontrado' }); return; }
  res.json({ deleted: true });
});


  const b = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const properties = await prisma.property.findMany({ where: { businessId }, include: { images: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  res.json({ properties });
});

router.post('/:businessId/properties', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
router.get('/:businessId/bookings', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  if (!(await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } }))) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.json({ bookings: await prisma.booking.findMany({ where: { businessId }, orderBy: [{ date: 'desc' }, { time: 'desc' }], take: 300 }) });
});

router.put('/:businessId/bookings/:bookingId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  const bookingId = String(req.params.bookingId);
  if (!(await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } }))) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Estado de reserva inválido' }); return; }
  const result = await prisma.booking.updateMany({ where: { id: bookingId, businessId }, data: { status: parsed.data.status } });
  if (!result.count) { res.status(404).json({ message: 'Reserva no encontrada' }); return; }
  res.json({ booking: await prisma.booking.findFirst({ where: { id: bookingId, businessId } }) });
});

router.get('/:businessId/booking-slots', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  if (!(await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } }))) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.json({ slots: await prisma.bookingSlot.findMany({ where: { businessId }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }) });
});

router.put('/:businessId/booking-slots', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = String(req.params.businessId);
  if (!(await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } }))) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const parsed = z.array(bookingSlotSchema).max(80).safeParse(req.body?.slots);
  if (!parsed.success) { res.status(400).json({ message: 'Horarios inválidos' }); return; }
  await prisma.$transaction(async (tx) => {
    await tx.bookingSlot.deleteMany({ where: { businessId } });
    if (parsed.data.length) await tx.bookingSlot.createMany({ data: parsed.data.map((slot) => ({ businessId, ...slot })) });
  });
  res.json({ slots: await prisma.bookingSlot.findMany({ where: { businessId }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }) });
});


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
