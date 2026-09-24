/**
 * YESYES BUSINESS — Configuracion visual tipada y saneada.
 *
 * Regla: una configuracion invalida NUNCA rompe la pagina publica. Todo pasa
 * por `sanitizeVisualConfig()`, que aplica defaults, valida formato (colores
 * hex, fuentes de la lista permitida, rangos numericos) y descarta claves
 * desconocidas. El renderer consume SIEMPRE el resultado saneado.
 */

export type VisualTheme = 'light' | 'dark' | 'auto';
export type ButtonStyle = 'solid' | 'outline' | 'soft';
export type CardStyle = 'flat' | 'elevated' | 'bordered';
export type SectionSpacing = 'compact' | 'normal' | 'spacious';
export type ContainerWidth = 'narrow' | 'default' | 'wide';
export type HeaderStyle = 'minimal' | 'centered' | 'split';
export type FooterStyle = 'simple' | 'columns' | 'minimal';

export interface VisualConfig {
  theme: VisualTheme;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: number;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
  sectionSpacing: SectionSpacing;
  containerWidth: ContainerWidth;
  headerStyle: HeaderStyle;
  footerStyle: FooterStyle;
  background: string;
  typography: string;
  shadow: string;
  preset: string;
}

export const DEFAULT_VISUAL: VisualConfig = {
  theme: 'light',
  primaryColor: '#111827',
  secondaryColor: '#6b7280',
  accentColor: '#f59e0b',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  headingFont: 'system',
  bodyFont: 'system',
  borderRadius: 12,
  buttonStyle: 'solid',
  cardStyle: 'elevated',
  sectionSpacing: 'normal',
  containerWidth: 'default',
  headerStyle: 'minimal',
  footerStyle: 'simple',
  background: 'clean',
  typography: 'moderna',
  shadow: 'soft',
  preset: 'moderno',
};

/** Fuentes ya disponibles sin pedir recursos externos (sin CDN de Google Fonts). */
export const ALLOWED_FONTS = [
  'system', 'inter', 'geometric', 'rounded', 'serif', 'display', 'mono',
] as const;

export const VISUAL_ENUMS = {
  theme: ['light', 'dark', 'auto'] as const,
  buttonStyle: ['solid', 'outline', 'soft'] as const,
  cardStyle: ['flat', 'elevated', 'bordered'] as const,
  sectionSpacing: ['compact', 'normal', 'spacious'] as const,
  containerWidth: ['narrow', 'default', 'wide'] as const,
  headerStyle: ['minimal', 'centered', 'split'] as const,
  footerStyle: ['simple', 'columns', 'minimal'] as const,
};

export const BORDER_RADIUS_MIN = 0;
export const BORDER_RADIUS_MAX = 32;

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): boolean {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== 'string') return fallback;
  const v = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function pickColor(value: unknown, fallback: string): string {
  if (!isHexColor(value)) return fallback;
  return String(value).trim().toLowerCase();
}

function pickRadius(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(BORDER_RADIUS_MAX, Math.max(BORDER_RADIUS_MIN, Math.round(n)));
}

function pickFont(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim().toLowerCase();
  return (ALLOWED_FONTS as readonly string[]).includes(v) ? v : fallback;
}

/**
 * Devuelve una configuracion visual SIEMPRE valida. Acepta `null`/basura y
 * aplica defaults campo por campo (merge con el estado guardado si se pasa).
 */
export function sanitizeVisualConfig(input: unknown, base: VisualConfig = DEFAULT_VISUAL): VisualConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    theme: pickEnum(src.theme, VISUAL_ENUMS.theme, base.theme),
    primaryColor: pickColor(src.primaryColor, base.primaryColor),
    secondaryColor: pickColor(src.secondaryColor, base.secondaryColor),
    accentColor: pickColor(src.accentColor, base.accentColor),
    backgroundColor: pickColor(src.backgroundColor, base.backgroundColor),
    textColor: pickColor(src.textColor, base.textColor),
    headingFont: pickFont(src.headingFont, base.headingFont),
    bodyFont: pickFont(src.bodyFont, base.bodyFont),
    borderRadius: pickRadius(src.borderRadius, base.borderRadius),
    buttonStyle: pickEnum(src.buttonStyle, VISUAL_ENUMS.buttonStyle, base.buttonStyle),
    cardStyle: pickEnum(src.cardStyle, VISUAL_ENUMS.cardStyle, base.cardStyle),
    sectionSpacing: pickEnum(src.sectionSpacing, VISUAL_ENUMS.sectionSpacing, base.sectionSpacing),
    containerWidth: pickEnum(src.containerWidth, VISUAL_ENUMS.containerWidth, base.containerWidth),
    headerStyle: pickEnum(src.headerStyle, VISUAL_ENUMS.headerStyle, base.headerStyle),
    footerStyle: pickEnum(src.footerStyle, VISUAL_ENUMS.footerStyle, base.footerStyle),
    background: typeof src.background === 'string' && /^[a-z0-9-]{2,40}$/i.test(src.background) ? src.background : base.background,
    typography: typeof src.typography === 'string' && /^[a-z0-9-]{2,40}$/i.test(src.typography) ? src.typography : base.typography,
    shadow: pickEnum(src.shadow, ['none', 'soft', 'elevated', 'dramatic'], base.shadow),
    preset: typeof src.preset === 'string' && /^[a-z0-9-]{2,40}$/i.test(src.preset) ? src.preset : base.preset,
  };
}

/** CSS variables listas para inyectar en la pagina publica del negocio. */
export function visualCssVars(visual: VisualConfig): Record<string, string> {
  return {
    '--biz-primary': visual.primaryColor,
    '--biz-secondary': visual.secondaryColor,
    '--biz-accent': visual.accentColor,
    '--biz-bg': visual.backgroundColor,
    '--biz-text': visual.textColor,
    '--biz-radius': `${visual.borderRadius}px`,
    '--biz-shadow': visual.shadow === 'none' ? 'none' : visual.shadow === 'dramatic' ? '0 30px 80px rgba(0,0,0,.28)' : visual.shadow === 'elevated' ? '0 22px 60px rgba(24,24,27,.14)' : '0 12px 35px rgba(24,24,27,.08)',
  };
}

/** Clases de espaciado entre secciones (Tailwind, valores fijos). */
export function sectionSpacingClass(spacing: VisualConfig['sectionSpacing']): string {
  if (spacing === 'compact') return 'space-y-6';
  if (spacing === 'spacious') return 'space-y-16';
  return 'space-y-10';
}

/** Ancho maximo del contenedor (Tailwind). */
export function containerWidthClass(width: VisualConfig['containerWidth']): string {
  if (width === 'narrow') return 'max-w-3xl';
  if (width === 'wide') return 'max-w-7xl';
  return 'max-w-5xl';
}
