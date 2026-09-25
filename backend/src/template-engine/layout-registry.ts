/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — LayoutRegistry (Fase 3).
 *
 * Un layout NO es "el mismo template con otro color". Un layout decide:
 *  - `structure`: cómo se componen las secciones;
 *  - `hierarchy`: qué se ve primero y con cuánto peso;
 *  - `navigation`: tipo de navegación y densidad;
 *  - `gridStrategy`: cómo se distribuyen las piezas repetidas;
 *  - `textImageRelation`: cómo se relacionan texto e imagen;
 *  - `density`: cuánto respira la página;
 *  - `responsive`: qué pasa con esa composición en mobile.
 *
 * La paleta, tipografía y radios NO son un layout: son el `theme` del
 * manifest. Por eso `layoutFingerprint` no incluye el theme y dos
 * plantillas con distinto layout nunca son la misma identidad visual.
 */

import { BLOCK_IDS } from './block-registry';

export type LayoutId =
  | 'editorial' | 'luxury' | 'cinematic' | 'minimal' | 'bento' | 'asymmetric'
  | 'gallery-first' | 'video-first' | 'commerce-first' | 'portfolio' | 'immersive'
  | 'corporate' | 'organic' | 'dark-premium' | 'magazine' | 'modern-commerce';

export interface LayoutStructure {
  container: 'narrow' | 'standard' | 'wide' | 'full-bleed';
  sectionRhythm: 'airy' | 'balanced' | 'compact' | 'edge-to-edge';
  navigation: 'sticky' | 'minimal' | 'overlay' | 'drawer' | 'none';
}

export interface LayoutHierarchy {
  leadBlock: string;
  emphasis: Array<'primary' | 'secondary' | 'tertiary'>;
  fullWidthLead: boolean;
}

export interface LayoutGridStrategy {
  desktopColumns: 1 | 2 | 3 | 4;
  tabletColumns: 1 | 2 | 3;
  mobileOverflow: 'stack' | 'scroll-snap' | 'carousel' | 'focus';
  masonry: boolean;
}

export interface LayoutResponsiveStrategy {
  /** Qué se sacrifica primero cuando la pantalla es chica. */
  mobilePriority: 'content' | 'media' | 'action';
  videoOnMobile: 'poster-only' | 'inline-player' | 'background-muted';
  collapseNavigation: boolean;
}

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  description: string;
  structure: LayoutStructure;
  hierarchy: LayoutHierarchy;
  grid: LayoutGridStrategy;
  textImageRelation: 'side-by-side' | 'image-dominant' | 'text-dominant' | 'stacked' | 'overlay';
  density: 'spacious' | 'comfortable' | 'compact';
  responsive: LayoutResponsiveStrategy;
  preferredBlocks: string[];
  /** true si el layout tiene composición real en el renderer único. */
  renderInV2: boolean;
  sinceManifestVersion: number;
}

const layout = (definition: LayoutDefinition): LayoutDefinition => definition;

