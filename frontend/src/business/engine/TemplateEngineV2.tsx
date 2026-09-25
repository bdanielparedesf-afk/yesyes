import { BLOCK_RENDERERS, hasRenderer, type BlockContext } from './blocks';
import { isKnownBlockId, isKnownLayoutId, type BlockId, type LayoutId } from './registries';

/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Compositor de bloques (Fase 3).
 *
 * Este componente es la IMPLEMENTACIÓN del manifest en el frontend. NO es un
 * renderer: es la composición que `BusinessPageRenderer` (el renderer único)
 * monta cuando la instancia del negocio usa un manifest V2.
 *
 * Responsabilidades:
 *  - recorrer las secciones del manifest en orden;
 *  - saltar secciones y bloques ocultos (sin borrarlos: se pueden volver a
 *    prender, que es lo que necesita el editor de Fase 4);
 *  - NO renderizar bloques sin renderer real (nunca funcionalidad falsa);
 *  - entregar a cada bloque la estrategia responsive que le asignó el layout;
 *  - exponer `data-block-id` / `data-instance-id` para que el editor pueda
 *    seleccionar, duplicar, ocultar, reordenar y configurar sin reconstruir
 *    el motor.
 */

export interface ManifestSection {
  id: string;
  label: string;
  order: number;
  hidden?: boolean;
  blocks: Array<{ block: string; instanceId: string; config?: Record<string, unknown>; hidden?: boolean; emphasis?: string }>;
  responsive?: { mobile?: string; tablet?: string; desktop?: string };
}

export interface ManifestLike {
  layout?: string;
  sections?: ManifestSection[];
  legacy?: boolean;
  legacyTemplateCode?: string;
  theme?: Record<string, unknown> | null;
  manifestVersion?: number;
  templateVersion?: number;
}

export interface TemplateEngineV2Props extends BlockContext {
  manifest: ManifestLike | null | undefined;
}

/** Estrategia mobile por defecto si el manifest no la declara. */
const DEFAULT_MOBILE = 'stack';

export function TemplateEngineV2({ manifest, ...context }: TemplateEngineV2Props) {
  // Sin manifest utilizable, el renderer único conserva su camino V3.
  if (!manifest || !Array.isArray(manifest.sections) || manifest.sections.length === 0) return null;

  const sections = [...manifest.sections].sort((a, b) => a.order - b.order);
  const layoutId = isKnownLayoutId(manifest.layout) ? (manifest.layout as LayoutId) : null;

  return (
    <div data-template-engine="v2" data-template-layout={layoutId || undefined} data-manifest-version={manifest.manifestVersion || 1}>
      {sections.map((section) => {
        if (section.hidden) return null;
        const visible = (section.blocks || []).filter(
          (block) => !block.hidden && isKnownBlockId(block.block) && hasRenderer(block.block),
        );
        if (!visible.length) return null;
        const mobile = section.responsive?.mobile || DEFAULT_MOBILE;
        return (
          <div
            key={section.id}
            data-block-section={section.id}
            data-section-order={section.order}
            data-section-mobile={mobile}
          >
            {visible.map((block) => {
              const Render = BLOCK_RENDERERS[block.block];
              return (
                <div key={block.instanceId} data-block-id={block.block} data-instance-id={block.instanceId} data-block-emphasis={block.emphasis || 'secondary'}>
                  <Render
                    {...context}
                    instanceId={block.instanceId}
                    config={(block.config || {}) as Record<string, any>}
                    anchor={section.id}
                    mobile={mobile}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Ids de bloque usados por un manifest: útil para QA y para el editor. */
export function manifestBlockIds(manifest: ManifestLike | null | undefined): BlockId[] {
  if (!manifest || !Array.isArray(manifest.sections)) return [];
  const out: BlockId[] = [];
  for (const section of manifest.sections) {
    for (const block of section.blocks || []) {
      if (isKnownBlockId(block.block) && !out.includes(block.block)) out.push(block.block);
    }
  }
  return out;
}
