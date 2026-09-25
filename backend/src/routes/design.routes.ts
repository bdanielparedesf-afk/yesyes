
/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Rutas de diseño (Fase 4.1).
 *
 * Estas rutas son lo que convierte "elegir plantilla" en "constructor visual":
 * el usuario puede cambiar el diseño global, cambiar la variante de una
 * sección, y agregar, quitar, duplicar, ocultar o reordenar secciones, sin
 * que nada de eso pierda el contenido ya configurado.
 *
 * Todas revalidan el manifest en el backend. El frontend propone; el backend
 * decide.
 */

import { Router } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { authenticate } from '../middlewares/auth';
import { requireBusinessOwner, ownerWhere } from '../middlewares/businessAuth';
import { prisma } from '../lib/prisma';
import {
  CURRENT_MANIFEST_VERSION,
  validateTemplateManifest,
  designFromTemplate,
  designsForCategory,
  applyDesignChange,
  manifestFromDesign,
  defaultVariantOf,
  variantsForBlock,
  CAPABILITY_TO_BLOCKS,
  CAPABILITY_ORDER,
  SECTION_LABELS,
  type TemplateManifestLike,
  type DesignSourceRow,
} from '../template-engine';
import { ensureSiteInstance, loadDesignSources } from '../template-engine/bootstrap';
import { getBlock } from '../template-engine/block-registry';
import { canonicalCategoryCode, categoryLabelOf } from '../utils/business-taxonomy';

const router = Router();
router.use(authenticate);

async function ownedInstance(req: AuthRequest): Promise<{ businessId: string; manifest: TemplateManifestLike } | null> {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    select: { id: true, category: true, name: true, templateId: true, siteInstance: { select: { manifest: true } } },
  });
  if (!business) return null;
  // Si el negocio es anterior a esta fase y no tiene instancia, se construye
  // una a partir del diseño de su plantilla: nunca se deja sin manifest.
  if (!business.siteInstance) {
    await ensureSiteInstance(business.id);
    const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: business.id }, select: { manifest: true } });
    if (!fresh) return null;
    return { businessId: business.id, manifest: fresh.manifest as unknown as TemplateManifestLike };
  }
  return { businessId: business.id, manifest: business.siteInstance.manifest as unknown as TemplateManifestLike };
}

async function saveManifest(
  businessId: string,
  manifest: TemplateManifestLike,
  reason: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const result = validateTemplateManifest(manifest);
  if (!result.valid) return { ok: false, errors: result.errors };
  await prisma.$transaction(async (tx) => {
    await tx.businessSiteInstance.update({
      where: { businessId },
      data: { manifest: manifest as any, manifestVersion: CURRENT_MANIFEST_VERSION },
    });
    await tx.businessSiteRevision.create({
      data: {
        id: `rev-${businessId}-${Date.now()}`,
        instanceId: `site-${businessId}`,
        manifestVersion: CURRENT_MANIFEST_VERSION,
        manifest: manifest as any,
        reason: reason.slice(0, 200),
      },
    });
  });
  return { ok: true };
}

/** Catálogo de diseños del rubro, con nombre legible y sin códigos técnicos. */
router.get('/:id/designs', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    select: { category: true },
  });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const sources = await loadDesignSources();
  const designs = designsForCategory(sources, business.category);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json({
    category: canonicalCategoryCode(business.category),
    categoryLabel: categoryLabelOf(business.category),
    designs: designs.map((design) => ({
      id: design.id,
      templateId: design.templateId,
      label: design.label,
      styleLabel: design.styleLabel,
      description: design.description,
      layout: design.layout,
      sections: design.sections.map((section) => ({
        id: section.id,
        label: section.label,
        blocks: section.blocks.map((block) => ({
          block: block.block,
          label: getBlock(block.block)?.label || block.block,
          variants: variantsForBlock(block.block).map((variant) => ({ id: variant.id, label: variant.label })),
        })),
      })),
    })),
  });
});

