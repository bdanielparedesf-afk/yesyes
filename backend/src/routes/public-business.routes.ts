import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { leadSchema } from '../utils/business';
import { checkSpam } from '../utils/business-antispam';
import { validatePreviewToken } from '../services/business-preview.service';

const router = Router();
const leadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const PUBLIC_SELECT = {
  id: true, name: true, slug: true, category: true, status: true,
  logo: true, cover: true, description: true, phone: true, whatsapp: true,
  email: true, address: true, city: true, region: true, mapsUrl: true,
  lat: true, lng: true, hours: true, socials: true, cta: true, visual: true,
  seoTitle: true, seoDescription: true, ogImage: true, canonical: true,
  templateId: true, publishedAt: true,
  template: { select: { code: true, name: true, category: true, capabilities: true } },
} as const;
async function publishedBySlug(slug: string) {
  return prisma.business.findFirst({ where: { slug: String(slug), status: 'PUBLISHED' as any }, select: PUBLIC_SELECT });
}
async function previewPayload(businessId: string) {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true, name: true, slug: true, category: true, status: true,
      logo: true, cover: true, description: true, phone: true, whatsapp: true,
      email: true, address: true, city: true, region: true, mapsUrl: true,
      lat: true, lng: true, hours: true, socials: true, cta: true,
      seoTitle: true, seoDescription: true, ogImage: true, canonical: true,
      templateId: true, publishedAt: true, visual: true,
      template: { select: { code: true, name: true, category: true, capabilities: true } },
      services: { orderBy: { order: 'asc' } },
      gallery: { orderBy: { position: 'asc' } },
      properties: { include: { images: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!b) return null;
  const products = await prisma.product.findMany({
    where: { businessId: b.id, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return { business: b, services: b.services, products, properties: b.properties, gallery: b.gallery };
}
router.get('/:slug/preview', async (req, res) => {
  const token = String(req.query.token || '');
  const check = await validatePreviewToken(token);
  const b = check.valid
    ? await prisma.business.findUnique({ where: { id: check.businessId }, select: { id: true, slug: true } })
    : null;
  if (!b || b.slug !== String(req.params.slug)) {
    res.status(404).json({ message: 'Vista previa no encontrada' });
    return;
  }
  const payload = await previewPayload(b.id);
  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});
router.get('/:slug', async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({ business: b });
});
router.get('/:slug/services', async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const services = await prisma.businessService.findMany({ where: { businessId: b.id, active: true }, orderBy: { order: 'asc' } });
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({ services });
});
router.get('/:slug/products', async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const products = await prisma.product.findMany({
    where: { businessId: b.id, status: 'PUBLISHED' },
    select: { id: true, name: true, slug: true, description: true, images: true, salePrice: true, stock: true },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({ products });
});
router.get('/:slug/gallery', async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const gallery = await prisma.businessGalleryImage.findMany({ where: { businessId: b.id }, orderBy: { position: 'asc' } });
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({ gallery });
});
router.get('/:slug/properties', async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const q = req.query as any;
  const where: any = { businessId: b.id, published: true, available: true };
  if (q.operation) where.operation = String(q.operation);
  if (q.type) where.type = String(q.type);
  if (q.city) where.city = { contains: String(q.city), mode: 'insensitive' };
  // Filtros numericos opcionales (precio, dormitorios, banos, estacionamientos, superficie).
  const num = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const price: any = {};
  const minPrice = num(q.minPrice);
  const maxPrice = num(q.maxPrice);
  if (minPrice != null) price.gte = minPrice;
  if (maxPrice != null) price.lte = maxPrice;
  if (Object.keys(price).length) where.price = price;
  const bedrooms = num(q.bedrooms);
  if (bedrooms != null) where.bedrooms = { gte: bedrooms };
  const bathrooms = num(q.bathrooms);
  if (bathrooms != null) where.bathrooms = { gte: bathrooms };
  const parking = num(q.parking);
  if (parking != null) where.parking = { gte: parking };
  const minArea = num(q.minArea);
  if (minArea != null) where.areaTotal = { gte: minArea };
  if (q.featured === '1' || q.featured === 'true') where.featured = true;
  const properties = await prisma.property.findMany({ where, include: { images: { orderBy: { position: 'asc' } } }, take: 100 });
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({ properties });
});
router.get('/:slug/properties/:propertyId', async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const property = await prisma.property.findFirst({
    where: { id: String(req.params.propertyId), businessId: b.id, published: true },
    include: { images: { orderBy: { position: 'asc' } } },
  });
  if (!property) { res.status(404).json({ message: 'Propiedad no encontrada' }); return; }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({ property });
});
router.post('/:slug/leads', leadLimiter, async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};
  const spam = checkSpam(body, {
    name: typeof body.name === 'string' ? body.name : null,
    email: typeof body.email === 'string' ? body.email : null,
    phone: typeof body.phone === 'string' ? body.phone : null,
    message: typeof body.message === 'string' ? body.message : null,
    honeypot: typeof body.website === 'string' ? body.website : null,
  });
  if (spam.spam) {
    res.status(202).json({ accepted: true });
    return;
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const { website: _website, ...leadData } = parsed.data as any;
  const lead = await prisma.businessLead.create({ data: { businessId: b.id, ...leadData } as any });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.businessStatDaily.upsert({
    where: { businessId_date: { businessId: b.id, date: today } },
    update: { leads: { increment: 1 } },
    create: { businessId: b.id, date: today, leads: 1 },
  });
  res.status(201).json({ lead: { id: lead.id } });
});
router.post('/:slug/track', leadLimiter, async (req, res) => {
  const b = await publishedBySlug(String(req.params.slug));
  if (!b) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const event = String((req.body as any)?.event || '').toUpperCase();
  const map: Record<string, string> = {
    PAGE_VIEW: 'pageViews', WHATSAPP_CLICK: 'waClicks', PHONE_CLICK: 'phoneClicks',
    EMAIL_CLICK: 'emailClicks', LEAD_CREATED: 'leads', PRODUCT_VIEW: 'productViews',
    PROPERTY_VIEW: 'propertyViews', CONTACT_CLICK: 'phoneClicks',
  };
  const field = map[event];
  if (!field) { res.status(400).json({ message: 'Evento invalido' }); return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.businessStatDaily.upsert({
    where: { businessId_date: { businessId: b.id, date: today } },
    update: { [field]: { increment: 1 } } as any,
    create: { businessId: b.id, date: today, [field]: 1 } as any,
  });
  res.json({ ok: true });
});
export default router;


