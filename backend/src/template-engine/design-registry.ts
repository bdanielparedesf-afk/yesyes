/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 â€” DesignRegistry (Fase 4.1).
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Antes, elegir una plantilla era una decisión DEFINITIVA: el negocio quedaba
 * atado al componente V3 de esa plantilla y no había vuelta atrás. Eso es
 * exactamente lo que la fase prohíbe.
 *
 * LA SOLUCIÃ“N
 * -----------
 * Una plantilla V3 deja de ser "el renderer del negocio" y pasa a ser un
 * PUNTO DE PARTIDA: un `DesignDefinition` que declara un layout, un tema y una
 * SECUENCIA DE BLOQUES. Al crear la página, ese diseño se materializa como un
 * manifest V2 con bloques reales del BlockRegistry.
 *
 *   Diseño inicial (V3)  ->  manifest V2 con bloques  ->  sitio del negocio
 *
 * El sitio SIEMPRE es V2. La plantilla V3 solo aportó la composición inicial.
 * Después el usuario puede cambiar de diseño, cambiar variantes de sección,
 * agregar, quitar y reordenar: nada de eso depende de la plantilla original.
 *
 * POR QUÃ‰ NO SE PIERDE CONTENIDO AL CAMBIAR DE DISEÃ‘O
 * ---------------------------------------------------
 * Porque el CONTENIDO (nombre, descripción, servicios, productos, imágenes,
 * testimonios, equipo, FAQ, CTA, contacto) vive en la base de datos y en la
 * CONFIG de los bloques. El diseño solo decide QUÃ‰ bloques hay, en qué orden y
 * con qué layout. `applyDesignChange()` preserva la config y solo cambia
 * layout, tema y composición.
 */

import { LAYOUT_IDS, type LayoutId } from './layout-registry';
import { getBlock } from './block-registry';
import { defaultVariantOf } from './variant-registry';
import { suggestedLayoutsForCategory, industryProfileOf } from './capabilities';
import { canonicalCategoryCode, categoryLabelOf } from '../utils/business-taxonomy';

/** Capas que toda página necesita para cumplir su función. */
const CORE_CAPABILITIES = ['HERO', 'CONTACT', 'FOOTER'] as const;

/**
 * Traducción CAPACIDAD -> BLOQUE. Es el puente entre el vocabulario del negocio
 * (SERVICES, CATALOG...) y el BlockRegistry, y es la razón por la que el
 * editor, el manifest y el renderer hablan el mismo idioma.
 */
export const CAPABILITY_TO_BLOCKS: Record<string, string[]> = {
  HERO: ['Hero'],
  ABOUT: ['Text'],
  SERVICES: ['Services'],
  PRICING: ['Services'],
  REPAIR: ['Services'],
  PRODUCTS: ['Products'],
  CATALOG: ['Products'],
  PROPERTIES: ['Properties'],
  GALLERY: ['ImageGallery'],
  PORTFOLIO: ['ImageGallery'],
  BEFORE_AFTER: ['ImageGallery'],
  VIDEO: ['Video'],
  FEATURES: ['Text'],
  STATS: ['Text'],
  BRANDS: ['Text'],
  SUBJECTS: ['Text'],
  PROMOTIONS: ['Promotions'],
  TESTIMONIALS: ['Testimonials'],
  REVIEWS: ['Testimonials'],
  TEAM: ['Team'],
  FAQ: ['FAQ'],
  BOOKING: ['Booking'],
  MAP: ['Map'],
  SOCIALS: ['SocialLinks'],
  WHATSAPP: ['WhatsApp'],
  CONTACT: ['Contact'],
  CONTACT_FORM: ['LeadForm'],
  LEADS: ['LeadForm'],
  CTA: ['CTA'],
  FOOTER: ['Footer'],
};

