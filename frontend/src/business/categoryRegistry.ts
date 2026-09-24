export const BUSINESS_CATEGORY_CODES = ['HAIR','BARBER','BAKERY','FLOWERS','FOOD','CAFE','BOUTIQUE','FURNITURE','REAL_ESTATE','MECHANIC','AUTO','PHONE','CLEANING','PHOTO','TUTORING','CONSTRUCTION','BEAUTY','NAILS','PET','FITNESS','PRO','DETAILING'] as const;
export type BusinessCategory = typeof BUSINESS_CATEGORY_CODES[number];
export type BusinessSectionId = string;
export type CategoryComposition = { label: string; cta: string; supportedCapabilities: string[]; defaultOrder: string[]; defaultEnabled: string[] };
const CORE = ['HERO', 'CONTACT', 'WHATSAPP'];
const definitions: Record<string, CategoryComposition> = {
 FOOD: { label: 'Comida y bebida', cta: 'Pedir', supportedCapabilities: [...CORE,'CATALOG','PRODUCTS','DELIVERY','PICKUP','PROMOTIONS','OPENING_HOURS','MAP'], defaultOrder: ['HERO','CATALOG','PRODUCTS','PROMOTIONS','DELIVERY','PICKUP','OPENING_HOURS','WHATSAPP','MAP','CONTACT','CTA'], defaultEnabled: [...CORE,'CATALOG','PRODUCTS','DELIVERY','PROMOTIONS'] },
 BOUTIQUE: { label: 'Boutique y moda', cta: 'Ver catálogo', supportedCapabilities: [...CORE,'CATALOG','PRODUCTS','GALLERY','PROMOTIONS','SOCIALS'], defaultOrder: ['HERO','CATALOG','PRODUCTS','GALLERY','PROMOTIONS','SOCIALS','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'CATALOG','PRODUCTS','GALLERY'] },
 FURNITURE: { label: 'Muebles y proyectos', cta: 'Cotizar', supportedCapabilities: [...CORE,'CATALOG','GALLERY','PORTFOLIO','TESTIMONIALS','TEAM','CTA'], defaultOrder: ['HERO','CATALOG','GALLERY','PORTFOLIO','TEAM','TESTIMONIALS','CONTACT','CTA'], defaultEnabled: [...CORE,'CATALOG','GALLERY','PORTFOLIO'] },
 MECHANIC: { label: 'Mecánica y mantenimiento', cta: 'Agendar', supportedCapabilities: [...CORE,'SERVICES','BRANDS','BEFORE_AFTER','TESTIMONIALS','BOOKING','MAP','OPENING_HOURS'], defaultOrder: ['HERO','SERVICES','BRANDS','BEFORE_AFTER','TESTIMONIALS','BOOKING','MAP','OPENING_HOURS','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'SERVICES','BRANDS','BEFORE_AFTER','BOOKING'] },
 PHONE: { label: 'Celulares y accesorios', cta: 'Cotizar reparación', supportedCapabilities: [...CORE,'PRODUCTS','SERVICES','BRANDS','REPAIR','MAP'], defaultOrder: ['HERO','PRODUCTS','SERVICES','REPAIR','BRANDS','MAP','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'PRODUCTS','SERVICES','REPAIR'] },
 CLEANING: { label: 'Servicios de limpieza', cta: 'Cotizar servicio', supportedCapabilities: [...CORE,'SERVICES','PRICING','FEATURES','TESTIMONIALS','BOOKING','MAP'], defaultOrder: ['HERO','SERVICES','PRICING','FEATURES','TESTIMONIALS','BOOKING','MAP','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'SERVICES','PRICING','BOOKING'] },
 PHOTO: { label: 'Fotografía', cta: 'Agendar sesión', supportedCapabilities: [...CORE,'PORTFOLIO','GALLERY','SERVICES','PRICING','TESTIMONIALS','BOOKING','SOCIALS'], defaultOrder: ['HERO','PORTFOLIO','GALLERY','SERVICES','PRICING','TESTIMONIALS','BOOKING','SOCIALS','CONTACT','CTA'], defaultEnabled: [...CORE,'PORTFOLIO','GALLERY','SERVICES','BOOKING'] },
 TUTORING: { label: 'Educación y clases', cta: 'Agendar clase', supportedCapabilities: [...CORE,'SUBJECTS','SERVICES','TEAM','PRICING','TESTIMONIALS','BOOKING'], defaultOrder: ['HERO','SUBJECTS','SERVICES','TEAM','PRICING','TESTIMONIALS','BOOKING','CONTACT','CTA'], defaultEnabled: [...CORE,'SUBJECTS','SERVICES','TEAM','BOOKING'] },
 CONSTRUCTION: { label: 'Construcción y proyectos', cta: 'Solicitar cotización', supportedCapabilities: [...CORE,'SERVICES','PORTFOLIO','GALLERY','TEAM','TESTIMONIALS','MAP'], defaultOrder: ['HERO','SERVICES','PORTFOLIO','GALLERY','TEAM','TESTIMONIALS','MAP','CONTACT','CTA'], defaultEnabled: [...CORE,'SERVICES','PORTFOLIO','GALLERY'] },
 BEAUTY: { label: 'Belleza y bienestar', cta: 'Agendar', supportedCapabilities: [...CORE,'SERVICES','PRICING','TEAM','GALLERY','TESTIMONIALS','BOOKING','PROMOTIONS'], defaultOrder: ['HERO','SERVICES','PRICING','TEAM','GALLERY','TESTIMONIALS','BOOKING','PROMOTIONS','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'SERVICES','PRICING','GALLERY','BOOKING'] },
 PET: { label: 'Cuidado de mascotas', cta: 'Agendar', supportedCapabilities: [...CORE,'SERVICES','PRODUCTS','GALLERY','BOOKING','TESTIMONIALS','MAP'], defaultOrder: ['HERO','SERVICES','PRODUCTS','GALLERY','BOOKING','TESTIMONIALS','MAP','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'SERVICES','PRODUCTS','GALLERY','BOOKING'] },
 DETAILING: { label: 'Detailing vehicular', cta: 'Agendar servicio', supportedCapabilities: [...CORE,'SERVICES','PRICING','BEFORE_AFTER','GALLERY','PROMOTIONS','BOOKING','MAP'], defaultOrder: ['HERO','SERVICES','PRICING','BEFORE_AFTER','GALLERY','PROMOTIONS','BOOKING','MAP','WHATSAPP','CONTACT','CTA'], defaultEnabled: [...CORE,'SERVICES','PRICING','BEFORE_AFTER','GALLERY','BOOKING'] },
};
const FALLBACK = definitions.FOOD;
export function getCategoryComposition(category?: string | null): CategoryComposition { return (category && definitions[category]) || FALLBACK; }
export function isSpecializedCategory(category?: string | null): boolean { return Boolean(category && definitions[category]); }
export const CATEGORY_DEFINITIONS = definitions;
export function resolveOrderedSections(sections: unknown, supported: string[]): Array<{ id: string; enabled: boolean; order: number }> {
 const allowed = new Set(supported), seen = new Set<string>();
 const input = Array.isArray(sections) ? sections : [];
 const result = input.flatMap((raw: any) => { const id = String(raw?.id || ''); if (!id || seen.has(id) || !allowed.has(id)) return []; seen.add(id); const order = Number(raw?.order); return [{ id, enabled: raw?.enabled !== false, order: Number.isFinite(order) && order > 0 ? Math.floor(order) : 9999 }]; }).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
 if (supported.includes('HERO') && !seen.has('HERO')) result.unshift({ id: 'HERO', enabled: true, order: 0 });
 return result;
}
