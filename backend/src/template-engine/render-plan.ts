/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Motor de render (Fase 3).
 *
 * IMPORTANTE: este módulo NO renderiza. Produce un RENDER PLAN: una
 * estructura ordenada y validada que el RENDERER ÚNICO
 * (`frontend/src/business/BusinessPageRenderer`) consume.
 *
 * No existe un segundo renderer. Este motor resuelve QUÉ se muestra y en
 * qué orden; el renderer decide CÓMO se pinta. Esa separación permite que
 * sitio publicado, preview, galería, editor, preview responsive y QA
 * sigan usando exactamente el mismo camino.
 */

import { getBlock, type BlockDefinition } from './block-registry';
import { getLayout, type LayoutDefinition } from './layout-registry';
import { checkManifestCompatibility, migrateManifest, isLegacyManifest, type TemplateManifest } from './template-manifest';
import { legacyCodeOf, requiresLegacyRenderer } from './site-instance';

export interface ResolvedBlock {
  instanceId: string;
  block: BlockDefinition;
  config: Record<string, unknown>;
  emphasis: 'primary' | 'secondary' | 'tertiary';
  hidden: boolean;
}

export interface ResolvedSection {
  id: string;
  label: string;
  order: number;
  hidden: boolean;
  blocks: ResolvedBlock[];
  /** Comportamiento responsive final (la sección gana sobre el layout). */
  responsive: LayoutDefinition['responsive'];
}

export interface RenderPlan {
  legacy: boolean;
  /** Código del template V3 a componer. Solo si `legacy`. */
  legacyTemplateCode: string | null;
  layout: LayoutDefinition | null;
  theme: TemplateManifest['theme'] | null;
  navigation: TemplateManifest['navigation'] | null;
  seo: TemplateManifest['seo'] | null;
  media: TemplateManifest['media'] | null;
  availableActions: string[];
  sections: ResolvedSection[];
  manifestVersion: number;
  templateVersion: number;
  /** Avisos para QA. Nunca se muestran al cliente final. */
  warnings: string[];
}

const FALLBACK: RenderPlan = {
  legacy: true,
  legacyTemplateCode: null,
  layout: null,
  theme: null,
  navigation: null,
  seo: null,
  media: null,
  availableActions: [],
  sections: [],
  manifestVersion: 1,
  templateVersion: 1,
  warnings: ['Sin manifest utilizable: el sitio cae al render de compatibilidad'],
};

/**
 * Resuelve el manifest de una instancia en un plan de render.
 *
 * Casos:
 *  - manifest legacy → plan legacy: el renderer único compone el template V3.
 *  - manifest V2 válido → plan con secciones y bloques resueltos.
 *  - manifest inválido o de versión futura → FALLBACK. Nunca se renderiza a
 *    medias: es preferible la vía de compatibilidad a un diseño roto.
 */
export function resolveRenderPlan(manifest: unknown): RenderPlan {
  if (!manifest || typeof manifest !== 'object') return { ...FALLBACK };

  // Compatibilidad V3: se respeta el flag y no se reinterpreta el diseño.
  if (requiresLegacyRenderer(manifest)) {
    return {
      ...FALLBACK,
      legacy: true,
      legacyTemplateCode: legacyCodeOf(manifest),
      manifestVersion: Number((manifest as { manifestVersion?: number }).manifestVersion) || 1,
      templateVersion: Number((manifest as { templateVersion?: number }).templateVersion) || 1,
    };
  }

  // Versión de formato: si no es compatible, fallback (nunca render parcial).
  const compatibility = checkManifestCompatibility(manifest);
  if (!compatibility.compatible) {
    return { ...FALLBACK, warnings: [`Manifest incompatible: ${compatibility.reason}`] };
  }

  const migrated = migrateManifest(manifest);
  if (!migrated) return { ...FALLBACK, warnings: ['No se pudo migrar el manifest a la versión soportada'] };

  const layout = getLayout(String((migrated as { layout?: unknown }).layout || ''));
  if (!layout) return { ...FALLBACK, warnings: ['Layout desconocido en el manifest: se usa la vía de compatibilidad'] };

  const warnings: string[] = [];
  const rawSections = Array.isArray((migrated as { sections?: unknown }).sections) ? (migrated as { sections: unknown[] }).sections : [];

  const sections: ResolvedSection[] = [];
  for (const raw of rawSections) {
    const section = raw as { id?: string; label?: string; order?: number; hidden?: boolean; blocks?: unknown[]; responsive?: Record<string, unknown> };
    const sectionId = String(section.id || '');
    if (!sectionId) continue;
    const blocks: ResolvedBlock[] = [];
    for (const rawBlock of Array.isArray(section.blocks) ? section.blocks : []) {
      const entry = rawBlock as { block?: string; instanceId?: string; config?: Record<string, unknown>; hidden?: boolean; emphasis?: 'primary' | 'secondary' | 'tertiary' };
      const definition = getBlock(String(entry.block || ''));
      if (!definition) {
        // Bloque que ya no existe en el BlockRegistry: se ignora, no rompe.
        warnings.push(`Bloque desconocido ignorado en "${sectionId}": ${String(entry.block || '')}`);
        continue;
      }
      if (!definition.renderInV2) {
        // Sin renderer real: no se muestra. Nunca funcionalidad falsa.
        warnings.push(`Bloque sin implementación ignorado en "${sectionId}": ${definition.id}`);
        continue;
      }
      blocks.push({
        instanceId: String(entry.instanceId || `${sectionId}-${definition.id}`),
        block: definition,
        config: entry.config && typeof entry.config === 'object' ? entry.config : {},
        emphasis: entry.emphasis || 'secondary',
        hidden: entry.hidden === true,
      });
    }
    if (!blocks.length) continue;
    sections.push({
      id: sectionId,
      label: String(section.label || sectionId),
      order: Number.isFinite(Number(section.order)) ? Number(section.order) : 0,
      hidden: section.hidden === true,
      blocks,
      responsive: { ...layout.responsive, ...(section.responsive && typeof section.responsive === 'object' ? section.responsive : {}) },
    });
  }

  sections.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const effective = migrated as unknown as TemplateManifest;
  return {
    legacy: isLegacyManifest(effective),
    legacyTemplateCode: null,
    layout,
    theme: effective.theme || null,
    navigation: effective.navigation || null,
    seo: effective.seo || null,
    media: effective.media || null,
    availableActions: Array.isArray(effective.availableActions) ? effective.availableActions : [],
    sections,
    manifestVersion: Number(effective.manifestVersion) || 1,
    templateVersion: Number(effective.templateVersion) || 1,
    warnings,
  };
}

/** ¿Este plan usa la compatibilidad V3? */
export function isLegacyPlan(plan: RenderPlan): boolean {
  return plan.legacy === true;
}

/** Identidad del plan: sirve para QA y para detectar cambios en el sitio. */
export function renderPlanSignature(plan: RenderPlan): string {
  return [
    plan.legacy ? 'legacy' : `v${plan.manifestVersion}`,
    plan.layout?.id || '-',
    plan.sections.map((section) => `${section.id}:${section.blocks.map((block) => block.block.id).join('+')}`).join('|'),
  ].join('::');
}
