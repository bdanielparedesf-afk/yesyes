import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { leadSchema } from '../utils/business';

const router = Router();
const leadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const PUBLIC_SELECT = {
  id: true, name: true, slug: true, category: true, status: true,
  logo: true, cover: true, description: true, phone: true, whatsapp: true,
  email: true, address: true, city: true, region: true, mapsUrl: true,
  lat: true, lng: true, hours: true, socials: true, cta: true,
  seoTitle: true, seoDescription: true, ogImage: true, canonical: true,
  templateId: true, publishedAt: true,
  template: { select: { code: true, name: true, category: true, capabilities: true } },
} as const;
async function publishedBySlug(slug: string) {
  return prisma.business.findFirst({ where: { slug: String(slug), status: 'PUBLISHED' as any }, select: PUBLIC_SELECT });
}
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
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const lead = await prisma.businessLead.create({ data: { businessId: b.id, ...(parsed.data as any) } as any });
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


