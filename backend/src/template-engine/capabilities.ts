/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 â€” Capacidades por rubro (Fase 3).
 *
 * El motor NO convierte todos los negocios en la misma página. Cada rubro
 * declara qué capacidades tiene sentido, qué bloques puede usar un template
 * suyo y qué bloques quedan PROHIBIDOS (así no aparecen bloques irrelevantes
 * solo para inflar el número de componentes).
 *
 * `CORE_BLOCKS` se aplican siempre: sin portada o sin contacto, el sitio no
 * cumple su función. El resto es sugerencia por rubro, no un límite duro: el
 * master template de la categoría decide la composición final.
 */

import { canonicalCategoryCode, categoryDef } from '../utils/business-taxonomy';

/** Familia de negocio. Reutilizada por varios rubros. */
export type BusinessShape = 'service' | 'commerce' | 'realestate' | 'food' | 'creative';

export interface IndustryProfile {
  shape: BusinessShape;
  primaryAction: string;
  capabilities: string[];
  allowedBlocks: string[];
  forbiddenBlocks: string[];
  suggestedLayouts: string[];
}

const CORE_BLOCKS = ['Hero', 'CTA', 'Contact', 'Footer'];

/**
 * Servicio: agenda, precios, equipo, confianza.
 *
 * PRODUCTS está PERMITIDO a propósito. La fase 4.1 exige que servicios y
 * productos sean capacidades INDEPENDIENTES: una peluquería vende productos y
 * ofrece servicios, una veterinaria idem. Prohibir el catálogo aquí obligaba al
 * renderer a ocultar una sección que el usuario había configurado.
 */
const SERVICE: IndustryProfile = {
  shape: 'service',
  primaryAction: 'Reservar',
  capabilities: ['SERVICES', 'BOOKING', 'TEAM', 'TESTIMONIALS', 'GALLERY', 'FAQ', 'WHATSAPP', 'PROMOTIONS', 'CONTACT', 'MAP', 'SOCIALS', 'PRODUCTS', 'CATALOG'],
  allowedBlocks: [...CORE_BLOCKS, 'Services', 'Booking', 'Team', 'Testimonials', 'ImageGallery', 'FAQ', 'WhatsApp', 'Map', 'SocialLinks', 'LeadForm', 'Text', 'Image', 'Promotions', 'HeroVideo', 'Video', 'VideoGallery', 'Button', 'Products', 'ProductFeatured'],
  forbiddenBlocks: ['Properties', 'PropertyFeatured'],
  suggestedLayouts: ['luxury', 'minimal', 'dark-premium', 'organic', 'editorial', 'cinematic'],
};

/** Comercio: catálogo, promociones, galería. */
const COMMERCE: IndustryProfile = {
  shape: 'commerce',
  primaryAction: 'Ver catálogo',
  capabilities: ['CATALOG', 'PRODUCTS', 'SERVICES', 'PROMOTIONS', 'GALLERY', 'WHATSAPP', 'CONTACT', 'MAP', 'SOCIALS', 'FAQ', 'TESTIMONIALS'],
  allowedBlocks: [...CORE_BLOCKS, 'Products', 'ProductFeatured', 'Promotions', 'ImageGallery', 'FAQ', 'Testimonials', 'WhatsApp', 'Map', 'SocialLinks', 'LeadForm', 'Text', 'Image', 'Video', 'VideoGallery', 'HeroVideo', 'Button', 'Services'],
  forbiddenBlocks: ['Properties', 'PropertyFeatured', 'Booking', 'Team'],
  suggestedLayouts: ['modern-commerce', 'commerce-first', 'bento', 'minimal', 'magazine', 'gallery-first'],
};

/** Inmobiliaria: propiedades, agentes, mapa. */
const REALESTATE: IndustryProfile = {
  shape: 'realestate',
  primaryAction: 'Ver propiedades',
  capabilities: ['PROPERTIES', 'MAP', 'CONTACT', 'TEAM', 'FAQ', 'WHATSAPP', 'TESTIMONIALS', 'GALLERY'],
  allowedBlocks: [...CORE_BLOCKS, 'Properties', 'PropertyFeatured', 'Map', 'Team', 'FAQ', 'Testimonials', 'ImageGallery', 'WhatsApp', 'SocialLinks', 'LeadForm', 'Text', 'Image', 'Video', 'HeroVideo', 'Button'],
  forbiddenBlocks: ['Products', 'ProductFeatured', 'Services', 'Booking', 'Promotions'],
  suggestedLayouts: ['editorial', 'luxury', 'corporate', 'minimal', 'asymmetric', 'immersive'],
};

