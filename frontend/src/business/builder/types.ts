/**
 * YESYES BUSINESS — TIPOS DEL EDITOR (Fase 4.2 · C).
 *
 * El manifest V2 es la fuente de verdad. `legacySections` existe únicamente para
 * que una pagina V3 antigua sin SiteInstance siga renderizando; no es una segunda
 * representacion que se sincronice con el manifest.
 */

export type BuilderDevice = 'desktop' | 'tablet' | 'mobile';
export type BuilderSaveState = 'CLEAN' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR';

/** Seccion legacy (V3). Solo lectura en el editor V2. */
export type BuilderSection = { id: string; enabled: boolean; order: number };

/** Bloque dentro de una seccion del manifest. */
export type BuilderManifestBlock = { block: string; instanceId: string; config?: Record<string, unknown>; hidden?: boolean; emphasis?: string };

/** Seccion del manifest V2: es la unidad que ve y ordena el usuario. */
export type BuilderManifestSection = { id: string; label: string; order: number; hidden?: boolean; blocks: BuilderManifestBlock[] };

/** Manifest V2 minimo que necesita el editor. */
export type BuilderManifest = { manifestVersion?: number; layout?: string; legacy?: boolean; sections?: BuilderManifestSection[]; [key: string]: unknown };

/** C2: la sidebar se construye EXCLUSIVAMENTE desde aqui. */
export type BuilderSidebarSection = { instanceId: string; id: string; type: string; label: string; enabled: boolean; order: number; blockCount: number };

export type BuilderSnapshot = { business: any; manifest: BuilderManifest | null };

/**
 * E — El documento editable del editor es business + manifest, juntos.
 * Un snapshot representa una unidad: nunca business con manifest viejo, ni al reves.
 */
export type BuilderState = BuilderSnapshot & {
  legacySections: BuilderSection[];
  selectedSection: string; selectedElement: string | null; device: BuilderDevice;
  saveState: BuilderSaveState; error: string; preview: boolean;
  /** Conflicto de revision: el guardado se detiene y se avisa al usuario. */
  conflict: boolean;
  history: BuilderSnapshot[]; future: BuilderSnapshot[];
  /**
   * E §12 — Estado con el que se CARGÓ el borrador. `DISCARD` vuelve aquí, no a
   * `history[0]`: la posicion 0 del historial depende de quantas ediciones hubo
   * y no representa con certeza el estado inicial del documento.
   */
  initialDraft: BuilderSnapshot | null;
  /**
   * E §7/§8 — Contador que sube con cada cambio de estado YA persistible
   * (edicion, undo, redo, discard). El editor lo observa para encolar el autosave:
   * asi un Undo/Redo se guarda igual que una edicion normal, y `LOAD` (que no es
   * una edicion) no genera un guardado espurio.
   */
  persistTick: number;
  /** E §6 — Agrupacion de edicion continua (escribir sin generar un paso por tecla). */
  lastCoalesceKey: string | null; lastCoalesceAt: number;
};

/** E §13 — Tope del historial: evita crecimiento infinito sin perder el trabajo reciente. */
export const MAX_HISTORY = 40;

/**
 * E §6 — Ventana de agrupacion. Dos ediciones con la misma clave dentro de esta
 * ventana forman UN solo paso de undo ("escribir el titulo" es un paso, no N).
 */
export const COALESCE_MS = 800;

/** Acciones de edicion del documento, con agrupacion opcional. */
type EditMeta = { coalesceKey?: string; at?: number };

export type BuilderAction =
  | { type: 'LOAD'; business: any; manifest: BuilderManifest | null; legacySections?: BuilderSection[] }
  | ({ type: 'PATCH_BUSINESS'; patch: Record<string, unknown> } & EditMeta)
  | ({ type: 'SET_BUSINESS'; business: any } & EditMeta)
  | ({ type: 'SET_MANIFEST'; manifest: BuilderManifest | null } & EditMeta)
  | { type: 'SET_LEGACY_SECTIONS'; sections: BuilderSection[] }
  | { type: 'SELECT'; section: string }
  | { type: 'DEVICE'; device: BuilderDevice }
  | { type: 'PREVIEW'; value: boolean }
  | { type: 'SAVE_START' } | { type: 'SAVE_DONE' } | { type: 'SAVE_ERROR'; error: string } | { type: 'SAVE_CONFLICT'; error: string }
  | { type: 'UNDO' } | { type: 'REDO' } | { type: 'DISCARD' };

/** E §17 — Los botones reflejan si REALMENTE hay a donde ir. */
export const canUndo = (state: Pick<BuilderState, 'history'>): boolean => state.history.length > 0;
export const canRedo = (state: Pick<BuilderState, 'future'>): boolean => state.future.length > 0;

