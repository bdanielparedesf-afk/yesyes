/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — BusinessSiteInstance (Fase 3).
 *
 * MASTER TEMPLATE  ≠  BUSINESS SITE INSTANCE
 *
 * El master template es la plantilla compartida por todos. La instancia es el
 * sitio de UN negocio. Al elegir un template, el negocio recibe una copia
 * profunda de su manifest: modificar la instancia NO toca el master ni a
 * otro negocio. Eso se garantiza con `cloneManifest` (copia real, sin
 * referencias compartidas) y se verifica con tests de aislamiento.
 */

import { CURRENT_MANIFEST_VERSION, isValidTemplateManifest, migrateManifest, parseTemplateManifest, type TemplateManifest } from './template-manifest';
import { blockAllowedForCategory, capabilitiesForCategory } from './capabilities';
import { canonicalCategoryCode } from '../utils/business-taxonomy';

/** Copia profunda de un manifest. Sin referencias al original. */
export function cloneManifest(manifest: TemplateManifest): TemplateManifest {
  return JSON.parse(JSON.stringify(manifest)) as TemplateManifest;
}

export interface CreateInstanceInput {
  /** Manifest maestro (validado por el backend antes de llegar aquí). */
  masterManifest: unknown;
  /** Rubro del negocio: puede ser una variante compatible del master. */
  businessCategory: string;
  /** Identificador de la instancia. */
  instanceId: string;
}

export interface CreateInstanceResult {
  ok: boolean;
  manifest?: TemplateManifest;
  /** Errores legibles si no se puede crear. */
  errors: string[];
  /** Bloques que se quitaron por ser irrelevantes para el rubro. */
  removedBlocks: string[];
}

/**
 * Crea la instancia de un negocio a partir de un master template.
 *
 * Reglas:
 *  - Se normaliza el rubro (los alias legacy colapsan al canónico).
 *  - Se eliminan bloques que el rubro prohíbe: no se muestra un catálogo de
 *    productos a una peluquería ni propiedades a una floristería.
 *  - Se eliminan secciones que quedan vacías.
 *  - El resultado se re-valida: si algo no cuadra, no se crea la instancia.
 */
export function createSiteInstance(input: CreateInstanceInput): CreateInstanceResult {
  const removedBlocks: string[] = [];

  // 1. El master se migra a la versión de formato actual antes de clonar.
  const migrated = migrateManifest(input.masterManifest);
  if (!migrated) {
    return { ok: false, errors: ['El manifest maestro no se pudo migrar a la versión soportada'], removedBlocks };
  }

  // Se normaliza con el schema (defaults de `hidden`, `emphasis`, `config`...)
  // para que la instancia siempre tenga la misma forma que el master.
  const normalized = parseTemplateManifest(migrated);
  if (!normalized) {
    return { ok: false, errors: ['El manifest maestro no supera la validación'], removedBlocks };
  }
  const master = cloneManifest(normalized);
  const category = canonicalCategoryCode(input.businessCategory);

  // 2. La instancia nace con su propia identidad de versión de sitio.
  master.templateId = input.instanceId;
  master.manifestVersion = CURRENT_MANIFEST_VERSION;
  master.businessCategory = category;

  // 3. Se ajustan las capacidades al rubro del negocio.
  const allowed = new Set(capabilitiesForCategory(category));
  master.capabilities = master.capabilities.filter((capability) => allowed.has(capability));

  // 4. Se depuran los bloques irrelevantes para el rubro.
  const sections = [];
  for (const section of master.sections) {
    const blocks = [];
    for (const block of section.blocks) {
      if (!blockAllowedForCategory(block.block, category)) {
        removedBlocks.push(block.block);
        continue;
      }
      blocks.push({ ...block, config: { ...block.config } });
    }
    if (blocks.length) sections.push({ ...section, blocks });
  }
  master.sections = sections;

  // 5. Se revalida el manifest resultante.
  if (!isValidTemplateManifest(master)) {
    return { ok: false, errors: ['La instancia resultante no supera la validación del manifest'], removedBlocks };
  }

  return { ok: true, manifest: master, errors: [], removedBlocks };
}

export type SiteInstanceOverride = Record<string, unknown>;

/**
 * Aplica overrides del negocio sobre el manifest de su instancia.
 *
 * Solo se permite tocar campos de CONFIGURACIÓN de bloques, visibilidad y
 * orden. La estructura (qué bloques existen, el layout) es la identidad del
 * diseño y no se altera por un override: así el sitio del cliente no puede
 * romperse, y un cambio de layout siempre es una decisión de versión.
 */
export function applyOverrides(manifest: TemplateManifest, overrides: SiteInstanceOverride | null | undefined): TemplateManifest {
  if (!overrides || typeof overrides !== 'object') return manifest;

  // Se trabaja sobre una copia: el manifest guardado nunca se muta en memoria.
  const next = cloneManifest(manifest);
  const sections = overrides.sections;
  if (sections && typeof sections === 'object') {
    const byId = sections as Record<string, { hidden?: unknown; order?: unknown; blocks?: Record<string, unknown> }>;
    for (const section of next.sections) {
      const patch = byId[section.id];
      if (!patch || typeof patch !== 'object') continue;
      if (typeof patch.hidden === 'boolean') section.hidden = patch.hidden;
      if (typeof patch.order === 'number' && Number.isFinite(patch.order)) section.order = Math.max(0, Math.floor(patch.order));
      if (patch.blocks && typeof patch.blocks === 'object') {
        for (const block of section.blocks) {
          const blockPatch = (patch.blocks as Record<string, { config?: unknown; hidden?: unknown }>)[block.instanceId];
          if (!blockPatch || typeof blockPatch !== 'object') continue;
          if (typeof blockPatch.hidden === 'boolean') block.hidden = blockPatch.hidden;
          if (blockPatch.config && typeof blockPatch.config === 'object') {
            block.config = { ...block.config, ...(blockPatch.config as Record<string, unknown>) };
          }
        }
      }
    }
    next.sections.sort((a, b) => a.order - b.order);
  }
  return next;
}

