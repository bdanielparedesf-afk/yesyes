/**
 * YESYES BUSINESS — Taxonomía canónica de rubros (Fase 2 · UX Foundation).
 *
 * FUENTE DE VERDAD única de la taxonomía de negocios (grupos + categorías).
 *
 * Compatibilidad V3:
 *  - El enum `BusinessCategoryCode` NO se elimina ni se modifica: sigue siendo la
 *    columna de storage y todos sus valores siguen siendo válidos.
 *  - Los códigos legacy redundantes (`AUTO`, `DETAILING`) se conservan y colapsan
 *    a su categoría canónica (`MECHANIC`) SOLO en la capa de presentación y para
 *    elegir plantillas. La fila almacenada nunca se reescribe.
 */

export interface BusinessCategoryDef {
  /** Código canónico (subconjunto del enum). Es el que se ofrece al usuario. */
  code: string;
  group: string;
  label: string;
  description: string;
  /** Texto del botón principal, en lenguaje humano. */
  cta: string;
}

export interface BusinessCategoryGroupDef {
  key: string;
  label: string;
  description: string;
}

export const BUSINESS_CATEGORY_GROUPS: BusinessCategoryGroupDef[] = [
  { key: 'BEAUTY_GROUP', label: 'Belleza y cuidado personal', description: 'Peluquerías, barberías, uñas y tratamientos.' },
  { key: 'FOOD_GROUP', label: 'Gastronomía', description: 'Restaurantes, cafeterías y panaderías.' },
  { key: 'RETAIL_GROUP', label: 'Comercio', description: 'Tiendas, moda, flores y muebles.' },
  { key: 'SERVICES_GROUP', label: 'Servicios', description: 'Profesionales, limpieza, clases y proyectos.' },
  { key: 'AUTO_GROUP', label: 'Automotriz', description: 'Mecánica, taller y cuidado vehicular.' },
  { key: 'REAL_ESTATE_GROUP', label: 'Inmobiliario', description: 'Propiedades y corredurías.' },
  { key: 'CREATIVE_GROUP', label: 'Creativos y eventos', description: 'Fotografía y proyectos visuales.' },
  { key: 'TECH_GROUP', label: 'Tecnología y bienestar', description: 'Reparación, soporte y entrenamiento.' },
];
export const BUSINESS_CATEGORY_DEFS: BusinessCategoryDef[] = [
  { code: 'HAIR', group: 'BEAUTY_GROUP', label: 'Peluquería', description: 'Cortes, color y cuidado del cabello.', cta: 'Reservar hora' },
  { code: 'BARBER', group: 'BEAUTY_GROUP', label: 'Barbería', description: 'Barbas, afeitado y estilo clásico.', cta: 'Reservar hora' },
  { code: 'NAILS', group: 'BEAUTY_GROUP', label: 'Uñas', description: 'Manicure, pedicure y diseños.', cta: 'Reservar' },
  { code: 'BEAUTY', group: 'BEAUTY_GROUP', label: 'Estética y bienestar', description: 'Tratamientos faciales y cuidado personal.', cta: 'Agendar cita' },
  { code: 'FOOD', group: 'FOOD_GROUP', label: 'Restaurante', description: 'Cocina, ambiente y delivery.', cta: 'Reservar mesa' },
  { code: 'CAFE', group: 'FOOD_GROUP', label: 'Cafetería', description: 'Café de especialidad y repostería.', cta: 'Ver menú' },
  { code: 'BAKERY', group: 'FOOD_GROUP', label: 'Pastelería y panadería', description: 'Pan, tortas y productos artesanales.', cta: 'Realizar pedido' },
  { code: 'BOUTIQUE', group: 'RETAIL_GROUP', label: 'Boutique y moda', description: 'Colecciones, prendas y accesorios.', cta: 'Ver colección' },
  { code: 'FLOWERS', group: 'RETAIL_GROUP', label: 'Floristería', description: 'Arreglos, ramos y regalos florales.', cta: 'Consultar por WhatsApp' },
  { code: 'FURNITURE', group: 'RETAIL_GROUP', label: 'Muebles y espacios', description: 'Mobiliario y proyectos de interior.', cta: 'Solicitar cotización' },
  { code: 'CLEANING', group: 'SERVICES_GROUP', label: 'Limpieza', description: 'Hogar, oficinas y limpieza profunda.', cta: 'Cotizar servicio' },
  { code: 'TUTORING', group: 'SERVICES_GROUP', label: 'Educación y clases', description: 'Clases particulares, talleres y capacitación.', cta: 'Agendar clase' },
  { code: 'PRO', group: 'SERVICES_GROUP', label: 'Consultoría y servicios profesionales', description: 'Asesoría, legales, financieros y más.', cta: 'Solicitar consulta' },
  { code: 'CONSTRUCTION', group: 'SERVICES_GROUP', label: 'Construcción y proyectos', description: 'Obras, reformas y proyectos a medida.', cta: 'Solicitar cotización' },
  { code: 'PET', group: 'SERVICES_GROUP', label: 'Cuidado de mascotas', description: 'Peluquería canina, paseo y salud.', cta: 'Agendar servicio' },
  { code: 'MECHANIC', group: 'AUTO_GROUP', label: 'Mecánica y taller', description: 'Mantenimiento, reparación y overhaules.', cta: 'Solicitar cotización' },
  { code: 'REAL_ESTATE', group: 'REAL_ESTATE_GROUP', label: 'Inmobiliaria', description: 'Venta, arriendo y tasaciones.', cta: 'Ver propiedades' },
  { code: 'PHOTO', group: 'CREATIVE_GROUP', label: 'Fotografía', description: 'Retratos, eventos y sesiones comerciales.', cta: 'Agendar sesión' },
  { code: 'PHONE', group: 'TECH_GROUP', label: 'Reparación y soporte', description: 'Celulares, computadoras y equipos.', cta: 'Solicitar reparación' },
  { code: 'FITNESS', group: 'TECH_GROUP', label: 'Gimnasio y fitness', description: 'Entrenamiento, planes y acompañamiento.', cta: 'Empieza tu entrenamiento' },
];
/**
 * Códigos legacy del enum que representan un rubro ya cubierto por una categoría
 * canónica. Se siguen aceptando (y nunca se reescriben), pero NO se ofrecen.
 */