/**
 * CAMBIAR EL DISEÑO GLOBAL sin perder contenido.
 * `applyDesignChange` conserva la config de cada bloque que sobrevive y aparta
 * a una sección `extras` lo que el diseño nuevo no contempló.
 */
router.post('/:id/design', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const templateId = String((req.body as any)?.templateId || '');
  const template = await prisma.businessTemplate.findUnique({ where: { id: templateId }, select: { code: true, name: true, category: true, style: true, capabilities: true } });
  if (!template) { res.status(404).json({ message: 'Diseño no encontrado' }); return; }

  const row: DesignSourceRow = {
    code: template.code,
    name: template.name,
    category: String(template.category),
    style: template.style,
    capabilities: template.capabilities,
  };
  const design = designFromTemplate(row);
  const next = applyDesignChange(context.manifest, design);
  const saved = await saveManifest(context.businessId, next, `Diseño: ${design.label}`);
  if (!saved.ok) { res.status(422).json({ message: 'No se pudo aplicar el diseño', errors: saved.errors }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: next, design: { id: design.id, label: design.label } });
});

/** Cambia la VARIANTE de un bloque sin tocar su contenido. */
router.put('/:id/block/:instanceId/variant', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const variantId = String((req.body as any)?.variant || '');
  const manifest = context.manifest;
  let found = false;
  for (const section of manifest.sections) {
    for (const block of section.blocks) {
      if (block.instanceId !== String(req.params.instanceId)) continue;
      const variant = variantsForBlock(block.block).find((entry) => entry.id === variantId);
      if (!variant) {
        res.status(422).json({ message: `La variante "${variantId}" no existe para ${block.block}` });
        return;
      }
      // La variante aporta overrides; el resto de la config del usuario se
      // conserva intacta. Por eso cambiar de variante nunca pierde contenido.
      block.config = { ...block.config, ...variant.config };
      found = true;
    }
  }
  if (!found) { res.status(404).json({ message: 'Bloque no encontrado' }); return; }
  const saved = await saveManifest(context.businessId, manifest, `Variante: ${variantId}`);
  if (!saved.ok) { res.status(422).json({ message: 'No se pudo aplicar la variante', errors: saved.errors }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest });
});

/** Agrega, quita, oculta o reordena una sección del manifest. */
router.put('/:id/sections', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const manifest = context.manifest;
  const payload = (req.body as any) || {};

  if (Array.isArray(payload.order)) {
    // Reordenar: se reescribe SOLO el `order`. Nada más se toca.
    for (const entry of payload.order as Array<{ id: string; order: number }>) {
      const section = manifest.sections.find((item) => item.id === String(entry.id));
      if (section) section.order = Math.max(0, Math.floor(Number(entry.order) || 0));
    }
    manifest.sections.sort((a, b) => a.order - b.order);
  }

  if (typeof payload.hidden === 'string') {
    const section = manifest.sections.find((item) => item.id === payload.hidden);
    if (section) section.hidden = Boolean((req.body as any)?.value);
  }

  if (typeof payload.remove === 'string') {
    manifest.sections = manifest.sections.filter((item) => item.id !== payload.remove);
  }

  if (typeof payload.duplicate === 'string') {
    const source = manifest.sections.find((item) => item.id === payload.duplicate);
    if (source) {
      const copy = JSON.parse(JSON.stringify(source));
      copy.id = `${source.id}-copia`;
      copy.label = `${source.label} (copia)`;
      copy.order = (source.order || 0) + 5;
      copy.blocks = copy.blocks.map((block: any, index: number) => ({ ...block, instanceId: `${copy.id}-${index + 1}` }));
      manifest.sections.push(copy);
      manifest.sections.sort((a, b) => a.order - b.order);
    }
  }

  const saved = await saveManifest(context.businessId, manifest, 'Secciones actualizadas');
  if (!saved.ok) { res.status(422).json({ message: 'No se pudo actualizar la estructura', errors: saved.errors }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest });
});

/**
 * Secciones que el usuario PUEDE agregar para su rubro, con el bloque y las
 * variantes disponibles. Es la fuente de verdad de "+ Agregar sección": el
 * editor no puede ofrecer algo que el backend o el renderer no soporten.
 */