/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Compatibilidad legacy (Fase 3).
 *
 * Los 97 templates del modelo V3 NO se borran, NO se modifican y NO se
 * reescriben. Siguen siendo business functional today: el renderer único
 * sigue componiéndolos exactamente como antes.
 *
 * Aquí vive el PUENTE formal: se puede construir un manifest V2 mínimo a
 * partir de una fila legacy de `business_templates` para que un negocio V3
 * tenga una instancia propia sin cambiar una sola línea de su template. Ese
 * manifest lleva `legacy: true` y el renderer conserva la vía V3.
 *
 * La migración a V2 es PROGRESIVA: mientras el manifest sea legacy, el sitio
 * se renderiza como siempre. El manifest solo sirve para:
 *  - identidad de instancia (aislar el negocio de otros);
 *  - versionado explícito;
 *  - punto de entrada para migrar a composition real en una fase posterior.
 */

/** Datos mínimos de una fila `business_templates` (V3). */
export interface LegacyTemplateRow {
  code: string;
  name?: string | null;
  category: string;
  capabilities?: string[] | null;
  legacy?: boolean | null;
}

/** Manifest V2 mínimo y válido derivado de un template V3. */
export interface LegacyManifestLike {
  templateId: string;
  templateVersion: number;
  manifestVersion: number;
  businessCategory: string;
  style: string;
  layout: string;
  sections: unknown[];
  capabilities: string[];
  theme: Record<string, unknown>;
  navigation: Record<string, unknown>;
  media: Record<string, unknown>;
  seo: Record<string, unknown>;
  availableActions: string[];
  legacy: true;
  /** Código V3 original: el renderer único lo usa para elegir el componente. */
  legacyTemplateCode: string;
}

const NEUTRAL_THEME = {
  palette: { primary: '#111827', background: '#ffffff', text: '#111827', accent: '#6b7280' },
  radius: 'soft',
  mode: 'light',
  headingFont: 'sans',
  bodyFont: 'sans',
};

const NEUTRAL_MEDIA = {
  requiredMedia: ['image'],
  video: {
    allowed: true,
    autoplayRequiresMuted: true,
    maxAutoplayDurationSec: 12,
    posterRequired: true,
    disableAutoplayOnReducedMotion: true,
  },
};

/**
 * Construye el manifest de compatibilidad a partir de un template V3.
 * `legacy: true` es lo que asegura que el renderer siga por la vía V3.
 */
export function legacyTemplateManifest(row: LegacyTemplateRow): LegacyManifestLike {
  const capabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
  const label = String(row.name || row.code).trim();
  return {
    templateId: `legacy-${String(row.code).toLowerCase()}`,
    templateVersion: 1,
    manifestVersion: 1,
    businessCategory: row.category,
    style: label,
    // `minimal` es el layout neutro: en un manifest legacy NUNCA decide la
    // composicion real, porque esa la sigue determinando el template V3.
    layout: 'minimal',
    // Sin secciones: la composicion la aporta el componente legacy.
    sections: [],
    capabilities,
    theme: { ...NEUTRAL_THEME },
    navigation: { enabled: true, style: 'minimal', links: [] },
    media: { ...NEUTRAL_MEDIA },
    seo: { titleTemplate: label, description: label, ogImageRequired: false, noIndexPreview: true },
    availableActions: [],
    legacy: true,
    // Campo de compatibilidad. El schema estricto lo acepta porque es el
    // unico campo extra permitido; si cambia, se actualiza el schema.
    legacyTemplateCode: String(row.code).toUpperCase(),
  } as LegacyManifestLike;
}

/** Código V3 asociado a un manifest de compatibilidad. */
export function legacyCodeOfManifest(manifest: unknown): string | null {
  if (!requiresLegacyRenderer(manifest)) return null;
  const code = (manifest as { legacyTemplateCode?: unknown }).legacyTemplateCode;
  return typeof code === 'string' && code ? code.toUpperCase() : null;
}

/**
 * ¿Este manifest debe renderizarse por la vía de compatibilidad V3?
 * Sí, si está marcado legacy. El motor no adivina: usa el flag.
 */
export function requiresLegacyRenderer(manifest: unknown): boolean {
  return Boolean(manifest && typeof manifest === 'object' && (manifest as { legacy?: unknown }).legacy === true);
}

/**
 * Código del template V3 que debe componer este manifest legacy.
 * Devuelve `null` si no es un manifest legacy.
 */
export function legacyCodeOf(manifest: unknown): string | null {
  if (!requiresLegacyRenderer(manifest)) return null;
  const code = (manifest as { legacyTemplateCode?: unknown }).legacyTemplateCode;
  return typeof code === 'string' && code ? code.toUpperCase() : null;
}
