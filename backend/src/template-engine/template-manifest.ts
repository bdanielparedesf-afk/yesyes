/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — TemplateManifest (Fase 3).
 *
 * El manifest es el CONTRATO de un diseño. Es versionado y se valida SIEMPRE
 * en backend: el frontend NUNCA es la fuente de verdad. Un manifest que llega
 * desde el cliente se revalida contra los registries y se rechaza si inventa
 * bloques, layouts o capacidades que no existen.
 *
 * Separación de versiones:
 *  - `manifestVersion`: FORMATO del manifest. Al subirlo, las instancias
 *    viejas se migran con `migrateManifest` sin cambiar el diseño.
 *  - `templateVersion`: CONTENIDO del diseño. Vive en
 *    `BusinessTemplateVersion` y es inmutable.
 */

import { z } from 'zod';
import { BLOCK_IDS, getBlock } from './block-registry';
import { LAYOUT_IDS } from './layout-registry';
import { isKnownCategoryCode, canonicalCategoryCode } from '../utils/business-taxonomy';
import { isCapabilityCode } from '../utils/business-capabilities';

/** Formato de manifest que este backend entiende y escribe. */
export const CURRENT_MANIFEST_VERSION = 1;

/** Identidad y versionado del template. */
const identitySchema = z.object({
  templateId: z.string().min(3).max(80),
  templateVersion: z.number().int().min(1).max(10_000),
  manifestVersion: z.number().int().min(1).max(1000),
});

const themeSchema = z.object({
  /** Paleta. Un theme distinto NO crea una identidad de diseño nueva. */
  palette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color primary inválido'),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color de fondo inválido'),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color de texto inválido'),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color de acento inválido'),
  }),
  radius: z.enum(['sharp', 'soft', 'rounded']).default('soft'),
  mode: z.enum(['light', 'dark']).default('light'),
  /** Familia tipográfica: nunca CSS arbitrario, solo tokens del sistema. */
  headingFont: z.enum(['sans', 'serif', 'display']).default('sans'),
  bodyFont: z.enum(['sans', 'serif']).default('sans'),
}).strict();

const navigationSchema = z.object({
  enabled: z.boolean().default(true),
  style: z.enum(['sticky', 'minimal', 'overlay', 'drawer', 'none']).default('minimal'),
  /** Ancla de cada enlace. Debe existir una sección con ese id. */
  links: z.array(z.object({ label: z.string().min(1).max(40), anchor: z.string().min(1).max(60) })).max(10).default([]),
}).strict();

const mediaSchema = z.object({
  /** Bloques que exigen medio y no pueden renderizarse sin el. */
  requiredMedia: z.array(z.enum(['image', 'video'])).default([]),
  /** Política global de video del template. */
  video: z.object({
    allowed: z.boolean().default(true),
    /** Nunca autoplay con sonido: el navegador lo bloquea y es mala práctica. */
    autoplayRequiresMuted: z.literal(true).default(true),
    maxAutoplayDurationSec: z.number().int().min(1).max(60).default(12),
    posterRequired: z.boolean().default(true),
    /** Con reduced-motion el video no se reproduce solo. */
    disableAutoplayOnReducedMotion: z.literal(true).default(true),
  }).strict(),
}).strict();

const seoSchema = z.object({
  titleTemplate: z.string().min(1).max(160),
  description: z.string().min(1).max(320),
  ogImageRequired: z.boolean().default(false),
  noIndexPreview: z.literal(true).default(true),
}).strict();

/** Config de un bloque dentro de una sección. */
const blockInstanceSchema = z.object({
  /** Id del BlockRegistry. Nunca inventado. */
  block: z.string().min(1).max(60),
  /** Identidad estable de ESTA instancia. Fase 4 la usa para seleccionar. */
  instanceId: z.string().min(3).max(80),
  config: z.record(z.unknown()).default({}),
  /** Oculta sin borrar: el cliente puede volver a prenderlo. */
  hidden: z.boolean().default(false),
  /** Peso dentro de la sección (1..3). */
  emphasis: z.enum(['primary', 'secondary', 'tertiary']).default('secondary'),
}).strict();

const sectionSchema = z.object({
  /** Id estable de la sección. Fase 4 lo usa para seleccionar y mover. */
  id: z.string().min(2).max(60),
  label: z.string().min(1).max(80),
  order: z.number().int().min(0).max(999),
  blocks: z.array(blockInstanceSchema).min(1).max(12),
  hidden: z.boolean().default(false),
  /** Personalización por breakpoint; la hereda el layout si se omite. */
  responsive: z.object({
    mobile: z.enum(['stack', 'single-column', 'focus-media', 'scroll-snap', 'drawer', 'collapse']).optional(),
    tablet: z.enum(['two-column', 'grid-2', 'grid-3']).optional(),
    desktop: z.enum(['grid-2', 'grid-3', 'grid-4', 'masonry', 'split']).optional(),
  }).strict().optional(),
}).strict();