export const LAYOUT_DEFINITIONS: LayoutDefinition[] = [
  layout({
    id: 'editorial',
    label: 'Editorial',
    description: 'Titulares grandes, texto en ancho de columna, ritmo de revista.',
    structure: { container: 'narrow', sectionRhythm: 'airy', navigation: 'minimal' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'secondary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 2, tabletColumns: 2, mobileOverflow: 'stack', masonry: false },
    textImageRelation: 'side-by-side',
    density: 'spacious',
    responsive: { mobilePriority: 'content', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Text', 'ImageGallery', 'Testimonials', 'CTA', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'luxury',
    label: 'Lujo',
    description: 'Mucho aire, contenido escaso, acento en la imagen.',
    structure: { container: 'standard', sectionRhythm: 'edge-to-edge', navigation: 'minimal' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 1, tabletColumns: 1, mobileOverflow: 'focus', masonry: false },
    textImageRelation: 'image-dominant',
    density: 'spacious',
    responsive: { mobilePriority: 'media', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Image', 'ImageGallery', 'CTA', 'WhatsApp', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'cinematic',
    label: 'Cinemático',
    description: 'Pantalla completa, texto sobre la imagen, transiciones.',
    structure: { container: 'full-bleed', sectionRhythm: 'edge-to-edge', navigation: 'overlay' },
    hierarchy: { leadBlock: 'HeroVideo', emphasis: ['primary', 'secondary'], fullWidthLead: true },
    grid: { desktopColumns: 2, tabletColumns: 1, mobileOverflow: 'focus', masonry: false },
    textImageRelation: 'overlay',
    density: 'comfortable',
    responsive: { mobilePriority: 'media', videoOnMobile: 'background-muted', collapseNavigation: true },
    preferredBlocks: ['HeroVideo', 'Video', 'VideoGallery', 'ImageGallery', 'CTA', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'minimal',
    label: 'Minimal',
    description: 'Pocos bloques, mucho espacio, sin adornos.',
    structure: { container: 'narrow', sectionRhythm: 'airy', navigation: 'none' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary'], fullWidthLead: false },
    grid: { desktopColumns: 1, tabletColumns: 1, mobileOverflow: 'stack', masonry: false },
    textImageRelation: 'stacked',
    density: 'spacious',
    responsive: { mobilePriority: 'content', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Text', 'Services', 'Contact', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'bento',
    label: 'Bento',
    description: 'Celdas de tamaños distintos ordenadas en rejilla.',
    structure: { container: 'wide', sectionRhythm: 'balanced', navigation: 'sticky' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'secondary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: true },
    textImageRelation: 'side-by-side',
    density: 'compact',
    responsive: { mobilePriority: 'action', videoOnMobile: 'inline-player', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Products', 'Services', 'Testimonials', 'FAQ', 'Contact', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'asymmetric',
    label: 'Asimétrico',
    description: 'Columnas desiguales, contenido descentrado.',
    structure: { container: 'wide', sectionRhythm: 'balanced', navigation: 'minimal' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: true },
    textImageRelation: 'text-dominant',
    density: 'comfortable',
    responsive: { mobilePriority: 'content', videoOnMobile: 'inline-player', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Text', 'Image', 'Products', 'CTA', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'gallery-first',
    label: 'Galeria primero',
    description: 'El trabajo se ve antes que la palabra.',
    structure: { container: 'full-bleed', sectionRhythm: 'balanced', navigation: 'minimal' },
    hierarchy: { leadBlock: 'ImageGallery', emphasis: ['primary', 'secondary'], fullWidthLead: true },
    grid: { desktopColumns: 4, tabletColumns: 3, mobileOverflow: 'scroll-snap', masonry: true },
    textImageRelation: 'image-dominant',
    density: 'compact',
    responsive: { mobilePriority: 'media', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'ImageGallery', 'VideoGallery', 'Testimonials', 'Contact', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'video-first',
    label: 'Video primero',
    description: 'El video es la portada; las imagenes son de apoyo.',
    // Distinto de `cinematic`: aqui el contenido conserva caja y respira, y el
    // video vive dentro de la pagina en vez de ocupar la pantalla completa.
    structure: { container: 'wide', sectionRhythm: 'balanced', navigation: 'sticky' },
    hierarchy: { leadBlock: 'HeroVideo', emphasis: ['primary', 'secondary'], fullWidthLead: false },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'focus', masonry: false },
    textImageRelation: 'overlay',
    density: 'comfortable',
    responsive: { mobilePriority: 'media', videoOnMobile: 'background-muted', collapseNavigation: true },
    preferredBlocks: ['HeroVideo', 'Video', 'VideoGallery', 'Services', 'Booking', 'Contact', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'commerce-first',
    label: 'Comercio primero',
    description: 'El catalogo manda; la pagina vende antes de contar.',
    structure: { container: 'wide', sectionRhythm: 'compact', navigation: 'sticky' },
    hierarchy: { leadBlock: 'Products', emphasis: ['primary', 'secondary'], fullWidthLead: false },
    grid: { desktopColumns: 4, tabletColumns: 3, mobileOverflow: 'scroll-snap', masonry: false },
    textImageRelation: 'image-dominant',
    density: 'compact',
    responsive: { mobilePriority: 'action', videoOnMobile: 'inline-player', collapseNavigation: true },
    preferredBlocks: ['Products', 'ProductFeatured', 'Promotions', 'Services', 'FAQ', 'WhatsApp', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'portfolio',
    label: 'Portafolio',
    description: 'Proyectos grandes, poco texto, foco en el trabajo.',
    structure: { container: 'wide', sectionRhythm: 'airy', navigation: 'minimal' },
    hierarchy: { leadBlock: 'ImageGallery', emphasis: ['primary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: true },
    textImageRelation: 'image-dominant',
    density: 'spacious',
    responsive: { mobilePriority: 'media', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'ImageGallery', 'Video', 'Testimonials', 'Booking', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'immersive',
    label: 'Inmersivo',
    description: 'Cobertura total, sin caja, sin costuras visibles.',
    structure: { container: 'full-bleed', sectionRhythm: 'edge-to-edge', navigation: 'overlay' },
    hierarchy: { leadBlock: 'HeroVideo', emphasis: ['primary', 'secondary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 2, tabletColumns: 1, mobileOverflow: 'focus', masonry: false },
    textImageRelation: 'overlay',
    density: 'spacious',
    responsive: { mobilePriority: 'media', videoOnMobile: 'background-muted', collapseNavigation: true },
    preferredBlocks: ['HeroVideo', 'Video', 'VideoGallery', 'ImageGallery', 'Contact', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'corporate',
    label: 'Corporativo',
    description: 'Info densa, datos antes que imagenes.',
    structure: { container: 'standard', sectionRhythm: 'compact', navigation: 'sticky' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'secondary', 'tertiary'], fullWidthLead: false },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: false },
    textImageRelation: 'text-dominant',
    density: 'compact',
    responsive: { mobilePriority: 'content', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Text', 'Services', 'Team', 'FAQ', 'Contact', 'Map', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'organic',
    label: 'Organico',
    description: 'Bloques de tamano variable, ritmo calmo.',
    structure: { container: 'standard', sectionRhythm: 'airy', navigation: 'minimal' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'secondary'], fullWidthLead: false },
    grid: { desktopColumns: 2, tabletColumns: 2, mobileOverflow: 'stack', masonry: true },
    textImageRelation: 'side-by-side',
    density: 'spacious',
    responsive: { mobilePriority: 'content', videoOnMobile: 'poster-only', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Image', 'ImageGallery', 'Services', 'Testimonials', 'FAQ', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'dark-premium',
    label: 'Premium oscuro',
    description: 'Fondo oscuro, acentos finos, contraste alto.',
    structure: { container: 'standard', sectionRhythm: 'balanced', navigation: 'sticky' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: false },
    textImageRelation: 'image-dominant',
    density: 'comfortable',
    responsive: { mobilePriority: 'media', videoOnMobile: 'background-muted', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Image', 'Services', 'Team', 'Testimonials', 'Booking', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'magazine',
    label: 'Revista',
    description: 'Columnas de lectura y bloques cortos encadenados.',
    structure: { container: 'wide', sectionRhythm: 'balanced', navigation: 'sticky' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'secondary', 'tertiary'], fullWidthLead: true },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: true },
    textImageRelation: 'side-by-side',
    density: 'comfortable',
    responsive: { mobilePriority: 'content', videoOnMobile: 'inline-player', collapseNavigation: false },
    preferredBlocks: ['Hero', 'Text', 'Products', 'Image', 'Testimonials', 'FAQ', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
  layout({
    id: 'modern-commerce',
    label: 'Comercio moderno',
    description: 'Grilla consistente, conversion siempre a la vista.',
    // Distinto de `commerce-first`: aqui la tienda convive con relato, asi que
    // el catalogo NO es la seccion principal y la grilla es mas ancha de 2.
    structure: { container: 'standard', sectionRhythm: 'balanced', navigation: 'sticky' },
    hierarchy: { leadBlock: 'Hero', emphasis: ['primary', 'secondary', 'tertiary'], fullWidthLead: false },
    grid: { desktopColumns: 3, tabletColumns: 2, mobileOverflow: 'stack', masonry: false },
    textImageRelation: 'side-by-side',
    density: 'comfortable',
    responsive: { mobilePriority: 'action', videoOnMobile: 'inline-player', collapseNavigation: true },
    preferredBlocks: ['Hero', 'Products', 'ProductFeatured', 'Promotions', 'Services', 'FAQ', 'WhatsApp', 'Footer'],
    renderInV2: true,
    sinceManifestVersion: 1,
  }),
];

const LAYOUT_BY_ID = new Map(LAYOUT_DEFINITIONS.map((item) => [item.id, item]));

export const LAYOUT_IDS: LayoutId[] = LAYOUT_DEFINITIONS.map((item) => item.id);

export function getLayout(id: string | null | undefined): LayoutDefinition | undefined {
  if (!id) return undefined;
  return LAYOUT_BY_ID.get(String(id) as LayoutId);
}

export function hasLayout(id: string | null | undefined): boolean {
  return getLayout(id) !== undefined;
}

/** Layouts con composición real en el renderer único. */
export function renderableLayouts(): LayoutDefinition[] {
  return LAYOUT_DEFINITIONS.filter((item) => item.renderInV2);
}

/**
 * Fingerprint de identidad visual de un layout. No incluye el theme: por eso
 * "el mismo layout con otro color" NO produce una identidad nueva, y dos
 * layouts distintos nunca colapsan en la misma identidad.
 */
export function layoutFingerprint(id: string | null | undefined): string {
  const definition = getLayout(id);
  if (!definition) return `unknown:${String(id || '')}`;
  return [
    definition.structure.container,
    definition.structure.sectionRhythm,
    definition.structure.navigation,
    definition.hierarchy.leadBlock,
    definition.textImageRelation,
    definition.density,
    definition.grid.desktopColumns,
    definition.grid.mobileOverflow,
    definition.responsive.videoOnMobile,
  ].join('|');
}

/**
 * `preferredBlocks` que no existen en el BlockRegistry. Un registro sano
 * devuelve SIEMPRE `[]` (lo exige un test).
 */
export function findUnknownPreferredBlocks(): Array<{ layout: LayoutId; blockId: string }> {
  const known = new Set(BLOCK_IDS);
  const out: Array<{ layout: LayoutId; blockId: string }> = [];
  for (const definition of LAYOUT_DEFINITIONS) {
    for (const blockId of definition.preferredBlocks) {
      if (!known.has(blockId)) out.push({ layout: definition.id, blockId });
    }
  }
  return out;
}

/** Layouts donde un bloque encaja bien (para sugerir en el editor). */
export function layoutsSupporting(blockId: string): LayoutDefinition[] {
  return LAYOUT_DEFINITIONS.filter((item) => item.preferredBlocks.includes(blockId));
}