export const normalizeSections = (sections: BuilderSection[]): BuilderSection[] => sections.map((section, index) => ({ ...section, order: (index + 1) * 10 }));

/**
 * C3 — Llave de la UI de configuración a partir del Manifest.
 *
 * El inspector sigue ofreciendo los MISMOS campos de siempre (contenido,
 * contacto, SEO, redes). Lo que cambia es de dónde sale la selección: ahora
 * viene del Manifest V2, así que se traduce el BLOQUE del manifest a la
 * capability que el inspector ya conoce.
 *
 * Es una traducción de presentación, no una fuente de verdad: el manifest sigue
 * mandando sobre qué existe en la página.
 */
const BLOCK_TO_CAPABILITY: Record<string, string> = {
  Hero: 'HERO',
  HeroVideo: 'HERO',
  Text: 'ABOUT',
  Image: 'ABOUT',
  Services: 'SERVICES',
  Products: 'PRODUCTS',
  ProductFeatured: 'PRODUCTS',
  Properties: 'PROPERTIES',
  PropertyFeatured: 'PROPERTIES',
  ImageGallery: 'GALLERY',
  VideoGallery: 'VIDEO',
  // `Video` es una seccion con video propio: compartir la capability GALLERY
  // con `ImageGallery` hacia que la busqueda inversa devolviera la seccion
  // equivocada y el inspector no mostrara sus campos de medio.
  Video: 'VIDEO',
  Promotions: 'PROMOTIONS',
  Booking: 'BOOKING',
  Testimonials: 'TESTIMONIALS',
  Team: 'TEAM',
  FAQ: 'FAQ',
  Map: 'MAP',
  Contact: 'CONTACT',
  WhatsApp: 'WHATSAPP',
  SocialLinks: 'SOCIALS',
  LeadForm: 'CONTACT',
  CTA: 'CTA',
  Footer: 'FOOTER',
};

/** Capability que el inspector debe mostrar para una sección del manifest. */
export function capabilityOfManifestSection(section: { id: string; blocks?: Array<{ block: string }> } | null | undefined): string {
  if (!section) return '';
  for (const block of section.blocks || []) {
    const capability = BLOCK_TO_CAPABILITY[block.block];
    if (capability) return capability;
  }
  return String(section.id || '').toUpperCase();
}

/** Búsqueda de la sección del manifest que corresponde a una capability. */
export function manifestSectionOfCapability(manifest: BuilderManifest | null | undefined, capability: string): BuilderManifestSection | null {
  const sections = Array.isArray(manifest?.sections) ? manifest!.sections! : [];
  return sections.find((section) => capabilityOfManifestSection(section) === capability) || null;
}

/**
 * C2 — Lista de secciones del editor.
 *
 * FUENTE UNICA: `manifest.sections`. Nunca `business.visual.sections`.
 * Cada entrada se identifica por su `instanceId` (identidad estable del bloque
 * dentro del manifest), su `type` (bloque) y su `enabled` (`hidden`).
 */
/**
 * FASE 5 §8 — Variante ACTIVA de cada sección, leída del manifest.
 *
 * La variante no es un campo propio del bloque: es el resultado de aplicar los
 * overrides de la variante sobre el `config` (p. ej. `presentation`). Por eso se
 * deduce del `config` guardado y no de un `variantId` aparte: así sobrevive a un
 * F5 sin necesitar un campo nuevo en el manifest.
 *
 * Un bloque sin `presentation` en su `config` simplemente no tiene variante
 * activa: la UI no marca ninguna, y el backend sigue la variante por defecto.
 */
export function activeVariantBySection(manifest: BuilderManifest | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of Array.isArray(manifest?.sections) ? manifest!.sections! : []) {
    for (const block of Array.isArray(section.blocks) ? section.blocks : []) {
      const presentation = (block.config || {}).presentation;
      if (typeof presentation === 'string' && presentation) out[section.id] = presentation;
    }
  }
  return out;
}

export function manifestSidebarSections(manifest: BuilderManifest | null | undefined): BuilderSidebarSection[] {
  const sections = Array.isArray(manifest?.sections) ? manifest!.sections! : [];
  return sections
    .filter((section) => Boolean(section && section.id))
    .map((section) => {
      const blocks = Array.isArray(section.blocks) ? section.blocks : [];
      return {
        instanceId: String(section.id),
        id: String(section.id),
        type: String(blocks[0]?.block || section.id),
        label: String(section.label || section.id),
        enabled: section.hidden !== true,
        order: Number(section.order ?? 0),
        blockCount: blocks.length,
      };
    })
    .sort((a, b) => a.order - b.order);
}
