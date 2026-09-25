/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — BlockRegistry (Fase 3).
 *
 * FUENTE DE VERDAD única de los BLOQUES reutilizables del motor V2.
 *
 * Reglas duras:
 *  - Identidad estable: el `id` no cambia aunque cambie el diseño.
 *  - Una responsabilidad = un bloque. NO se crean bloques con nombres
 *    distintos para la misma responsabilidad (p. ej. no existen
 *    "ProductCard", "Showcase" o "CatalogList": el bloque es `Products`).
 *  - Cada bloque declara schema, capabilities, responsive behavior y medios.
 *  - `renderInV2` marca si el renderer UNICO ya lo compone de verdad. Un
 *    bloque sin implementacion no se ofrece: es funcionalidad falsa.
 *
 * Sin dependencias de React: es el contrato que validan backend y frontend.
 * Los renderers viven en `frontend/src/business/engine/blocks`.
 */

export type BlockMediaKind = 'image' | 'video' | 'none';

export interface BlockMediaRequirement {
  kind: BlockMediaKind;
  min: number;
  max: number;
  /** Para video: exige `poster` para no mostrar un frame negro. */
  requiresPoster?: boolean;
}

export interface BlockResponsiveBehavior {
  /** Que hace el bloque en mobile. Es una decision, no solo "responsive". */
  mobile: 'stack' | 'single-column' | 'focus-media' | 'scroll-snap' | 'drawer' | 'collapse';
  tablet?: 'two-column' | 'grid-2' | 'grid-3';
  desktop?: 'grid-2' | 'grid-3' | 'grid-4' | 'masonry' | 'split';
  /** Con `prefers-reduced-motion` el bloque se congela, nunca desaparece. */
  reducedMotion: 'freeze' | 'static' | 'disable-autoplay';
}

export interface BlockConfigField {
  key: string;
  type: 'text' | 'textarea' | 'boolean' | 'number' | 'select' | 'media-ref' | 'items';
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  dependsOn?: { field: string; equals: string | boolean };
}

export interface BlockDefinition {
  id: string;
  label: string;
  description: string;
  /** Responsabilidad unica: base para detectar duplicados reales. */
  responsibility: string;
  group: 'hero' | 'content' | 'commerce' | 'services' | 'trust' | 'conversion' | 'location' | 'info' | 'footer';
  capabilities: string[];
  media: BlockMediaRequirement;
  responsive: BlockResponsiveBehavior;
  /** Config editable: la base del editor visual de Fase 4. */
  configSchema: BlockConfigField[];
  /** Acciones disparables. Todas tienen backend real. */
  actions: Array<'whatsapp' | 'call' | 'email' | 'map' | 'booking' | 'lead' | 'link' | 'cart'>;
  renderInV2: boolean;
  sinceManifestVersion: number;
}

const cfg = (
  key: string,
  type: BlockConfigField['type'],
  label: string,
  extra: Partial<BlockConfigField> = {},
): BlockConfigField => ({ key, type, label, ...extra });

const image = { kind: 'image' as const, min: 1, max: 20 };
const video = { kind: 'video' as const, min: 1, max: 20, requiresPoster: true };
const none = { kind: 'none' as const, min: 0, max: 0 };

/**
 * CATÁLOGO DE BLOQUES, agrupado para que el editor de Fase 4 lo presente
 * con sentido: primero lo que sostiene la página, después lo que convierte.
 */
