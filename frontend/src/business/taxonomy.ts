/**
 * YESYES BUSINESS — Taxonomía canónica de rubros (espejo del backend).
 *
 * FUENTE DE VERDAD única en el frontend: no existen otras listas de categorías.
 * El test `business-taxonomy` compara este archivo con
 * `backend/src/utils/business-taxonomy.ts` para impedir que se separen.
 *
 * Compatibilidad V3:
 *  - El enum `BusinessCategoryCode` sigue siendo el storage: sus 22 valores siguen
 *    siendo válidos y los negocios existentes NO se reescriben.
 *  - `AUTO` y `DETAILING` son códigos legacy del mismo rubro que `MECHANIC`: se
 *    colapsan solo para mostrar y para elegir diseños.
 */

export interface BusinessCategoryDef {
  code: string;
  group: string;
  label: string;
  description: string;
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

/** Rubros legacy del enum ya cubiertos por una categoría canónica. */
export const BUSINESS_CATEGORY_ALIASES: Record<string, string> = { AUTO: 'MECHANIC', DETAILING: 'MECHANIC' };

export const BUSINESS_CATEGORY_CODES: string[] = BUSINESS_CATEGORY_DEFS.map((c) => c.code);
export const BUSINESS_CATEGORY_LEGACY_CODES: string[] = Object.keys(BUSINESS_CATEGORY_ALIASES);

const DEF_BY_CODE = new Map(BUSINESS_CATEGORY_DEFS.map((def) => [def.code, def]));

export const canonicalCategoryCode = (code?: string | null): string => {
  const value = String(code || '').trim().toUpperCase();
  return BUSINESS_CATEGORY_ALIASES[value] || value;
};
export const categoryDef = (code?: string | null): BusinessCategoryDef | undefined => DEF_BY_CODE.get(canonicalCategoryCode(code));
export const categoryGroupOf = (code?: string | null): BusinessCategoryGroupDef | undefined => {
  const key = categoryDef(code)?.group;
  return key ? BUSINESS_CATEGORY_GROUPS.find((group) => group.key === key) : undefined;
};
export const isLegacyCategoryCode = (code?: string | null): boolean => BUSINESS_CATEGORY_LEGACY_CODES.includes(String(code || '').trim().toUpperCase());
/** true cuando el código existe en la taxonomía (canónico o legacy). */
export const isKnownCategoryCode = (code?: string | null): boolean => ALL_BUSINESS_CATEGORY_CODES.includes(String(code || '').trim().toUpperCase());
/** Categorías canónicas agrupadas para el selector de rubro. */
export const groupedCategories = (): { group: BusinessCategoryGroupDef; categories: BusinessCategoryDef[] }[] =>
  BUSINESS_CATEGORY_GROUPS
    .map((group) => ({ group, categories: BUSINESS_CATEGORY_DEFS.filter((def) => def.group === group.key) }))
    .filter((entry) => entry.categories.length > 0);

/** Todos los valores aceptados por el enum (canónicos + legacy). */
export const ALL_BUSINESS_CATEGORY_CODES: string[] = [...BUSINESS_CATEGORY_CODES, ...BUSINESS_CATEGORY_LEGACY_CODES];
