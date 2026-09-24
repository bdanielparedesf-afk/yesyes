/**
 * YESYES BUSINESS — Motor de capacidades (modulos) y secciones.
 *
 * Una pagina de negocio NO es "una plantilla fija": es la combinacion
 *
 *     plantilla (layout) + capacidades activas + configuracion del negocio
 *
 * Este archivo es la FUENTE DE VERDAD del catalogo de capacidades y de la
 * matriz por rubro. El seed lo persiste en `business_capabilities` y lo usa
 * para `business_categories.defaultCapabilities`; la API lo usa para resolver
 * que modulos puede ver/activar cada negocio.
 *
 * Reglas:
 *  - ADMIN puede activar cualquier capacidad de la plantilla.
 *  - El cliente no puede desactivar capacidades `core`.
 *  - Una capacidad desconocida NUNCA rompe el render: se ignora.
 */

export interface CapabilityDef {
  code: string;
  name: string;
  group: string;
  /** Se renderiza como seccion de la pagina publica. */
  section?: boolean;
  /** Orden sugerido cuando la seccion se agrega por primera vez. */
  order?: number;
  /** No puede desactivarse desde el panel del cliente. */
  core?: boolean;
  /** Documentada pero sin implementacion completa todavia. */
  planned?: boolean;
}

export const CAPABILITY_CATALOG: CapabilityDef[] = [
  { code: 'HERO', name: 'Portada', group: 'estructura', section: true, order: 1, core: true },
  { code: 'ABOUT', name: 'Sobre nosotros', group: 'estructura', section: true, order: 3 },
  { code: 'CTA', name: 'Llamado a la accion', group: 'estructura', section: true, order: 90 },
  { code: 'FOOTER', name: 'Pie de pagina', group: 'estructura', section: true, order: 99, core: true },
  { code: 'LEGAL', name: 'Paginas legales', group: 'estructura' },
  { code: 'FEATURES', name: 'Caracteristicas', group: 'contenido', section: true, order: 4 },
  { code: 'STATS', name: 'Cifras', group: 'contenido', section: true, order: 5 },
  { code: 'VIDEO', name: 'Video', group: 'contenido', section: true, order: 6 },
  { code: 'BRANDS', name: 'Marcas', group: 'contenido', section: true, order: 7 },
  { code: 'SERVICES', name: 'Servicios', group: 'servicios', section: true, order: 10 },
  { code: 'PRICING', name: 'Precios', group: 'servicios', section: true, order: 11 },
  { code: 'BOOKING', name: 'Reservas', group: 'servicios', section: true, order: 60 },
  { code: 'CALENDAR', name: 'Calendario', group: 'servicios' },
  { code: 'TEAM', name: 'Equipo', group: 'servicios', section: true, order: 50 },
  { code: 'TESTIMONIALS', name: 'Testimonios', group: 'servicios', section: true, order: 55 },
  { code: 'FAQ', name: 'Preguntas frecuentes', group: 'servicios', section: true, order: 70 },
  { code: 'REVIEWS', name: 'Resenas', group: 'servicios', section: true, order: 56 },
  { code: 'PRODUCTS', name: 'Productos', group: 'catalogo', section: true, order: 20 },
  { code: 'CATALOG', name: 'Catalogo', group: 'catalogo', section: true, order: 21 },
  { code: 'OCCASIONS', name: 'Ocasiones', group: 'catalogo', section: true, order: 22 },
  { code: 'PROPERTIES', name: 'Propiedades', group: 'catalogo', section: true, order: 23 },
  { code: 'GALLERY', name: 'Galeria', group: 'catalogo', section: true, order: 30 },
  { code: 'PORTFOLIO', name: 'Portafolio', group: 'catalogo', section: true, order: 31 },
  { code: 'BEFORE_AFTER', name: 'Antes y despues', group: 'catalogo', section: true, order: 32 },
  { code: 'INSTAGRAM_FEED', name: 'Instagram', group: 'catalogo', section: true, order: 33 },
  { code: 'DELIVERY', name: 'Delivery', group: 'logistica', section: true, order: 65 },
  { code: 'PICKUP', name: 'Retiro en tienda', group: 'logistica' },
  { code: 'PROMOTIONS', name: 'Promociones', group: 'marketing', section: true, order: 40 },
  { code: 'COUPONS', name: 'Cupones', group: 'marketing' },
  { code: 'NEWSLETTER', name: 'Newsletter', group: 'marketing', section: true, order: 80 },
  { code: 'CONTACT', name: 'Contacto', group: 'contacto', section: true, order: 72, core: true },
  { code: 'CONTACT_FORM', name: 'Formulario de contacto', group: 'contacto', section: true, order: 73 },
  { code: 'LEADS', name: 'Recepcion de leads', group: 'contacto', core: true },
  { code: 'WHATSAPP', name: 'WhatsApp', group: 'contacto', core: true },
  { code: 'PHONE', name: 'Telefono', group: 'contacto' },
  { code: 'EMAIL', name: 'Email', group: 'contacto' },
  { code: 'MAP', name: 'Mapa y ubicacion', group: 'contacto', section: true, order: 74 },
  { code: 'SOCIALS', name: 'Redes sociales', group: 'contacto', section: true, order: 75 },
  { code: 'OPENING_HOURS', name: 'Horarios', group: 'contacto', section: true, order: 71 },
  { code: 'REPAIR', name: 'Reparación', group: 'servicios', section: true, order: 12 },
  { code: 'SUBJECTS', name: 'Materias y niveles', group: 'contenido', section: true, order: 8 },
  { code: 'SEO', name: 'SEO', group: 'plataforma', core: true },
  { code: 'ANALYTICS', name: 'Estadisticas', group: 'plataforma', core: true },
  { code: 'BLOG', name: 'Blog', group: 'plataforma', section: true, order: 85 },
  { code: 'EVENTS', name: 'Eventos', group: 'plataforma', section: true, order: 86 },
  // Preparadas: activables, pero su funcionalidad completa depende de
  // servicios externos que todavia no estan contratados.
  { code: 'MEMBERSHIPS', name: 'Membresias', group: 'futuro', planned: true },
  { code: 'INVOICING', name: 'Facturacion', group: 'futuro', planned: true },
  { code: 'DONATIONS', name: 'Donaciones', group: 'futuro', planned: true },
  { code: 'DIGITAL_PRODUCTS', name: 'Productos digitales', group: 'futuro', planned: true },
  { code: 'COURSES', name: 'Cursos', group: 'futuro', planned: true },
  { code: 'CHAT', name: 'Chat', group: 'futuro', planned: true },
  { code: 'AUTOMATIONS', name: 'Automatizaciones', group: 'futuro', planned: true },
  { code: 'CRM', name: 'CRM', group: 'futuro', planned: true },
];


