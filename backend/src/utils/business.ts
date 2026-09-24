import { z } from 'zod';

export const BUSINESS_RESERVED_SLUGS = [
  'mi-negocio', 'negocio', 'negocios', 'productos', 'producto', 'categoria',
  'categorias', 'carrito', 'checkout', 'perfil', 'admin', 'login', 'register',
  'api', 'assets', 'buscar', 'ofertas', 'favoritos', 'contacto',
] as const;

export function slugify(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'negocio';
}

export function isReservedSlug(slug: string): boolean {
  return (BUSINESS_RESERVED_SLUGS as readonly string[]).includes(String(slug).toLowerCase());
}

export function buildWaLink(phone: string | null | undefined, message: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  let normalized = digits;
  if (normalized.length === 9) normalized = '56' + normalized;
  else if (normalized.length === 11 && normalized.startsWith('569')) normalized = '56' + normalized.slice(2);
  else if (normalized.length === 12 && normalized.startsWith('56')) normalized = normalized;
  else if (normalized && !normalized.startsWith('56') && normalized.length <= 11) normalized = '56' + normalized.replace(/^0+/, '');
  const clean = (normalized || '').replace(/\D/g, '') || '56900000000';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function cleanDescription(input: unknown): string | undefined {
  if (input == null) return undefined;
  const text = String(input).slice(0, 20000);
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export const businessUpsertSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
  category: z.enum(['HAIR','BARBER','BAKERY','FLOWERS','FOOD','BOUTIQUE','FURNITURE','REAL_ESTATE','MECHANIC','PHONE','CLEANING','PHOTO','TUTORING','CONSTRUCTION','BEAUTY','PET','DETAILING']),
  templateId: z.string().uuid().nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  whatsapp: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  mapsUrl: z.string().url().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  hours: z.any().nullable().optional(),
  socials: z.any().nullable().optional(),
  cta: z.any().nullable().optional(),
  settings: z.any().nullable().optional(),
  visual: z.record(z.unknown()).nullable().optional(),
  logo: z.string().url().nullable().optional(),
  cover: z.string().url().nullable().optional(),
  seoTitle: z.string().max(160).nullable().optional(),
  seoDescription: z.string().max(320).nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
  canonical: z.string().url().nullable().optional(),
}).strict();

export const safeUrlSchema = z.string().url().max(2048).refine(
  (value) => ['http:', 'https:'].includes(new URL(value).protocol),
  { message: 'URL inválida: solo se permiten http(s)' },
);

export const catalogItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(100).optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  image: safeUrlSchema.nullable().optional(),
  additionalImages: z.array(safeUrlSchema).max(12).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  cta: z.string().trim().max(80).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
}).strict();

export const serviceSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(10000).nullable().optional(),
  image: z.string().url().nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  durationMin: z.number().int().positive().nullable().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
}).strict();

export const propertySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(20000).nullable().optional(),
  price: z.number().nonnegative(),
  currency: z.string().max(8).optional(),
  operation: z.enum(['VENTA','ARRIENDO']),
  type: z.enum(['CASA','DEPARTAMENTO','TERRENO','OFICINA','LOCAL','PARCELA','BODEGA']),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  bedrooms: z.number().int().nonnegative().nullable().optional(),
  bathrooms: z.number().int().nonnegative().nullable().optional(),
  parking: z.number().int().nonnegative().nullable().optional(),
  areaBuilt: z.number().nonnegative().nullable().optional(),
  areaTotal: z.number().nonnegative().nullable().optional(),
  features: z.array(z.string().max(80)).max(50).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  agent: z.string().max(160).nullable().optional(),
  featured: z.boolean().optional(),
  available: z.boolean().optional(),
  published: z.boolean().optional(),
  images: z.array(z.string().url()).max(20).optional(),
}).strict();

export const leadSchema = z.object({
  type: z.enum(['RESERVA','COTIZACION','CONSULTA','PEDIDO','PROPERTY_INQUIRY']),
  name: z.string().max(160).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  message: z.string().max(5000).nullable().optional(),
  payload: z.any().nullable().optional(),
  waClick: z.boolean().optional(),
}).strict();

export const roleUpdateSchema = z.object({
  role: z.enum(['CUSTOMER','BUSINESS','ADMIN']),
}).strict();

export const gallerySchema = z.object({
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().max(160).nullable().optional(),
    title: z.string().max(160).nullable().optional(),
    description: z.string().max(400).nullable().optional(),
    category: z.string().max(80).nullable().optional(),
  })).max(60),
}).strict();

/* ----------------------- Modulos de contenido ----------------------- */

const optionalUrl = z.string().url().max(2048).nullable().optional();
const optionalText = (max = 4000) => z.string().max(max).nullable().optional();

export const teamMemberSchema = z.object({
  name: z.string().min(1).max(160),
  role: optionalText(160),
  bio: optionalText(4000),
  photo: optionalUrl,
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  socials: z.record(safeUrlSchema).nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
}).strict();

export const testimonialSchema = z.object({
  name: z.string().min(1).max(160),
  role: optionalText(160),
  content: z.string().min(2).max(4000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  photo: optionalUrl,
  active: z.boolean().optional(),
  order: z.number().int().optional(),
}).strict();

export const faqSchema = z.object({
  question: z.string().min(2).max(300),
  answer: z.string().min(2).max(4000),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
}).strict();

export const promotionSchema = z.object({
  title: z.string().min(2).max(200),
  description: optionalText(2000),
  image: optionalUrl,
  discountType: z.enum(['PERCENTAGE', 'FIXED', 'TEXT_ONLY']).optional(),
  discountValue: z.number().nonnegative().nullable().optional(),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
}).strict();

export const bookingSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)'),
  active: z.boolean().optional(),
}).strict();

export const bookingCreateSchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  serviceName: z.string().max(160).nullable().optional(),
  date: z.coerce.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)'),
  name: z.string().min(2).max(160),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  message: optionalText(2000),
  /** Honeypot: si viene con valor, el backend descarta la reserva. */
  website: z.string().max(200).optional(),
}).strict();

export const bookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
}).strict();

export const reviewCreateSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(2).max(2000),
  website: z.string().max(200).optional(),
}).strict();

export const reviewModerationSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
}).strict();

export const blogPostSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().max(120).optional(),
  excerpt: optionalText(400),
  content: z.string().min(2).max(50000),
  cover: optionalUrl,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
}).strict();

export const businessEventSchema = z.object({
  title: z.string().min(2).max(200),
  description: optionalText(4000),
  cover: optionalUrl,
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  location: optionalText(200),
  url: safeUrlSchema.nullable().optional(),
  active: z.boolean().optional(),
}).strict();