/** Orden legible de las secciones de una página, por capacidad. */
const CAPABILITY_ORDER: string[] = [
  'HERO', 'ABOUT', 'SERVICES', 'PRICING', 'REPAIR', 'SUBJECTS', 'FEATURES', 'BRANDS', 'STATS',
  'PRODUCTS', 'CATALOG', 'PROPERTIES', 'GALLERY', 'PORTFOLIO', 'BEFORE_AFTER', 'VIDEO',
  'PROMOTIONS', 'TEAM', 'TESTIMONIALS', 'REVIEWS', 'BOOKING', 'FAQ', 'MAP', 'OPENING_HOURS',
  'SOCIALS', 'WHATSAPP', 'CONTACT', 'CONTACT_FORM', 'LEADS', 'CTA', 'FOOTER',
];

const SECTION_LABELS: Record<string, string> = {
  HERO: 'Portada', ABOUT: 'Sobre el negocio', SERVICES: 'Servicios', PRICING: 'Precios',
  REPAIR: 'Reparaciones', SUBJECTS: 'Materias', FEATURES: 'Características', BRANDS: 'Marcas',
  STATS: 'Cifras', PRODUCTS: 'Productos', CATALOG: 'Catálogo', PROPERTIES: 'Propiedades',
  GALLERY: 'Galería', PORTFOLIO: 'Portafolio', BEFORE_AFTER: 'Antes y después', VIDEO: 'Video',
  PROMOTIONS: 'Promociones', TEAM: 'Equipo', TESTIMONIALS: 'Testimonios', REVIEWS: 'Reseñas',
  BOOKING: 'Reservas', FAQ: 'Preguntas frecuentes', MAP: 'Ubicación', OPENING_HOURS: 'Horarios',
  SOCIALS: 'Redes sociales', WHATSAPP: 'WhatsApp', CONTACT: 'Contacto', CONTACT_FORM: 'Formulario',
  LEADS: 'Solicitudes', CTA: 'Llamado a la acción', FOOTER: 'Pie de página',
};

export interface TemplateManifestTheme {
  palette: { primary: string; background: string; text: string; accent: string };
  radius: 'sharp' | 'soft' | 'rounded';
  mode: 'light' | 'dark';
  headingFont: 'sans' | 'serif' | 'display';
  bodyFont: 'sans' | 'serif';
}

/** Un bloque del diseño: identidad, variante y jerarquía. Nunca datos. */
export interface DesignBlock {
  block: string;
  variant: string | null;
  emphasis: 'primary' | 'secondary' | 'tertiary';
}

/** Una sección del diseño: qué bloques y con qué jerarquía. Nunca contenido. */
export interface DesignSection {
  id: string;
  label: string;
  order: number;
  blocks: DesignBlock[];
}

export interface DesignDefinition {
  /** Id estable del diseno. Es el codigo de la plantilla de origen. */
  id: string;
  /** Id de la plantilla en la base. Es lo que el editor envia al aplicar. */
  templateId: string;
  /** Nombre humano: "Veterinaria - Premium". Nunca el codigo. */
  label: string;
  styleLabel: string;
  category: string;
  layout: LayoutId;
  theme: Record<string, unknown>;
  sections: DesignSection[];
  capabilities: string[];
  navigationStyle: 'sticky' | 'minimal' | 'overlay' | 'drawer';
  description: string;
}

/** Filas de `business_templates` que el backend usa para derivar diseños. */
export interface DesignSourceRow {
  /** Id de la fila en business_templates. Es lo que el editor envia al aplicar. */
  templateId?: string;
  code: string;
  name?: string | null;
  category: string;
  style?: string | null;
  capabilities?: string[] | null;
}

/**
 * Paletas por layout. Un diseño cambia de verdad, no solo de color: la fuente,
 * el modo y el radio viajan con el layout.
 */