export const CAPABILITY_CODES: string[] = CAPABILITY_CATALOG.map((c) => c.code);
const CAPABILITY_MAP = new Map(CAPABILITY_CATALOG.map((c) => [c.code, c]));

export function isCapabilityCode(code: unknown): boolean {
  return typeof code === 'string' && CAPABILITY_MAP.has(code);
}

export function isCoreCapability(code: string): boolean {
  return CAPABILITY_MAP.get(code)?.core === true;
}

export function isSectionCapability(code: string): boolean {
  return CAPABILITY_MAP.get(code)?.section === true;
}

export function defaultSectionOrder(code: string): number {
  return CAPABILITY_MAP.get(code)?.order ?? 999;
}

/** Capacidades que se renderizan como seccion, en orden sugerido. */
export const SECTION_CAPABILITY_CODES: string[] = CAPABILITY_CATALOG
  .filter((c) => c.section)
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  .map((c) => c.code);

const CORE_FALLBACK = ['HERO', 'CONTACT', 'WHATSAPP', 'FOOTER', 'SEO', 'ANALYTICS'];

/**
 * Matriz por rubro (seed). ADMIN puede modificarla: es un default, no un limite.
 * Incluye siempre las capacidades core.
 */
export const CATEGORY_DEFAULT_CAPABILITIES: Record<string, string[]> = {
  HAIR: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'TEAM', 'PORTFOLIO', 'BEFORE_AFTER', 'TESTIMONIALS', 'FAQ', 'BOOKING', 'PROMOTIONS', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'SOCIALS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  BARBER: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'TEAM', 'PORTFOLIO', 'GALLERY', 'TESTIMONIALS', 'BOOKING', 'PROMOTIONS', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'SOCIALS', 'CONTACT', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  BAKERY: ['HERO', 'ABOUT', 'CATALOG', 'PRODUCTS', 'GALLERY', 'PROMOTIONS', 'DELIVERY', 'PICKUP', 'WHATSAPP', 'OPENING_HOURS', 'MAP', 'SOCIALS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  FLOWERS: ['HERO', 'ABOUT', 'CATALOG', 'PRODUCTS', 'OCCASIONS', 'GALLERY', 'PROMOTIONS', 'DELIVERY', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'SOCIALS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  FOOD: ['HERO', 'ABOUT', 'CATALOG', 'PRODUCTS', 'PROMOTIONS', 'DELIVERY', 'PICKUP', 'REVIEWS', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'SOCIALS', 'CONTACT', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  BOUTIQUE: ['HERO', 'ABOUT', 'CATALOG', 'PRODUCTS', 'GALLERY', 'PROMOTIONS', 'WHATSAPP', 'SOCIALS', 'MAP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  FURNITURE: ['HERO', 'ABOUT', 'CATALOG', 'PRODUCTS', 'GALLERY', 'PORTFOLIO', 'FEATURES', 'WHATSAPP', 'MAP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  REAL_ESTATE: ['HERO', 'ABOUT', 'PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'CONTACT_FORM', 'WHATSAPP', 'SOCIALS', 'STATS', 'TESTIMONIALS', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  MECHANIC: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'BRANDS', 'BOOKING', 'GALLERY', 'PROMOTIONS', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  PHONE: ['HERO', 'ABOUT', 'PRODUCTS', 'SERVICES', 'BRANDS', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  CLEANING: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'TESTIMONIALS', 'BOOKING', 'WHATSAPP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  PHOTO: ['HERO', 'ABOUT', 'PORTFOLIO', 'GALLERY', 'SERVICES', 'PRICING', 'BOOKING', 'TESTIMONIALS', 'WHATSAPP', 'SOCIALS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  TUTORING: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'TEAM', 'BOOKING', 'OPENING_HOURS', 'TESTIMONIALS', 'WHATSAPP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  CONSTRUCTION: ['HERO', 'ABOUT', 'SERVICES', 'PORTFOLIO', 'GALLERY', 'TEAM', 'TESTIMONIALS', 'WHATSAPP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  BEAUTY: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'TEAM', 'PORTFOLIO', 'TESTIMONIALS', 'BOOKING', 'PROMOTIONS', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'SOCIALS', 'CONTACT', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  PET: ['HERO', 'ABOUT', 'SERVICES', 'PRODUCTS', 'PRICING', 'BOOKING', 'GALLERY', 'WHATSAPP', 'MAP', 'OPENING_HOURS', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
  DETAILING: ['HERO', 'ABOUT', 'SERVICES', 'PRICING', 'BEFORE_AFTER', 'GALLERY', 'BOOKING', 'PROMOTIONS', 'WHATSAPP', 'MAP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER', 'LEGAL', 'SEO', 'ANALYTICS'],
};

export function categoryDefaultCapabilities(category: string | null | undefined): string[] {
  if (!category) return [...CORE_FALLBACK];
  return CATEGORY_DEFAULT_CAPABILITIES[String(category)] || [...CORE_FALLBACK];
}

export interface CapabilitySection {
  id: string;
  enabled: boolean;
  order: number;
}

export interface ResolveCapabilitiesInput {
  templateCapabilities?: unknown;
  categoryDefaults?: unknown;
  businessCapabilities?: unknown;
  savedSections?: unknown;
}

export interface ResolvedCapabilities {
  /** Capacidades activas finales (plantilla/rubro ∩ eleccion del negocio). */
  enabled: string[];
  /** Capacidades que la plantilla/rubro permite. */
  available: string[];
  /** Secciones ordenables para el renderer. */
  sections: CapabilitySection[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/**
 * Ordena y sanea la lista de secciones: descarta ids desconocidos, quita
 * duplicados, fuerza orden entero positivo y agrega al final (en orden
 * sugerido) las secciones disponibles que aun no fueron configuradas.
 */
export function normalizeSections(input: unknown, available: string[]): CapabilitySection[] {
  const out: CapabilitySection[] = [];
  const seen = new Set<string>();
  const availableSections = available.filter(isSectionCapability);

  if (Array.isArray(input)) {
    for (const raw of input) {
      const id = typeof raw === 'string' ? raw : String((raw as any)?.id || '');
      if (!id || seen.has(id) || !isSectionCapability(id)) continue;
      if (!availableSections.includes(id)) continue;
      const rawOrder = Number((raw as any)?.order);
      const order = Number.isFinite(rawOrder) && rawOrder > 0 ? Math.floor(rawOrder) : defaultSectionOrder(id);
      const enabled = (raw as any)?.enabled === undefined ? true : Boolean((raw as any).enabled);
      seen.add(id);
      out.push({ id, enabled, order });
    }
  }

  let next = out.reduce((max, s) => Math.max(max, s.order), 0);
  for (const code of availableSections) {
    if (seen.has(code)) continue;
    seen.add(code);
    next += 1;
    const suggested = defaultSectionOrder(code);
    out.push({ id: code, enabled: true, order: suggested > next ? suggested : next });
  }

  return out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * Resuelve las capacidades efectivas de un negocio.
 * Prioridad: plantilla (capabilities) ∪ rubro (defaults) → eleccion del negocio.
 */
export function resolveCapabilities(input: ResolveCapabilitiesInput): ResolvedCapabilities {
  const template = toStringArray(input.templateCapabilities).filter(isCapabilityCode);
  const category = toStringArray(input.categoryDefaults).filter(isCapabilityCode);
  const available = Array.from(new Set([...template, ...category, ...CAPABILITY_CODES.filter(isCoreCapability)]));

  const chosen = toStringArray(input.businessCapabilities).filter(isCapabilityCode);
  // Sin eleccion explicita se habilitan todas las capacidades disponibles.
  const enabled = chosen.length
    ? Array.from(new Set([...chosen, ...available.filter(isCoreCapability)]))
    : [...available];

  const sections = normalizeSections(input.savedSections, enabled);
  return { enabled, available, sections };
}

/** Secciones habilitadas y ordenadas, listas para el renderer. */
export function enabledSections(resolved: ResolvedCapabilities): CapabilitySection[] {
  return resolved.sections.filter((s) => s.enabled);
}

export function hasCapability(resolved: ResolvedCapabilities, code: string): boolean {
  return resolved.enabled.includes(code);
}