export const templateManifestSchema = identitySchema.extend({
  /** Rubro canónico. Los alias legacy se normalizan antes de validar. */
  businessCategory: z.string().min(2).max(40),
  /** Estilo legible ("Editorial", "Premium"...). Nunca el código interno. */
  style: z.string().min(1).max(60),
  /** Debe existir en el LayoutRegistry. */
  layout: z.string().min(2).max(40),
  sections: z.array(sectionSchema).max(24),
  /** Capacidades que el template necesita. Deben existir en el catálogo. */
  capabilities: z.array(z.string().min(2).max(40)).max(60).default([]),
  theme: themeSchema,
  navigation: navigationSchema,
  media: mediaSchema,
  seo: seoSchema,
  /** Acciones disponibles en la página. Deben existir en los bloques usados. */
  availableActions: z.array(z.string().min(2).max(20)).max(20).default([]),
  /** true para los manifests de los 97 templates V3 (compatibilidad). */
  legacy: z.boolean().default(false),
  /**
   * Solo para manifests legacy: el código V3 que el renderer único compone.
   * Nunca se usa para decidir composición; solo para mantener la vía V3.
   */
  legacyTemplateCode: z.string().max(60).optional(),
}).strict();

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export interface ManifestValidationResult {
  valid: boolean;
  /** Errores de estructura (zod). */
  errors: string[];
  /** Errores de coherencia contra los registries. */
  warnings: string[];
}

const BLOCKS = new Set(BLOCK_IDS);
const LAYOUTS = new Set<string>(LAYOUT_IDS);

/**
 * Valida un manifest en BACKEND.
 *
 * Dos capas:
 *  1. `templateManifestSchema` → forma, tipos y limites.
 *  2. Coherencia contra registries → todo `block` existe, todo layout existe,
 *     todo id de sección y de instancia es único, las capacidades existen, y
 *     no se declaran acciones que ningún bloque soporta.
 *
 * Nunca se confía en el JSON que envía el frontend.
 */
