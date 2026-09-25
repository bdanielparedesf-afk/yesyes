import { ALL_BUSINESS_CATEGORY_CODES, categoryDef, BUSINESS_CATEGORY_CODES } from './taxonomy';
import { buildWaLink } from '@/services/business';

/**
 * Labels visibles centralizados. Las categorías NO se redefinen aquí: viven en
 * `taxonomy.ts` (fuente única) y este archivo solo adapta la forma esperada por
 * los componentes (mapa por código + funciones con fallback).
 */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  ALL_BUSINESS_CATEGORY_CODES.map((code) => [code, categoryDef(code)?.label || 'Negocio']),
);


export const SECTION_LABELS: Record<string, string> = {
  HERO: 'Presentación', ABOUT: 'Sobre el negocio', SERVICES: 'Servicios', PRICING: 'Precios',
  PRODUCTS: 'Productos', CATALOG: 'Catálogo', PROPERTIES: 'Propiedades', GALLERY: 'Galería', PORTFOLIO: 'Portafolio',
  BEFORE_AFTER: 'Antes y después', PROMOTIONS: 'Promociones', DELIVERY: 'Envío a domicilio', PICKUP: 'Retiro en tienda',
  OPENING_HOURS: 'Horarios', MAP: 'Ubicación', CONTACT: 'Contacto', CONTACT_FORM: 'Formulario de contacto',
  WHATSAPP: 'WhatsApp', SOCIALS: 'Redes sociales', CTA: 'Llamado a la acción', TESTIMONIALS: 'Opiniones',
  FAQ: 'Preguntas frecuentes', TEAM: 'Equipo', BOOKING: 'Reservas', BRANDS: 'Marcas', FEATURES: 'Características',
  REPAIR: 'Reparaciones', SUBJECTS: 'Materias y clases', FOOTER: 'Pie de página', SEO: 'Posicionamiento en buscadores',
  ANALYTICS: 'Analítica', LEADS: 'Contactos recibidos', LEGAL: 'Información legal',
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PREVIEW: 'En revisión', PAYMENT_PENDING: 'Pago pendiente', PUBLISHED: 'Publicado',
  PAUSED: 'Pausado', ARCHIVED: 'Archivado', ACTIVE: 'Activo', INACTIVE: 'Inactivo', NONE: 'Sin suscripción',
  PENDING: 'Pendiente', PAST_DUE: 'Pago atrasado', GRACE_PERIOD: 'Período de gracia', CANCELLED: 'Cancelada', EXPIRED: 'Vencida',
};

export const CTA_LABELS: Record<string, string> = Object.fromEntries(
  ALL_BUSINESS_CATEGORY_CODES.map((code) => [code, categoryDef(code)?.cta || 'Contactar por WhatsApp']),
);

export const CATEGORY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  ALL_BUSINESS_CATEGORY_CODES.map((code) => [code, categoryDef(code)?.description || 'Una página hecha para presentar y crecer tu negocio.']),
);


export const categoryLabel = (code?: string | null) => CATEGORY_LABELS[String(code || '').toUpperCase()] || 'Negocio';
/**
 * CTA DEL NEGOCIO — FUENTE ÚNICA (Fase 4.1, corrección del bug reportado).
 *
 * Antes, el texto del botón se leía de `industryComposition`, que trae un
 * valor HARDCODEADO por rubro ("Reservar mesa", "Pedir ahora"...). El usuario
 * escribía "Agendar hora" en el editor y la página mostraba "Reservar mesa",
 * en todos los sitios y a la vez.
 *
 * Regla de la fase: si el usuario lo configuró, se respeta SIEMPRE.
 * La prioridad es, de mayor a menor:
 *   1. `business.cta.primaryLabel`   → lo que el usuario escribió
 *   2. texto del bloque en el manifest
 *   3. etiqueta sugerida del rubro
 * Nunca se invierte el orden.
 */
export function resolveBusinessCta(
  business: any,
  options: { blockLabel?: unknown; fallback?: string } = {},
): string {
  const configured = business?.cta;
  const primary = typeof configured === 'object' && configured ? configured.primaryLabel : undefined;
  const fromBlock = typeof options.blockLabel === 'string' ? options.blockLabel.trim() : '';
  const candidate = String(primary || '').trim();
  if (candidate) return candidate;
  if (fromBlock) return fromBlock;
  return String(options.fallback || 'Contactar por WhatsApp').trim() || 'Contactar por WhatsApp';
}

/** URL de la acción principal del CTA, según lo configurado y lo disponible. */
export function resolveCtaHref(business: any, action?: unknown): string {
  const configured = business?.cta && typeof business.cta === 'object' ? business.cta : {};
  const requested = String(action || configured.primaryAction || 'whatsapp').toLowerCase();
  if (requested === 'call' && business?.phone) return `tel:${business.phone}`;
  if (requested === 'email' && business?.email) return `mailto:${business.email}`;
  if (requested === 'map' && business?.mapsUrl) return business.mapsUrl;
  const href = typeof configured.primaryHref === 'string' ? configured.primaryHref : '';
  if (requested === 'link' && href) return href;
  if (requested === 'booking' && business?.whatsapp) {
    return buildWaLink(business.whatsapp, `Hola ${business.name || ''}, quiero reservar una hora.`);
  }
  if (requested === 'lead' && business?.whatsapp) {
    return buildWaLink(business.whatsapp, `Hola ${business.name || ''}, tengo una consulta.`);
  }
  if (business?.whatsapp) return buildWaLink(business.whatsapp, `Hola ${business.name || ''}.`);
  if (business?.phone) return `tel:${business.phone}`;
  if (business?.email) return `mailto:${business.email}`;
  return href;
}
export const categoryDescription = (code?: string | null) => CATEGORY_DESCRIPTIONS[String(code || '').toUpperCase()] || 'Una página hecha para presentar y crecer tu negocio.';
export const sectionLabel = (id: string) => SECTION_LABELS[id] || 'Sección';
export const statusLabel = (status: string) => STATUS_LABELS[status] || 'En revisión';
export const ctaLabel = (category?: string | null) => CTA_LABELS[String(category || '').toUpperCase()] || 'Contactar por WhatsApp';
/** Códigos que el usuario puede elegir al crear una página (sin duplicados). */
export const SELECTABLE_CATEGORY_CODES = BUSINESS_CATEGORY_CODES;
export const templateLabel = (code?: string | null, fallback = 'Diseño personalizado') => {
  const value = String(code || '').toUpperCase();
  const names: Record<string, string> = { FLOWERS_01: 'Elegante floral', FLOWERS_02: 'Floral romántico', FLOWERS_03: 'Boutique floral', FLOWERS_04: 'Jardín natural', BARBER_01: 'Barbería premium', HAIR_01: 'Peluquería luminosa', HAIR_02: 'Salón editorial', HAIR_03: 'Belleza natural', CAFE_01: 'Café artesanal', FOOD_01: 'Restaurante editorial', BAKERY_01: 'Mesa dulce', NAILS_01: 'Uñas y cuidado', PETS_01: 'Mascotas felices', FITNESS_01: 'Entrenamiento con energía', AUTO_01: 'Automotriz técnico', REAL_ESTATE_01: 'Arquitectura inmobiliaria', BOUTIQUE_01: 'Moda editorial', PHOTO_01: 'Portafolio visual', PRO_01: 'Profesional de confianza' };
  return names[value] || fallback;
};