export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // ── HERO ───────────────────────────────────────────────────────────────
  {
    id: 'Hero',
    label: 'Portada',
    description: 'Primera pantalla: nombre, propuesta y acción principal.',
    responsibility: 'presentar-el-negocio-al-entrar',
    group: 'hero',
    capabilities: [],
    media: image,
    responsive: { mobile: 'stack', tablet: 'two-column', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [
      cfg('headline', 'text', 'Titulo', { required: true, max: 90 }),
      cfg('subheadline', 'textarea', 'Bajada', { max: 240 }),
      cfg('alignment', 'select', 'Alineacion', { options: ['left', 'center'] }),
      cfg('image', 'media-ref', 'Imagen de portada'),
      cfg('ctaLabel', 'text', 'Texto del boton', { max: 40 }),
    ],
    actions: ['whatsapp', 'link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'HeroVideo',
    label: 'Portada con video',
    description: 'Portada con video de fondo, poster y fallback en mobile.',
    responsibility: 'presentar-el-negocio-con-video',
    group: 'hero',
    capabilities: ['VIDEO'],
    media: video,
    responsive: { mobile: 'focus-media', tablet: 'two-column', desktop: 'split', reducedMotion: 'disable-autoplay' },
    configSchema: [
      cfg('headline', 'text', 'Titulo', { required: true, max: 90 }),
      cfg('subheadline', 'textarea', 'Bajada', { max: 240 }),
      cfg('video', 'media-ref', 'Video', { required: true }),
      cfg('poster', 'media-ref', 'Poster', { required: true }),
      cfg('autoplay', 'boolean', 'Reproducir solo'),
      cfg('muted', 'boolean', 'Sin sonido', { required: true }),
      cfg('loop', 'boolean', 'Repetir'),
      cfg('controls', 'boolean', 'Mostrar controles'),
      cfg('mobileFallback', 'media-ref', 'Imagen para mobile'),
    ],
    actions: ['whatsapp', 'link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },

  // ── CONTENIDO ──────────────────────────────────────────────────────────
  {
    id: 'Text',
    label: 'Texto',
    description: 'Bloque de texto libre: historia, política, información.',
    responsibility: 'comunicar-texto-libre',
    group: 'content',
    capabilities: [],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [
      cfg('title', 'text', 'Titulo', { max: 120 }),
      cfg('body', 'textarea', 'Contenido', { required: true, max: 4000 }),
      cfg('columns', 'select', 'Columnas', { options: ['1', '2'] }),
    ],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Image',
    label: 'Imagen',
    description: 'Una imagen a tamano completo con pie opcional.',
    responsibility: 'mostrar-una-imagen',
    group: 'content',
    capabilities: [],
    media: { kind: 'image', min: 1, max: 1 },
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('image', 'media-ref', 'Imagen', { required: true }), cfg('caption', 'text', 'Pie', { max: 160 })],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'ImageGallery',
    label: 'Galeria de imagenes',
    description: 'Mosaico de imagenes del trabajo o del local.',
    responsibility: 'mostrar-una-coleccion-de-imagenes',
    group: 'content',
    capabilities: ['GALLERY'],
    media: { kind: 'image', min: 3, max: 30 },
    responsive: { mobile: 'scroll-snap', tablet: 'grid-2', desktop: 'masonry', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('columns', 'select', 'Columnas', { options: ['2', '3', '4'] })],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Video',
    label: 'Video',
    description: 'Video en linea con poster y controles opcionales.',
    responsibility: 'reproducir-un-video-en-linea',
    group: 'content',
    capabilities: ['VIDEO'],
    media: video,
    responsive: { mobile: 'focus-media', desktop: 'split', reducedMotion: 'disable-autoplay' },
    configSchema: [
      cfg('video', 'media-ref', 'Video', { required: true }),
      cfg('poster', 'media-ref', 'Poster', { required: true }),
      cfg('title', 'text', 'Titulo', { max: 120 }),
      cfg('controls', 'boolean', 'Mostrar controles'),
      cfg('autoplay', 'boolean', 'Reproducir solo'),
    ],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'VideoGallery',
    label: 'Galeria de videos',
    description: 'Serie de videos con poster. Cae a imagenes sin medios.',
    responsibility: 'reproducir-una-coleccion-de-videos',
    group: 'content',
    capabilities: ['VIDEO'],
    media: video,
    responsive: { mobile: 'scroll-snap', tablet: 'grid-2', desktop: 'grid-3', reducedMotion: 'disable-autoplay' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('poster', 'media-ref', 'Poster de respaldo')],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Button',
    label: 'Boton',
    description: 'Enlace de accion con destino verificable.',
    responsibility: 'ofrecer-una-accion-directa',
    group: 'conversion',
    capabilities: [],
    media: none,
    responsive: { mobile: 'stack', reducedMotion: 'freeze' },
    configSchema: [
      cfg('label', 'text', 'Texto', { required: true, max: 40 }),
      cfg('action', 'select', 'Accion', { options: ['whatsapp', 'call', 'email', 'link'], required: true }),
      cfg('href', 'text', 'Destino', { max: 500, dependsOn: { field: 'action', equals: 'link' } }),
    ],
    actions: ['whatsapp', 'call', 'email', 'link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'CTA',
    label: 'Llamado a la accion',
    description: 'Bloque de conversion con una accion principal.',
    responsibility: 'pedir-una-accion-principal',
    group: 'conversion',
    capabilities: [],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [
      cfg('title', 'text', 'Titulo', { max: 120 }),
      cfg('body', 'textarea', 'Texto', { max: 400 }),
      cfg('action', 'select', 'Accion', { options: ['whatsapp', 'call', 'email', 'booking', 'lead', 'link'] }),
    ],
    actions: ['whatsapp', 'call', 'email', 'booking', 'lead', 'link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },

  // ── COMERCIO ───────────────────────────────────────────────────────────
  {
    id: 'Products',
    label: 'Productos',
    description: 'Catalogo del negocio: grilla, lista o destacado.',
    responsibility: 'mostrar-el-catalogo',
    group: 'commerce',
    capabilities: ['CATALOG'],
    media: { kind: 'image', min: 0, max: 60 },
    responsive: { mobile: 'scroll-snap', tablet: 'grid-2', desktop: 'grid-4', reducedMotion: 'freeze' },
    configSchema: [
      cfg('title', 'text', 'Titulo', { max: 120 }),
      cfg('limit', 'number', 'Cuantos mostrar', { min: 3, max: 60 }),
      cfg('layout', 'select', 'Diseno', { options: ['grid', 'list', 'featured'] }),
      cfg('showPrices', 'boolean', 'Mostrar precios'),
    ],
    actions: ['link', 'cart'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'ProductFeatured',
    label: 'Producto destacado',
    description: 'Un solo producto, en grande, para una promocion puntual.',
    responsibility: 'destacar-un-producto',
    group: 'commerce',
    capabilities: ['CATALOG'],
    media: { kind: 'image', min: 0, max: 1 },
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('productId', 'text', 'Producto')],
    actions: ['link', 'cart'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Promotions',
    label: 'Promociones',
    description: 'Ofertas y descuentos vigentes.',
    responsibility: 'mostrar-promociones-vigentes',
    group: 'commerce',
    capabilities: ['PROMOTIONS'],
    media: { kind: 'image', min: 0, max: 12 },
    responsive: { mobile: 'stack', tablet: 'grid-2', desktop: 'grid-3', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('limit', 'number', 'Cuantas mostrar', { min: 1, max: 12 })],
    actions: ['whatsapp', 'link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Properties',
    label: 'Propiedades',
    description: 'Listado de propiedades del negocio.',
    responsibility: 'mostrar-propiedades',
    group: 'commerce',
    capabilities: ['PROPERTIES'],
    media: { kind: 'image', min: 0, max: 40 },
    responsive: { mobile: 'single-column', tablet: 'grid-2', desktop: 'grid-3', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('limit', 'number', 'Cuantas mostrar', { min: 1, max: 40 })],
    actions: ['link', 'whatsapp'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'PropertyFeatured',
    label: 'Propiedad destacada',
    description: 'Una propiedad en grande con sus datos.',
    responsibility: 'destacar-una-propiedad',
    group: 'commerce',
    capabilities: ['PROPERTIES'],
    media: { kind: 'image', min: 0, max: 1 },
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('propertyId', 'text', 'Propiedad')],
    actions: ['link', 'whatsapp'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  // ── SERVICIOS ──────────────────────────────────────────────────────────
  {
    id: 'Services',
    label: 'Servicios',
    description: 'Lo que el negocio ofrece, con precios si los tiene.',
    responsibility: 'mostrar-los-servicios',
    group: 'services',
    capabilities: ['SERVICES'],
    media: { kind: 'image', min: 0, max: 40 },
    responsive: { mobile: 'stack', tablet: 'grid-2', desktop: 'grid-3', reducedMotion: 'freeze' },
    configSchema: [
      cfg('title', 'text', 'Titulo', { max: 120 }),
      cfg('limit', 'number', 'Cuantos mostrar', { min: 1, max: 40 }),
      cfg('showPrices', 'boolean', 'Mostrar precios'),
    ],
    actions: ['booking', 'whatsapp', 'link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Booking',
    label: 'Reservas',
    description: 'Agenda con los horarios que el negocio configuro.',
    responsibility: 'permitir-agendar-una-hora',
    group: 'services',
    capabilities: ['BOOKING'],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [
      cfg('title', 'text', 'Titulo', { max: 120 }),
      cfg('body', 'textarea', 'Texto', { max: 300 }),
    ],
    actions: ['booking', 'whatsapp'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },

  // ── CONFIANZA ──────────────────────────────────────────────────────────
  {
    id: 'Testimonials',
    label: 'Testimonios',
    description: 'Opiniones de clientes.',
    responsibility: 'mostrar-testimonios',
    group: 'trust',
    capabilities: ['TESTIMONIALS'],
    media: { kind: 'image', min: 0, max: 20 },
    responsive: { mobile: 'scroll-snap', tablet: 'grid-2', desktop: 'grid-3', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('limit', 'number', 'Cuantos mostrar', { min: 1, max: 20 })],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Team',
    label: 'Equipo',
    description: 'Las personas que atienden.',
    responsibility: 'mostrar-el-equipo',
    group: 'trust',
    capabilities: ['TEAM'],
    media: { kind: 'image', min: 0, max: 20 },
    responsive: { mobile: 'stack', tablet: 'grid-2', desktop: 'grid-4', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 })],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'FAQ',
    label: 'Preguntas frecuentes',
    description: 'Resuelve las dudas habituales.',
    responsibility: 'responder-preguntas-frecuentes',
    group: 'trust',
    capabilities: ['FAQ'],
    media: none,
    responsive: { mobile: 'collapse', tablet: 'two-column', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 })],
    actions: [],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  // ── CONTACTO / UBICACIÓN / CIERRE ──────────────────────────────────────
  {
    id: 'Contact',
    label: 'Contacto',
    description: 'Datos de contacto y formulario de consultas.',
    responsibility: 'permitir-contactar-al-negocio',
    group: 'conversion',
    capabilities: ['CONTACT'],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('showForm', 'boolean', 'Mostrar formulario')],
    actions: ['whatsapp', 'call', 'email', 'lead'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'WhatsApp',
    label: 'Boton de WhatsApp',
    description: 'Invita a escribir directamente al negocio.',
    responsibility: 'ofrecer-contacto-directo-por-whatsapp',
    group: 'conversion',
    capabilities: ['WHATSAPP'],
    media: none,
    responsive: { mobile: 'stack', reducedMotion: 'freeze' },
    configSchema: [cfg('label', 'text', 'Texto', { max: 40 })],
    actions: ['whatsapp'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Map',
    label: 'Ubicacion',
    description: 'Mapa y direccion del negocio.',
    responsibility: 'mostrar-donde-queda-el-negocio',
    group: 'location',
    capabilities: ['MAP'],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 })],
    actions: ['map'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'SocialLinks',
    label: 'Redes sociales',
    description: 'Links a los perfiles del negocio.',
    responsibility: 'enlazar-las-redes-del-negocio',
    group: 'info',
    capabilities: ['SOCIALS'],
    media: none,
    responsive: { mobile: 'stack', reducedMotion: 'freeze' },
    configSchema: [],
    actions: ['link'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'LeadForm',
    label: 'Formulario de contacto',
    description: 'Formulario que crea un lead real en el negocio.',
    responsibility: 'capturar-una-solicitud-del-cliente',
    group: 'conversion',
    capabilities: ['CONTACT'],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('title', 'text', 'Titulo', { max: 120 }), cfg('body', 'textarea', 'Texto', { max: 300 })],
    actions: ['lead'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
  {
    id: 'Footer',
    label: 'Pie de pagina',
    description: 'Cierre con datos del negocio y enlaces legales.',
    responsibility: 'cerrar-la-pagina-con-datos-legales',
    group: 'footer',
    capabilities: [],
    media: none,
    responsive: { mobile: 'stack', desktop: 'split', reducedMotion: 'freeze' },
    configSchema: [cfg('showSocials', 'boolean', 'Mostrar redes'), cfg('legalNote', 'text', 'Nota legal', { max: 200 })],
    actions: ['link', 'whatsapp'],
    renderInV2: true,
    sinceManifestVersion: 1,
  },
];

const BY_ID = new Map(BLOCK_DEFINITIONS.map((block) => [block.id, block]));

/** Identificadores de todos los bloques, en orden de catálogo. */
export const BLOCK_IDS: string[] = BLOCK_DEFINITIONS.map((block) => block.id);

/** Bloque por id. Devuelve `undefined` si no existe (nunca lanza). */
export function getBlock(id: string | null | undefined): BlockDefinition | undefined {
  if (!id) return undefined;
  return BY_ID.get(String(id));
}

export function hasBlock(id: string | null | undefined): boolean {
  return getBlock(id) !== undefined;
}

/** Bloques que el renderer único ya compone de verdad. */
export function renderableBlocks(): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((block) => block.renderInV2);
}

/** Bloques de un grupo, en el orden del catálogo. */
export function blocksInGroup(group: BlockDefinition['group']): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((block) => block.group === group);
}

/**
 * Detecta bloques que resuelven la MISMA responsabilidad con ids distintos.
 * Es la guarda contra duplicar "la misma idea con otro nombre".
 * El catálogo correcto devuelve SIEMPRE una lista vacía (lo exige un test).
 */
export function findDuplicateResponsibilities(): Array<{ responsibility: string; ids: string[] }> {
  const byResponsibility = new Map<string, string[]>();
  for (const block of BLOCK_DEFINITIONS) {
    const list = byResponsibility.get(block.responsibility) || [];
    list.push(block.id);
    byResponsibility.set(block.responsibility, list);
  }
  return [...byResponsibility.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([responsibility, ids]) => ({ responsibility, ids }));
}

/** Ids de bloque disponibles a partir de una versión de manifest. */
export function blocksForManifestVersion(manifestVersion: number): string[] {
  return BLOCK_DEFINITIONS.filter((block) => block.sinceManifestVersion <= manifestVersion).map((block) => block.id);
}

/**
 * Cuántos medios del tipo pedido necesita un bloque y de qué tipo.
 * El renderer usa esto para decidir si el bloque puede renderizarse o debe
 * caer a su fallback (nunca a un placeholder vacío).
 */
export function mediaRequirementOf(blockId: string): BlockMediaRequirement | undefined {
  return getBlock(blockId)?.media;
}