export function validateTemplateManifest(input: unknown): ManifestValidationResult {
  const warnings: string[] = [];
  const parsed = templateManifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`),
      warnings,
    };
  }

  const manifest = parsed.data;

  // 1. Rubro: se acepta canónico o alias legacy, se normaliza.
  if (!isKnownCategoryCode(manifest.businessCategory)) {
    return { valid: false, errors: [`businessCategory: rubro desconocido "${manifest.businessCategory}"`], warnings };
  }
  const canonical = canonicalCategoryCode(manifest.businessCategory);

  // 2. Layout real.
  if (!LAYOUTS.has(manifest.layout)) {
    return { valid: false, errors: [`layout: "${manifest.layout}" no existe en el LayoutRegistry`], warnings };
  }

  // 3. Capacidades reales.
  for (const capability of manifest.capabilities) {
    if (!isCapabilityCode(capability)) {
      return { valid: false, errors: [`capabilities: "${capability}" no existe en el catálogo`], warnings };
    }
  }

  // 4. Bloques, ids únicos y coherencia de acciones.
  const sectionIds = new Set<string>();
  const instanceIds = new Set<string>();
  const usedBlocks = new Set<string>();
  const usedActions = new Set<string>();

  for (const section of manifest.sections) {
    if (sectionIds.has(section.id)) {
      return { valid: false, errors: [`sections: id de sección duplicado "${section.id}"`], warnings };
    }
    sectionIds.add(section.id);

    for (const block of section.blocks) {
      if (!BLOCKS.has(block.block)) {
        return { valid: false, errors: [`sections.${section.id}: bloque "${block.block}" no existe en el BlockRegistry`], warnings };
      }
      if (instanceIds.has(block.instanceId)) {
        return {
          valid: false,
          errors: [`sections.${section.id}: instanceId duplicado "${block.instanceId}" (debe ser único en el manifest)`],
          warnings,
        };
      }
      instanceIds.add(block.instanceId);
      usedBlocks.add(block.block);
      for (const action of getBlock(block.block)?.actions || []) usedActions.add(action);

      // Un bloque sin renderer no puedeOffererse: sería funcionalidad falsa.
      if (getBlock(block.block)?.renderInV2 === false) {
        return {
          valid: false,
          errors: [`sections.${section.id}: el bloque "${block.block}" todavía no tiene implementación real`],
          warnings,
        };
      }
    }
  }

  // 5. Anclas de navegación que no existen = enlaces rotos.
  for (const link of manifest.navigation.links) {
    if (!sectionIds.has(link.anchor)) {
      warnings.push(`navigation: el ancla "${link.anchor}" no corresponde a ninguna sección`);
    }
  }

  // 6. Acciones declaradas que ningún bloque soporta.
  for (const action of manifest.availableActions) {
    if (!usedActions.has(action)) {
      warnings.push(`availableActions: "${action}" no está soportada por ningún bloque del template`);
    }
  }

  // 7. Video: si el template usa bloques de video, debe declarar la politica.
  const usesVideo = [...usedBlocks].some((id) => getBlock(id)?.media.kind === 'video');
  if (usesVideo && !manifest.media.requiredMedia.includes('video')) {
    warnings.push('media: el template usa bloques de video pero no declara requiredMedia: ["video"]');
  }

  // 8. Footer ausente: el sitio se vería sin cierre legal.
  if (!usedBlocks.has('Footer') && manifest.sections.length > 0) {
    warnings.push('sections: el template no incluye el bloque Footer');
  }

  return { valid: true, errors: [], warnings };
}

/** Manifest ya validado y normalizado, o `null` si es inválido. */
export function parseTemplateManifest(input: unknown): TemplateManifest | null {
  const result = validateTemplateManifest(input);
  if (!result.valid) return null;
  return templateManifestSchema.parse(input);
}

export function isValidTemplateManifest(input: unknown): boolean {
  return validateTemplateManifest(input).valid;
}

/**
 * Migraciones de FORMATO de manifest.
 *
 * Una migración cambia la FORMA, nunca el diseño. Por eso el mismo
 * `templateVersion` con distinto `manifestVersion` describe el mismo sitio.
 *
 * Hoy solo existe la v1. El registro queda preparado: añadir `v2` es agregar
 * una función pura que suba de `n` a `n+1`. Un manifest de una versión
 * posterior a la soportada NO se adivina: se rechaza y el sitio cae al
 * fallback, nunca se renderiza a medias.
 */
type Migration = (manifest: Record<string, unknown>) => Record<string, unknown>;

/** Migraciones indexadas por versión destino. */
const MIGRATIONS: Record<number, Migration> = {
  // 2: (manifest) => ({ ...manifest, nuevoCampo }),
};

export const SUPPORTED_MANIFEST_VERSION = CURRENT_MANIFEST_VERSION;

export interface VersionCompatibility {
  compatible: boolean;
  /** Versión efectiva tras migrar. */
  resolvedVersion: number;
  /** true si hubo que aplicar al menos una migración. */
  migrated: boolean;
  /** Por qué no es compatible, en lenguaje legible. */
  reason?: string;
}

/**
 * ¿Puede el backend leer este manifest?
 *  - versión mayor a la soportada → incompatible (no inventamos el futuro);
 *  - versión menor → se migra en memoria y es compatible;
 *  - versión igual → compatible.
 */
export function checkManifestCompatibility(input: unknown): VersionCompatibility {
  if (!input || typeof input !== 'object') {
    return { compatible: false, resolvedVersion: 0, migrated: false, reason: 'El manifest no es un objeto' };
  }
  const raw = (input as Record<string, unknown>).manifestVersion;
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) {
    return {
      compatible: false,
      resolvedVersion: 0,
      migrated: false,
      reason: 'manifestVersion ausente o inválido: se requiere un manifest versionado',
    };
  }
  if (version > SUPPORTED_MANIFEST_VERSION) {
    return {
      compatible: false,
      resolvedVersion: version,
      migrated: false,
      reason: `manifestVersion ${version} es más nueva que la soportada (${SUPPORTED_MANIFEST_VERSION}): se requiere una migración`,
    };
  }
  return { compatible: true, resolvedVersion: version, migrated: version < CURRENT_MANIFEST_VERSION };
}

/**
 * Sube un manifest a la versión de formato actual. Devuelve `null` si no se
 * puede migrar de forma segura: en ese caso el sitio usa el fallback.
 */
export function migrateManifest(input: unknown): Record<string, unknown> | null {
  const compatibility = checkManifestCompatibility(input);
  if (!compatibility.compatible) return null;

  let manifest = { ...(input as Record<string, unknown>) };
  let version = compatibility.resolvedVersion;
  while (version < CURRENT_MANIFEST_VERSION) {
    const migration = MIGRATIONS[version + 1];
    if (!migration) return null;
    manifest = migration(manifest);
    version += 1;
    manifest.manifestVersion = version;
  }
  return manifest;
}

/**
 * ¿Es un manifest legacy (los 97 templates V3 siguen por esta vía)?
 * Se determina por el flag explícito, no por heurísticas.
 */
export function isLegacyManifest(manifest: unknown): boolean {
  return Boolean(manifest && typeof manifest === 'object' && (manifest as Record<string, unknown>).legacy === true);
}

// VERSIONING_PLACEHOLDER