const LAYOUT_THEME: Record<string, TemplateManifestTheme> = {
  editorial: { palette: { primary: '#1c1917', background: '#fafaf9', text: '#1c1917', accent: '#9a3412' }, radius: 'sharp', mode: 'light', headingFont: 'serif', bodyFont: 'sans' },
  luxury: { palette: { primary: '#1a1a1a', background: '#ffffff', text: '#1a1a1a', accent: '#b08d57' }, radius: 'soft', mode: 'light', headingFont: 'display', bodyFont: 'serif' },
  cinematic: { palette: { primary: '#09090b', background: '#09090b', text: '#fafafa', accent: '#eab308' }, radius: 'sharp', mode: 'dark', headingFont: 'display', bodyFont: 'sans' },
  minimal: { palette: { primary: '#18181b', background: '#ffffff', text: '#18181b', accent: '#71717a' }, radius: 'soft', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
  bento: { palette: { primary: '#111827', background: '#f9fafb', text: '#111827', accent: '#4f46e5' }, radius: 'rounded', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
  asymmetric: { palette: { primary: '#0f172a', background: '#ffffff', text: '#0f172a', accent: '#0ea5e9' }, radius: 'soft', mode: 'light', headingFont: 'display', bodyFont: 'sans' },
  'gallery-first': { palette: { primary: '#0c0a09', background: '#0c0a09', text: '#fafaf9', accent: '#f97316' }, radius: 'sharp', mode: 'dark', headingFont: 'display', bodyFont: 'sans' },
  'video-first': { palette: { primary: '#0a0a0a', background: '#0a0a0a', text: '#fafafa', accent: '#ef4444' }, radius: 'sharp', mode: 'dark', headingFont: 'display', bodyFont: 'sans' },
  'commerce-first': { palette: { primary: '#111827', background: '#ffffff', text: '#111827', accent: '#059669' }, radius: 'soft', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
  portfolio: { palette: { primary: '#18181b', background: '#ffffff', text: '#18181b', accent: '#db2777' }, radius: 'sharp', mode: 'light', headingFont: 'display', bodyFont: 'sans' },
  immersive: { palette: { primary: '#020617', background: '#020617', text: '#f8fafc', accent: '#22d3ee' }, radius: 'soft', mode: 'dark', headingFont: 'display', bodyFont: 'sans' },
  corporate: { palette: { primary: '#0f172a', background: '#ffffff', text: '#0f172a', accent: '#1d4ed8' }, radius: 'sharp', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
  organic: { palette: { primary: '#1c1917', background: '#faf7f2', text: '#1c1917', accent: '#4d7c0f' }, radius: 'rounded', mode: 'light', headingFont: 'serif', bodyFont: 'serif' },
  'dark-premium': { palette: { primary: '#0a0a0a', background: '#0a0a0a', text: '#fafafa', accent: '#c9a227' }, radius: 'soft', mode: 'dark', headingFont: 'display', bodyFont: 'sans' },
  magazine: { palette: { primary: '#18181b', background: '#fafaf9', text: '#18181b', accent: '#be123c' }, radius: 'sharp', mode: 'light', headingFont: 'serif', bodyFont: 'serif' },
  'modern-commerce': { palette: { primary: '#111827', background: '#f9fafb', text: '#111827', accent: '#7c3aed' }, radius: 'rounded', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
};

/** Tema de un layout. Un layout sin tema declarado cae a `minimal`. */
export function themeOfLayout(layoutId: string): TemplateManifestTheme {
  return LAYOUT_THEME[layoutId] ?? LAYOUT_THEME.minimal!;
}

const LAYOUT_STYLE_LABELS: Record<string, string> = {
  editorial: 'Editorial', luxury: 'Lujo', cinematic: 'Cinemático', minimal: 'Minimal',
  bento: 'Bento', asymmetric: 'Asimétrico', 'gallery-first': 'Galería', 'video-first': 'Video',
  'commerce-first': 'Comercio', portfolio: 'Portafolio', immersive: 'Inmersivo',
  corporate: 'Corporativo', organic: 'Orgánico', 'dark-premium': 'Premium oscuro',
  magazine: 'Revista', 'modern-commerce': 'Comercio moderno',
};

const STYLE_TO_LAYOUT: Record<string, LayoutId> = {
  'dark premium': 'dark-premium', 'premium dark': 'dark-premium', dark: 'dark-premium', oscuro: 'dark-premium', elegante: 'dark-premium',
  premium: 'luxury', lujo: 'luxury', luxury: 'luxury', editorial: 'editorial', clasico: 'editorial',
  revista: 'magazine', magazine: 'magazine', minimalista: 'minimal', minimal: 'minimal', limpio: 'minimal',
  cine: 'cinematic', cinematic: 'cinematic', cinematico: 'cinematic', bento: 'bento', asimetrico: 'asymmetric', asymmetric: 'asymmetric',
  galeria: 'gallery-first', 'gallery first': 'gallery-first', galerico: 'gallery-first', video: 'video-first', audiovisual: 'video-first',
  comercio: 'commerce-first', 'comercio moderno': 'modern-commerce', 'modern commerce': 'modern-commerce', tienda: 'commerce-first',
  portafolio: 'portfolio', portfolio: 'portfolio', inmersivo: 'immersive', immersive: 'immersive',
  corporativo: 'corporate', corporate: 'corporate', organico: 'organic', organic: 'organic', profesional: 'corporate',
  amigable: 'organic', friendly: 'organic', calido: 'organic', calidez: 'organic', natural: 'organic', suave: 'organic',
  moderno: 'modern-commerce', modern: 'modern-commerce', contemporaneo: 'modern-commerce',
};

const DESIGN_DESCRIPTIONS: Record<string, string> = {
  editorial: 'Titulares grandes y ritmo de revista, con mucho aire entre secciones.',
  luxury: 'Espacio, contenido escaso y acento en la imagen. Nada compite por atención.',
  cinematic: 'Plena pantalla, contraste marcado y una sola acción a la vista.',
  minimal: 'Limpio y directo: la información justo donde debe estar.',
  bento: 'Tarjetas de tamaños diferentes que dan ritmo sin sentirse forzadas.',
  asymmetric: 'Composición asimétrica: una pieza grande y el resto acompañando.',
  'gallery-first': 'Las imágenes llevan la página; el texto las acompaña.',
  'video-first': 'El video abre la página y sostiene la narrativa.',
  'commerce-first': 'Catálogo siempre visible y conversión a la mano.',
  portfolio: 'Trabajo y proyectos al frente, texto al servicio de la imagen.',
  immersive: 'Pantalla completa y recorrido pausado.',
  corporate: 'Claro, estructurado y con datos a la vista.',
  organic: 'Cálido, natural y con tipografía amable.',
  'dark-premium': 'Oscuro, con acentos dorados y mucha profundidad.',
  magazine: 'Portadas, columnas y titulares de revista.',
  'modern-commerce': 'Grilla consistente con la tienda en primer plano.',
};

/** Normaliza un estilo para compararlo: minusculas, sin tildes y sin espacios extra. */
const normalizeStyle = (style: string): string =>
  String(style || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
const titleCase = (value: string): string =>
  String(value).split(' ').map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(' ');

const SECTION_ID_OVERRIDES: Record<string, string> = { HERO: 'inicio', CTA: 'cierre', FOOTER: 'pie' };

/** Id estable de sección a partir de la capacidad. */
function slugSectionId(capability: string): string {
  return SECTION_ID_OVERRIDES[capability] || capability.toLowerCase();
}

/** Primer bloque de una capacidad, o `null` si no mapea a ninguno. */
function blockOfCapability(capability: string): string | null {
  const mapped = CAPABILITY_TO_BLOCKS[capability];
  return mapped && mapped.length ? mapped[0]! : null;
}

/** Bloques concretos de una capacidad, con su variante por defecto. */
function blocksForCapability(capability: string): DesignBlock[] {
  const mapped = CAPABILITY_TO_BLOCKS[capability];
  if (!mapped || !mapped.length) return [];
  return mapped
    .filter((block) => getBlock(block)?.renderInV2)
    .map((block) => ({ block, variant: defaultVariantOf(block)?.id ?? null, emphasis: 'secondary' as const }));
}

/** Layout que le corresponde a un diseño según su estilo y rubro. */
function layoutForDesign(style: string, category: string): LayoutId {
  const byStyle = STYLE_TO_LAYOUT[normalizeStyle(style)];
  if (byStyle && (LAYOUT_IDS as string[]).includes(byStyle)) return byStyle;
  for (const candidate of suggestedLayoutsForCategory(category)) {
    if ((LAYOUT_IDS as string[]).includes(candidate)) return candidate as LayoutId;
  }
  return 'minimal';
}

const layoutNavigation = (layout: LayoutId): DesignDefinition['navigationStyle'] => {
  if (layout === 'cinematic' || layout === 'immersive' || layout === 'gallery-first') return 'overlay';
  if (layout === 'commerce-first' || layout === 'modern-commerce' || layout === 'corporate') return 'sticky';
  return 'minimal';
};

/** Estilo legible de un diseño. Nunca vacío ni un código. */
export function styleLabelForLayout(layout: LayoutId): string {
  return LAYOUT_STYLE_LABELS[layout] || 'Personalizado';
}

/**
 * Construye un diseño a partir de una plantilla.
 *
 * La plantilla aporta: el nombre, el estilo (que decide el layout y el tema) y
 * la lista de capacidades. De las capacidades sale la SECUENCIA DE BLOQUES.
 * No se copia ningún contenido: el manifest que se genere estará vacío de
 * datos y el negocio lo llenará con lo suyo.
 */
export function designFromTemplate(row: DesignSourceRow): DesignDefinition {
  const category = canonicalCategoryCode(row.category);
  const profile = industryProfileOf(category);
  const style = normalizeStyle(row.style || '') || normalizeStyle(row.name || '');
  const layout = layoutForDesign(style || row.name || '', category);

  // Capacidades del template + del rubro. El template nunca puede QUITAR una
  // capacidad del rubro: solo agregar. Y nada prohibido puede colarse.
  const forbidden = new Set(profile.forbiddenBlocks);
  const fromTemplate = (row.capabilities || []).filter((code) => {
    const block = blockOfCapability(code);
    return !block || !forbidden.has(block);
  });
  const wanted = new Set<string>([...CORE_CAPABILITIES, ...profile.capabilities, ...fromTemplate]);

  const sections: DesignSection[] = [];
  for (const capability of CAPABILITY_ORDER) {
    if (!wanted.has(capability)) continue;
    const blocks = blocksForCapability(capability);
    if (!blocks.length) continue;
    // Si dos capacidades rinden el mismo bloque, la primera manda: evita
    // duplicar "Servicios" y "Precios" como dos secciones idénticas.
    if (sections.some((section) => section.blocks.some((block) => blocks.some((next) => next.block === block.block)))) continue;
    sections.push({
      id: slugSectionId(capability),
      label: SECTION_LABELS[capability] || capability,
      order: (sections.length + 1) * 10,
      blocks,
    });
  }

  const resolvedLayout = STYLE_TO_LAYOUT[style];
  const resolvedStyle = resolvedLayout || style;
  return {
    id: String(row.code).toLowerCase(),
    templateId: row.templateId || String(row.code).toUpperCase(),
    label: `${categoryLabelOf(category)} · ${resolvedStyle ? titleCase(resolvedStyle) : styleLabelForLayout(layout)}`,
    styleLabel: resolvedStyle ? titleCase(resolvedStyle) : styleLabelForLayout(layout),
    category,
    layout,
    theme: themeOfLayout(layout) as unknown as Record<string, unknown>,
    sections,
    // Las capacidades del manifest son CODIGOS DE CAPACIDAD (los del catalogo),
    // nunca ids de bloque: el validador los contrasta con isCapabilityCode.
    capabilities: Array.from(new Set(wanted)),
    navigationStyle: layoutNavigation(layout),
    description: DESIGN_DESCRIPTIONS[layout] || 'Composición profesional lista para personalizar.',
  };
}

/** Catálogo de diseños de un rubro, deduplicado por identidad visual. */
export function designsForCategory(rows: DesignSourceRow[], category: string): DesignDefinition[] {
  const canonical = canonicalCategoryCode(category);
  const sameCategory = rows.filter((row) => canonicalCategoryCode(row.category) === canonical);
  const source = sameCategory.length ? sameCategory : rows;
  const seen = new Set<string>();
  const out: DesignDefinition[] = [];
  for (const row of source) {
    const design = designFromTemplate(row);
    const key = `${design.layout}|${design.sections.map((section) => section.blocks.map((block) => block.block).join('+')).join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(design);
  }
  return out;
}

/** Manifest con la forma que el motor usa. Duplica el tipo para no acoplar. */
export interface TemplateManifestLike {
  templateId: string;
  templateVersion: number;
  manifestVersion: number;
  businessCategory: string;
  style: string;
  layout: string;
  sections: Array<{
    id: string;
    label: string;
    order: number;
    hidden?: boolean;
    blocks: Array<{
      block: string;
      instanceId: string;
      config: Record<string, unknown>;
      hidden?: boolean;
      emphasis?: 'primary' | 'secondary' | 'tertiary';
    }>;
    responsive?: Record<string, unknown>;
  }>;
  capabilities: string[];
  theme: Record<string, unknown>;
  navigation: Record<string, unknown>;
  media: Record<string, unknown>;
  seo: Record<string, unknown>;
  availableActions: string[];
  legacy?: boolean;
}

/**
 * Materializa un diseño como manifest V2 listo para una instancia nueva.
 *
 * El manifest sale VACÍO DE DATOS a propósito: los bloques existen, con su
 * variante y su jerarquía, pero sin textos. El negocio los llena con lo suyo
 * desde el editor. Así el contenido nunca queda atrapado en la plantilla.
 */
export function manifestFromDesign(
  design: DesignDefinition,
  options: { instanceId: string; businessName?: string | null },
): TemplateManifestLike {
  const sections = design.sections.map((section) => ({
    id: section.id,
    label: section.label,
    order: section.order,
    hidden: false,
    blocks: section.blocks.map((block, index) => ({
      block: block.block,
      instanceId: `${section.id}-${block.block.toLowerCase()}${index > 0 ? `-${index + 1}` : ''}`,
      config: {},
      hidden: false,
      emphasis: index === 0 ? block.emphasis : 'secondary',
    })),
  }));

  const name = String(options.businessName || 'Tu negocio').trim();
  return {
    templateId: options.instanceId,
    templateVersion: 1,
    manifestVersion: 1,
    businessCategory: design.category,
    style: design.styleLabel,
    layout: design.layout,
    sections,
    capabilities: design.capabilities,
    theme: { ...design.theme } as unknown as Record<string, unknown>,
    navigation: {
      enabled: true,
      style: design.navigationStyle,
      links: sections.filter((section) => section.id !== 'pie').slice(0, 8).map((section) => ({ label: section.label, anchor: section.id })),
    },
    media: {
      requiredMedia: ['image'],
      video: {
        allowed: true,
        autoplayRequiresMuted: true,
        maxAutoplayDurationSec: 12,
        posterRequired: true,
        disableAutoplayOnReducedMotion: true,
      },
    },
    seo: {
      titleTemplate: name,
      description: `${name} · ${design.styleLabel}`,
      ogImageRequired: false,
      noIndexPreview: true,
    },
    availableActions: ['whatsapp'],
    legacy: false,
  };
}

interface ConfigEntry {
  config: Record<string, unknown>;
  hidden: boolean;
  emphasis: 'primary' | 'secondary' | 'tertiary';
  instanceId: string;
}

/** Aplica los overrides de la variante solo donde el usuario no opinio. */
function applyVariantConfig(current: Record<string, unknown>, block: string): Record<string, unknown> {
  const variant = defaultVariantOf(block);
  if (!variant) return { ...current };
  const out: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(variant.config)) {
    if (out[key] === undefined) out[key] = value;
  }
  return out;
}

/**
 * APLICA UN CAMBIO DE DISEÃ‘O SIN PERDER CONTENIDO.
 *
 * Este es el corazon del requisito "cambiar de diseño sin perder nada".
 *
 * Que hace:
 *  - cambia `layout`, `theme` y la composicion/orden de secciones;
 *  - CONSERVA la `config` de cada bloque que sobrevive al cambio;
 *  - conserva `hidden` y `emphasis` que eligio el usuario;
 *  - si el diseño nuevo no contempla un bloque que el usuario tenia, lo
 *    conserva al final en una seccion propia, con su config intacta.
 *
 * Que NUNCA hace:
 *  - borrar una seccion con contenido;
 *  - borrar la config de un bloque;
 *  - tocar los datos del negocio (no estan en el manifest).
 */
export function applyDesignChange(current: TemplateManifestLike, design: DesignDefinition): TemplateManifestLike {
  const next: TemplateManifestLike = JSON.parse(JSON.stringify(current));
  next.layout = design.layout;
  next.theme = { ...design.theme } as unknown as Record<string, unknown>;
  next.businessCategory = design.category;

  // Indice por BLOQUE, no por seccion: asi el contenido se reasocia aunque la
  // seccion cambie de id, de posicion o de nombre.
  const byBlock = new Map<string, ConfigEntry[]>();
  for (const section of current.sections || []) {
    for (const block of section.blocks || []) {
      const list = byBlock.get(block.block) || [];
      list.push({
        config: { ...(block.config || {}) },
        hidden: block.hidden === true,
        emphasis: block.emphasis || 'secondary',
        instanceId: block.instanceId,
      });
      byBlock.set(block.block, list);
    }
  }
  const consumed = new Map<string, number>();

  const sections: TemplateManifestLike['sections'] = [];
  for (const designSection of design.sections) {
    const blocks: TemplateManifestLike['sections'][number]['blocks'] = [];
    for (const designBlock of designSection.blocks) {
      if (!getBlock(designBlock.block)?.renderInV2) continue;
      const pool = byBlock.get(designBlock.block) || [];
      const index = consumed.get(designBlock.block) || 0;
      consumed.set(designBlock.block, index + 1);
      const previous = pool[index];
      blocks.push({
        block: designBlock.block,
        instanceId: previous?.instanceId || `${designSection.id}-${designBlock.block.toLowerCase()}${index > 0 ? `-${index + 1}` : ''}`,
        // La config del usuario GANA: la variante solo aporta lo que falta.
        config: applyVariantConfig(previous?.config || {}, designBlock.block),
        hidden: previous?.hidden === true,
        emphasis: previous?.emphasis || designBlock.emphasis,
      });
    }
    if (!blocks.length) continue;
    const existing = (current.sections || []).find((section) => section.id === designSection.id);
    sections.push({
      id: designSection.id,
      label: designSection.label,
      order: designSection.order,
      hidden: existing?.hidden === true,
      blocks,
      ...(existing?.responsive ? { responsive: existing.responsive } : {}),
    });
  }

  // Regla de no-perdida: todo bloque del usuario que el diseño nuevo no uso
  // sobrevive, con su config intacta, en una seccion propia al final.
  const leftovers: TemplateManifestLike['sections'][number]['blocks'] = [];
  for (const section of current.sections || []) {
    for (const block of section.blocks || []) {
      if (!getBlock(block.block)?.renderInV2) continue;
      const pool = byBlock.get(block.block) || [];
      const used = consumed.get(block.block) || 0;
      const position = pool.findIndex((entry) => entry.instanceId === block.instanceId);
      if (position >= 0 && position < used) continue;
      leftovers.push({
        block: block.block,
        instanceId: block.instanceId,
        config: { ...(block.config || {}) },
        hidden: block.hidden === true,
        emphasis: block.emphasis || 'secondary',
      });
    }
  }
  if (leftovers.length) {
    sections.push({ id: 'extras', label: 'Contenido adicional', order: 900, hidden: false, blocks: leftovers });
  }

  next.sections = sections;
  next.capabilities = design.capabilities;
  next.navigation = {
    ...(current.navigation || { enabled: true, style: design.navigationStyle, links: [] }),
    style: design.navigationStyle,
    links: sections
      .filter((section) => section.id !== 'pie' && section.id !== 'extras')
      .slice(0, 8)
      .map((section) => ({ label: section.label, anchor: section.id })),
  };
  return next;
}

export { CAPABILITY_ORDER, SECTION_LABELS };