/** Gastronomía: menú, pedidos, ubicación, reserva de mesa. */
const FOOD: IndustryProfile = {
  shape: 'food',
  primaryAction: 'Pedir',
  capabilities: ['CATALOG', 'PROMOTIONS', 'MAP', 'BOOKING', 'WHATSAPP', 'CONTACT', 'TESTIMONIALS', 'FAQ', 'GALLERY', 'SOCIALS'],
  allowedBlocks: [...CORE_BLOCKS, 'Products', 'ProductFeatured', 'Promotions', 'Booking', 'Map', 'ImageGallery', 'Testimonials', 'FAQ', 'WhatsApp', 'SocialLinks', 'LeadForm', 'Text', 'Image', 'Video', 'VideoGallery', 'HeroVideo', 'Button'],
  forbiddenBlocks: ['Properties', 'PropertyFeatured', 'Team'],
  suggestedLayouts: ['commerce-first', 'gallery-first', 'modern-commerce', 'cinematic', 'organic', 'bento'],
};

/** Creativos/eventos: portafolio, reservas, testimonios. */
const CREATIVE: IndustryProfile = {
  shape: 'creative',
  primaryAction: 'Agendar',
  capabilities: ['GALLERY', 'PORTFOLIO', 'BOOKING', 'TESTIMONIALS', 'FAQ', 'WHATSAPP', 'CONTACT', 'SOCIALS', 'SERVICES', 'PRODUCTS'],
  allowedBlocks: [...CORE_BLOCKS, 'ImageGallery', 'VideoGallery', 'Video', 'HeroVideo', 'Booking', 'Testimonials', 'FAQ', 'WhatsApp', 'SocialLinks', 'LeadForm', 'Text', 'Image', 'Services', 'Button', 'Team', 'Products', 'ProductFeatured'],
  forbiddenBlocks: ['Properties', 'PropertyFeatured', 'Promotions'],
  suggestedLayouts: ['portfolio', 'gallery-first', 'immersive', 'asymmetric', 'cinematic', 'editorial'],
};

const BY_SHAPE: Record<BusinessShape, IndustryProfile> = {
  service: SERVICE,
  commerce: COMMERCE,
  realestate: REALESTATE,
  food: FOOD,
  creative: CREATIVE,
};

/**
 * Qué rubro es cada categoría canónica. Fuente única de verdad: el frontend
 * replica esta tabla y un test de parity la compara.
 */
const CATEGORY_SHAPE: Record<string, BusinessShape> = {
  HAIR: 'service', BARBER: 'service', NAILS: 'service', BEAUTY: 'service',
  PET: 'service', FITNESS: 'service', CLEANING: 'service', TUTORING: 'service',
  MECHANIC: 'service', PHONE: 'service', PRO: 'service', CONSTRUCTION: 'service',
  FLOWERS: 'commerce', BOUTIQUE: 'commerce', FURNITURE: 'commerce',
  BAKERY: 'food', CAFE: 'food', FOOD: 'food',
  REAL_ESTATE: 'realestate',
  PHOTO: 'creative',
};

/** Perfil del rubro. Una categoría desconocida cae en `service`. */
export function industryProfileOf(category?: string | null): IndustryProfile {
  const canonical = canonicalCategoryCode(category);
  const base = BY_SHAPE[CATEGORY_SHAPE[canonical] || 'service'];
  const cta = categoryDef(canonical)?.cta;
  return cta ? { ...base, primaryAction: cta } : base;
}

/** Un template de este rubro puede usar este bloque. */
export function blockAllowedForCategory(blockId: string, category?: string | null): boolean {
  const profile = industryProfileOf(category);
  if (profile.forbiddenBlocks.includes(blockId)) return false;
  return profile.allowedBlocks.includes(blockId);
}

/** Bloques que el backend RECHAZA para este rubro. */
export function forbiddenBlocksForCategory(category?: string | null): string[] {
  return industryProfileOf(category).forbiddenBlocks;
}

/** Capacidades del rubro, base para construir manifests por defecto. */
export function capabilitiesForCategory(category?: string | null): string[] {
  return industryProfileOf(category).capabilities;
}

/** Layouts sugeridos para el rubro. */
export function suggestedLayoutsForCategory(category?: string | null): string[] {
  return industryProfileOf(category).suggestedLayouts;
}