export const BUSINESS_CATEGORY_ALIASES: Record<string, string> = {
  AUTO: 'MECHANIC',
  DETAILING: 'MECHANIC',
};

export const BUSINESS_CATEGORY_CODES: string[] = BUSINESS_CATEGORY_DEFS.map((c) => c.code);
export const BUSINESS_CATEGORY_LEGACY_CODES: string[] = Object.keys(BUSINESS_CATEGORY_ALIASES);
export const ALL_BUSINESS_CATEGORY_CODES: string[] = [...BUSINESS_CATEGORY_CODES, ...BUSINESS_CATEGORY_LEGACY_CODES];

const DEF_BY_CODE = new Map(BUSINESS_CATEGORY_DEFS.map((def) => [def.code, def]));

/** Canónico de un código (los legacy colapsan en su categoría real). */
export function canonicalCategoryCode(code?: string | null): string {
  const value = String(code || '').trim().toUpperCase();
  return BUSINESS_CATEGORY_ALIASES[value] || value;
}

export function isKnownCategoryCode(code?: string | null): boolean {
  return ALL_BUSINESS_CATEGORY_CODES.includes(String(code || '').trim().toUpperCase());
}

export function categoryDef(code?: string | null): BusinessCategoryDef | undefined {
  return DEF_BY_CODE.get(canonicalCategoryCode(code));
}

export function categoryLabelOf(code?: string | null, fallback = 'Negocio'): string {
  return categoryDef(code)?.label || fallback;
}

export function categoryDescriptionOf(code?: string | null, fallback = 'Una página hecha para presentar y crecer tu negocio.'): string {
  return categoryDef(code)?.description || fallback;
}

export function categoryCtaOf(code?: string | null, fallback = 'Contactar por WhatsApp'): string {
  return categoryDef(code)?.cta || fallback;
}

export function categoryGroupOf(code?: string | null): BusinessCategoryGroupDef | undefined {
  const key = categoryDef(code)?.group;
  return key ? BUSINESS_CATEGORY_GROUPS.find((group) => group.key === key) : undefined;
}

/** Categorías canónicas agrupadas, listas para el selector del asistente. */
export function groupedCategories(): { group: BusinessCategoryGroupDef; categories: BusinessCategoryDef[] }[] {
  return BUSINESS_CATEGORY_GROUPS
    .map((group) => ({ group, categories: BUSINESS_CATEGORY_DEFS.filter((def) => def.group === group.key) }))
    .filter((entry) => entry.categories.length > 0);
}

/**
 * Códigos que comparten familia de plantillas: una peluquería ofrece los diseños de
 * HAIR; una mecánica ofrece los de MECHANIC, AUTO y DETAILING (mismo rubro).
 */
export function templateFamilyCodes(code?: string | null): string[] {
  const canonical = canonicalCategoryCode(code);
  return [canonical, ...BUSINESS_CATEGORY_LEGACY_CODES.filter((legacy) => BUSINESS_CATEGORY_ALIASES[legacy] === canonical)];
}

/** true cuando el código es un rubro legacy ya cubierto (no se ofrece al usuario). */
export function isLegacyCategoryCode(code?: string | null): boolean {
  return BUSINESS_CATEGORY_LEGACY_CODES.includes(String(code || '').trim().toUpperCase());
}
/* ------------------------------------------------------------------ */
/* Metadatos de plantilla visibles para el usuario (sin códigos técnicos) */
/* ------------------------------------------------------------------ */

