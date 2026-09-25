/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Paridad de registries (Fase 3).
 *
 * El frontend NO es la fuente de verdad: el backend valida. Pero el editor
 * necesita conocer bloques y layouts para ofrecerlos. Este archivo DECLARA
 * que replica el contrato del backend y el test de paridad falla si se
 * desincroniza. Nunca se edita un id acá sin cambiar el BlockRegistry.
 */

export type BlockId =
  | 'Hero' | 'HeroVideo' | 'Text' | 'Image' | 'ImageGallery' | 'Video' | 'VideoGallery'
  | 'Button' | 'CTA' | 'Products' | 'ProductFeatured' | 'Promotions'
  | 'Properties' | 'PropertyFeatured' | 'Services' | 'Booking'
  | 'Testimonials' | 'Team' | 'FAQ' | 'Contact' | 'WhatsApp' | 'Map'
  | 'SocialLinks' | 'LeadForm' | 'Footer';

export type LayoutId =
  | 'editorial' | 'luxury' | 'cinematic' | 'minimal' | 'bento' | 'asymmetric'
  | 'gallery-first' | 'video-first' | 'commerce-first' | 'portfolio' | 'immersive'
  | 'corporate' | 'organic' | 'dark-premium' | 'magazine' | 'modern-commerce';

/**
 * MISMOS ids que `backend/src/template-engine/block-registry.ts`.
 * El test de paridad compara esta lista con la del backend.
 */
export const BLOCK_IDS: BlockId[] = [
  'Hero', 'HeroVideo', 'Text', 'Image', 'ImageGallery', 'Video', 'VideoGallery',
  'Button', 'CTA', 'Products', 'ProductFeatured', 'Promotions',
  'Properties', 'PropertyFeatured', 'Services', 'Booking',
  'Testimonials', 'Team', 'FAQ', 'Contact', 'WhatsApp', 'Map',
  'SocialLinks', 'LeadForm', 'Footer',
];

/** MISMOS ids que `backend/src/template-engine/layout-registry.ts`. */
export const LAYOUT_IDS: LayoutId[] = [
  'editorial', 'luxury', 'cinematic', 'minimal', 'bento', 'asymmetric',
  'gallery-first', 'video-first', 'commerce-first', 'portfolio', 'immersive',
  'corporate', 'organic', 'dark-premium', 'magazine', 'modern-commerce',
];

export type BusinessShape = 'service' | 'commerce' | 'realestate' | 'food' | 'creative';

export interface IndustryProfile {
  shape: BusinessShape;
  primaryAction: string;
  allowedBlocks: BlockId[];
  forbiddenBlocks: BlockId[];
  suggestedLayouts: LayoutId[];
}

/** Misma tabla de rubros que `backend/src/template-engine/capabilities.ts`. */
export const CATEGORY_SHAPE: Record<string, BusinessShape> = {
  HAIR: 'service', BARBER: 'service', NAILS: 'service', BEAUTY: 'service',
  PET: 'service', FITNESS: 'service', CLEANING: 'service', TUTORING: 'service',
  MECHANIC: 'service', PHONE: 'service', PRO: 'service', CONSTRUCTION: 'service',
  FLOWERS: 'commerce', BOUTIQUE: 'commerce', FURNITURE: 'commerce',
  BAKERY: 'food', CAFE: 'food', FOOD: 'food',
  REAL_ESTATE: 'realestate',
  PHOTO: 'creative',
};

/** Perfil del rubro en el frontend. Un rubro desconocido cae en `service`. */
export function industryProfileOf(category?: string | null): IndustryProfile {
  const value = String(category || '').trim().toUpperCase();
  const shape = CATEGORY_SHAPE[value] || 'service';
  return { shape, primaryAction: '', allowedBlocks: BLOCK_IDS, forbiddenBlocks: [], suggestedLayouts: LAYOUT_IDS };
}

export function isKnownBlockId(id: unknown): id is BlockId {
  return typeof id === 'string' && (BLOCK_IDS as string[]).includes(id);
}

export function isKnownLayoutId(id: unknown): id is LayoutId {
  return typeof id === 'string' && (LAYOUT_IDS as string[]).includes(id);
}

/** Versión de formato de manifest que este frontend entiende. */
export const CURRENT_MANIFEST_VERSION = 1;