router.get('/:id/addable-sections', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: ownerWhere(req, String(req.params.id)), select: { category: true } });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const category = canonicalCategoryCode(business.category);
  const { industryProfileOf } = await import('../template-engine/capabilities');
  const profile = industryProfileOf(category);
  const allowed = new Set(profile.allowedBlocks);
  const forbidden = new Set(profile.forbiddenBlocks);

  const out: Array<{ capability: string; label: string; block: string; blockLabel: string; variants: Array<{ id: string; label: string }> }> = [];
  for (const capability of CAPABILITY_ORDER) {
    const blocks = CAPABILITY_TO_BLOCKS[capability];
    if (!blocks || !blocks.length) continue;
    const block = blocks.find((entry) => allowed.has(entry) && !forbidden.has(entry) && getBlock(entry)?.renderInV2);
    if (!block) continue;
    out.push({
      capability,
      label: SECTION_LABELS[capability] || capability,
      block,
      blockLabel: getBlock(block)?.label || block,
      variants: variantsForBlock(block).map((variant) => ({ id: variant.id, label: variant.label })),
    });
  }
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json({ sections: out });
});

/** Agrega una sección nueva al manifest, con la variante elegida. */
router.post('/:id/sections', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const capability = String((req.body as any)?.capability || '');
  const variantId = (req.body as any)?.variant;

  const blocks = CAPABILITY_TO_BLOCKS[capability];
  const block = blocks && blocks.length ? blocks[0] : null;
  if (!block || !getBlock(block)?.renderInV2) {
    res.status(422).json({ message: `No se puede agregar la sección "${capability}"` });
    return;
  }
  const variant = variantId ? variantsForBlock(block).find((entry) => entry.id === String(variantId)) : defaultVariantOf(block);
  if (variantId && !variant) {
    res.status(422).json({ message: `La variante "${variantId}" no existe para ${block}` });
    return;
  }

  const manifest = context.manifest;
  const id = capability.toLowerCase();
  if (manifest.sections.some((section) => section.id === id)) {
    // Agregar dos veces la misma sección no crea un duplicado invisible: se
    // devuelve un error explícito en lugar de un bloque que no se verá.
    res.status(409).json({ message: `La sección "${SECTION_LABELS[capability] || capability}" ya está en tu página` });
    return;
  }
  manifest.sections.push({
    id,
    label: SECTION_LABELS[capability] || capability,
    order: (manifest.sections.reduce((max, section) => Math.max(max, section.order), 0)) + 10,
    hidden: false,
    blocks: [{
      block,
      instanceId: `${id}-${block.toLowerCase()}`,
      config: variant ? { ...variant.config } : {},
      hidden: false,
      emphasis: 'secondary',
    }],
  });
  manifest.sections.sort((a, b) => a.order - b.order);

  const saved = await saveManifest(context.businessId, manifest, `Sección agregada: ${capability}`);
  if (!saved.ok) { res.status(422).json({ message: 'No se pudo agregar la sección', errors: saved.errors }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest });
});

/** Rutas de lectura del manifest, para que el editor no adivine la estructura. */
router.get('/:id/manifest', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: context.manifest });
});

/** Preview de un diseño SIN aplicarlo: sirve para "ver antes de decidir". */
router.post('/:id/design/preview', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const templateId = String((req.body as any)?.templateId || '');
  const template = await prisma.businessTemplate.findUnique({ where: { id: templateId }, select: { code: true, name: true, category: true, style: true, capabilities: true } });
  if (!template) { res.status(404).json({ message: 'Diseño no encontrado' }); return; }
  const design = designFromTemplate({
    code: template.code,
    name: template.name,
    category: String(template.category),
    style: template.style,
    capabilities: template.capabilities,
  });
  // Se calcula en memoria y NUNCA se guarda: si el usuario cancela, no pasó nada.
  const preview = applyDesignChange(context.manifest, design);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: preview, design: { id: design.id, label: design.label } });
});

export { manifestFromDesign };
export default router;