const SIGNATURE_STYLES: Record<string, string> = {
  EDITORIAL: 'Esencial',
  ATLAS: 'Dirección visual',
  NATIVE: 'Cercano',
};

/**
 * Nombres legibles por código (V3). Son las direcciones visuales que el usuario
 * reconoce, y son ÚNICAS dentro de cada rubro: dos diseños nunca se ven iguales.
 */
const TEMPLATE_VARIANTS: Record<string, string> = {
  HAIR_01: 'Luminoso', HAIR_02: 'Contemporáneo', HAIR_03: 'Editorial',
  BARBER_01: 'Clásico', BARBER_02: 'Urbano', BARBER_03: 'Premium',
  BAKERY_01: 'Cálido', BAKERY_02: 'Minimal', BAKERY_03: 'Festivo', BAKERY_04: 'Rústico',
  FLOWERS_01: 'Elegante', FLOWERS_02: 'Romántico', FLOWERS_03: 'Boutique', FLOWERS_04: 'Jardín',
  REAL_ESTATE_01: 'Arquitectura', REAL_ESTATE_02: 'Minimal', REAL_ESTATE_03: 'Premium', REAL_ESTATE_04: 'Urbano',
};

/** Códigos de plantilla del modelo V3 (layouts dedicados y de firma). */
const LEGACY_TEMPLATE_CODES = new Set([
  ...Object.keys(TEMPLATE_VARIANTS),
  'FOOD_01', 'BOUTIQUE_01', 'PHOTO_01', 'BEAUTY_01', 'DETAILING_01',
  'CLEANING_01', 'MECHANIC_01', 'TUTORING_01', 'CONSTRUCTION_01',
  'CAFE_01', 'NAILS_01', 'PETS_01', 'FITNESS_01', 'AUTO_01', 'PRO_01',
]);

/** true cuando el código tiene un nombre legible propio (V3 o firma). */
function isVariantCode(code: string): boolean {
  return Boolean(TEMPLATE_VARIANTS[code]) || /_SIGNATURE_[A-Z]+$/.test(code);
}

/** Estilo/nombre visual legible del diseño. */
export function templateStyleOf(code?: string | null, stored?: string | null): string {
  const value = normalizeTemplateCode(code);
  if (TEMPLATE_VARIANTS[value]) return TEMPLATE_VARIANTS[value];
  const signature = value.match(/_SIGNATURE_([A-Z]+)$/);
  if (signature) return SIGNATURE_STYLES[signature[1] || ''] || 'Moderno';
  if (stored) return stored;
  return 'Moderno';
}

/** Nombre legible de la plantilla: nunca expone el código interno. */
export function templateDisplayName(template: { code?: string | null; name?: string | null; category?: string | null; style?: string | null }): string {
  const code = normalizeTemplateCode(template?.code);
  const style = templateStyleOf(code, template?.style);
  if (isVariantCode(code)) return `${categoryLabelOf(template?.category)} · ${style}`;
  return String(template?.name || `${categoryLabelOf(template?.category)} · ${style}`);
}


/** Alias legacy de código de plantilla (mismo layout, otro identificador). */
const TEMPLATE_CODE_ALIASES: Record<string, string> = { FLORES_01: 'FLOWERS_01' };

/** Código canónico de una plantilla (resuelve alias legacy). */
export function normalizeTemplateCode(code?: string | null): string {
  const value = String(code || '').trim().toUpperCase();
  return TEMPLATE_CODE_ALIASES[value] || value;
}

/**
 * Identidad visual de un diseño. Dos filas con la misma identidad se ven
 * iguales: la galería ofrece una sola. Los designs de industria (AUTO_01,
 * MECHANIC_01...) tienen composición propia y NO se colapsan.
 */
export function designIdentity(code?: string | null): string {
  const value = normalizeTemplateCode(code);
  const signature = value.match(/_SIGNATURE_([A-Z]+)$/);
  if (signature) return `signature:${signature[1] || value}`;
  return `layout:${value}`;
}

/**
 * Deja un diseño por identidad visual, prefiriendo el de la categoría canónica.
 * `rows` debe venir ordenado (canónicos primero). La lista privada NO usa esto:
 * un negocio V3 debe poder volver a elegir el diseño que ya tenía.
 */
export function dedupeDesigns<T extends { code?: string | null; category?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows || []) {
    const identity = designIdentity(row.code);
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(row);
  }
  return out;
}

/**
 * Las plantillas del modelo V3 se marcan legacy: siguen activas y visibles
 * (compatibilidad) y la galería las distingue de las nuevas de V5.
 */
export function isLegacyTemplate(template: { code?: string | null; legacy?: boolean | null }): boolean {
  if (typeof template?.legacy === 'boolean') return template.legacy;
  const value = String(template?.code || '').trim().toUpperCase();
  return LEGACY_TEMPLATE_CODES.has(value) || /_SIGNATURE_/.test(value);
}
