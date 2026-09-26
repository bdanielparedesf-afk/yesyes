
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
  migrateManifest,
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
import { blockAllowedForCategory } from '../template-engine/capabilities';
import { canonicalCategoryCode, categoryLabelOf } from '../utils/business-taxonomy';
import { logger } from '../utils/logger';
import { sanitizeRevisionReason } from '../services/business-site-version.service';

const router = Router();
router.use(authenticate);

/**
 * Genera un `instanceId` de bloque libre en TODO el manifest.
 *
 * La unicidad es GLOBAL, no por sección: el validador (`validateTemplateManifest`)
 * rechaza el manifest entero si dos bloques comparten `instanceId`, y hay una
 * sección `extras` (regla de no-pérdida al cambiar de diseño) que apila bloques
 * antiguos con sus instanceIds. Por eso el id no puede derivarse solo de la
 * capability: si el bloque ya vive en `extras`, se agrega un sufijo.
 */
export function uniqueBlockInstanceId(manifest: TemplateManifestLike, base: string): string {
  const used = new Set<string>();
  for (const section of manifest.sections || []) {
    for (const item of section.blocks || []) if (item.instanceId) used.add(String(item.instanceId));
  }
  const candidate = base.toLowerCase();
  if (!used.has(candidate)) return candidate;
  let suffix = 2;
  while (used.has(`${candidate}-${suffix}`)) suffix += 1;
  return `${candidate}-${suffix}`;
}

async function ownedInstance(req: AuthRequest): Promise<{ businessId: string; manifest: TemplateManifestLike; updatedAt: Date | null; category: string } | null> {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    select: { id: true, category: true, name: true, templateId: true, siteInstance: { select: { manifest: true, updatedAt: true } } },
  });
  if (!business) return null;
  // FASE 5 §10 — La categoría viaja en el contexto: TODAS las operaciones
  // estructurales la necesitan para rechazar capabilities ajenas al rubro.
  const category = canonicalCategoryCode(business.category);
  // Si el negocio es anterior a esta fase y no tiene instancia, se construye
  // una a partir del diseño de su plantilla: nunca se deja sin manifest.
  if (!business.siteInstance) {
    await ensureSiteInstance(business.id);
    const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: business.id }, select: { manifest: true, updatedAt: true } });
    if (!fresh) return null;
    return { businessId: business.id, manifest: fresh.manifest as unknown as TemplateManifestLike, updatedAt: fresh.updatedAt, category };
  }
  return { businessId: business.id, manifest: business.siteInstance.manifest as unknown as TemplateManifestLike, updatedAt: business.siteInstance.updatedAt, category };
}

/**
 * E §14 — Un fallo de base de datos al guardar (pool agotado, timeout) NO puede
 * tumbar el proceso: Express 4 no captura rechazos de handlers async, así que una
 * excepción sin manejar se convierte en un `unhandledRejection` y se cae el
 * servidor entero. Se traduce a un resultado explícito y el cliente reintenta.
 */
async function saveManifest(
  businessId: string,
  manifest: TemplateManifestLike,
  reason: string,
): Promise<{ ok: true } | { ok: false; errors: string[]; transient?: boolean }> {
  const result = validateTemplateManifest(manifest);
  if (!result.valid) return { ok: false, errors: result.errors };
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.businessSiteInstance.update({
        where: { businessId },
        data: { manifest: manifest as any, manifestVersion: CURRENT_MANIFEST_VERSION },
        select: { id: true },
      });
      await tx.businessSiteRevision.create({
        data: {
          id: `rev-${businessId}-${Date.now()}`,
          // ID real de la instancia, no una convención de nombres.
          instanceId: updated.id,
          manifestVersion: CURRENT_MANIFEST_VERSION,
          // Copia profunda: la revisión es un histórico inmutable y no puede
          // quedar aliasada al objeto que el editor sigue mutando.
          manifest: JSON.parse(JSON.stringify(manifest)) as any,
          // El backend decide el motivo: un `reason` de cliente no puede
          // disfrazarse de publicación.
          reason: sanitizeRevisionReason(reason, 'Guardado del editor'),
        },
      });
    });
  } catch (error: any) {
    logger.error(`No se pudo guardar el manifest (${businessId}): ${error?.code || 'sin codigo'} ${error?.message || error}`);
    return { ok: false, errors: ['No se pudo guardar el manifest en este momento.'], transient: true };
  }
  return { ok: true };
}

/**
 * FASE 5 §7 — Id de sección único al duplicar.
 *
 * `base-copia` no es suficiente: al duplicar la misma sección por segunda vez
 * (`base-copia` -> `base-copia-copia`) se repite, y dos ids iguales hacen que
 * el manifest se rechace por duplicado. Aquí se prueba en orden y se garantiza
 * que el id devuelto no está en uso.
 */
export function uniqueSectionId(taken: string[], base: string): string {
  const used = new Set(taken);
  if (!used.has(`${base}-copia`)) return `${base}-copia`;
  let n = 2;
  while (used.has(`${base}-copia-${n}`)) n += 1;
  return `${base}-copia-${n}`;
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
  // FASE 5 §12 — El sello se refresca: aplicar un diseño también cambia la fila.
  const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: context.businessId }, select: { updatedAt: true } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: next, design: { id: design.id, label: design.label }, updatedAt: fresh?.updatedAt || null });
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
  // FASE 5 §12 — El sello se refresca también al cambiar de variante.
  const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: context.businessId }, select: { updatedAt: true } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest, updatedAt: fresh?.updatedAt || null });
});

/** Agrega, quita, oculta o reordena una sección del manifest. */
router.put('/:id/sections', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const manifest = context.manifest;
  const payload = (req.body as any) || {};

  // FASE 5 §4 — Se trabaja sobre una COPIA, nunca sobre el objeto que vino de
  // Prisma. Si una operación fallara más abajo (validación, base de datos), el
  // manifest en memoria ya no coincidía con el que hay en la base y un guardado
  // posterior podía persistir un estado a medias. Además garantiza que la
  // sección eliminada no se "deshaga" al releer.
  const working = JSON.parse(JSON.stringify(manifest)) as typeof manifest;

  if (Array.isArray(payload.order)) {
    // Reordenar: se reescribe SOLO el `order`. Nada más se toca.
    for (const entry of payload.order as Array<{ id: string; order: number }>) {
      const section = working.sections.find((item) => item.id === String(entry.id));
      if (section) section.order = Math.max(0, Math.floor(Number(entry.order) || 0));
    }
    working.sections.sort((a, b) => a.order - b.order);
  }

  if (typeof payload.hidden === 'string') {
    const section = working.sections.find((item) => item.id === payload.hidden);
    if (section) section.hidden = Boolean((req.body as any)?.value);
  }

  if (typeof payload.remove === 'string') {
    working.sections = working.sections.filter((item) => item.id !== payload.remove);
  }

  if (typeof payload.duplicate === 'string') {
    const source = working.sections.find((item) => item.id === payload.duplicate);
    if (source) {
      // FASE 5 §7 — COPIA PROFUNDA REAL.
      //
      // `JSON.parse(JSON.stringify(source))` ya corta toda referencia con el
      // original. Antes se hacía `{ ...block }` sobre los bloques, que deja el
      // `config` COMPARTIDO: editar la copia modificaba el original (aliasing)
      // y un Undo podía devolver un config ya mutado. Ahora los bloques se
      // reconstruyen con un `config` clonado, objeto por objeto.
      const copy = JSON.parse(JSON.stringify(source)) as typeof source;
      copy.label = `${source.label} (copia)`;
      copy.order = (source.order || 0) + 5;
      // Id ÚNICO garantizado: duplicar dos veces la MISMA sección no puede
      // producir dos `id` iguales (el manifest lo rechazaría por duplicado y
      // el usuario perdería la segunda copia sin explicación).
      copy.id = uniqueSectionId(working.sections.map((item) => item.id), source.id);
      copy.blocks = (copy.blocks || []).map((block: any, index: number) => ({
        ...block,
        // La sección copia ya tiene id único, pero el bloque puede existir con
        // ese instanceId en otra sección (`extras`), así que se valida igual.
        instanceId: uniqueBlockInstanceId(working, `${copy.id}-${index + 1}-${block.block}`),
        config: block.config && typeof block.config === 'object' ? JSON.parse(JSON.stringify(block.config)) : {},
      }));
      working.sections.push(copy);
      working.sections.sort((a, b) => a.order - b.order);
    }
  }

  // FASE 5 §12 — Tras cualquier operación estructural se devuelve el `updatedAt`
  // REAL de la instancia. El editor lo usa como sello de optimistic locking: si
  // no se refrescara, el siguiente autosave enviaría un `baseUpdatedAt` viejo y
  // el backend respondería 409, aunque nadie más hubiera escrito nada.
  const saved = await saveManifest(context.businessId, working, 'Secciones actualizadas');
  if (!saved.ok) { res.status(422).json({ message: 'No se pudo actualizar la estructura', errors: saved.errors }); return; }
  const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: context.businessId }, select: { updatedAt: true } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: working, updatedAt: fresh?.updatedAt || null });
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
  // FASE 5 §10 — La capability DEBE ser legal para el rubro de este negocio.
  //
  // Sin esta guarda, un cliente (o un bug) podría meter `PROPERTIES` en una
  // veterinaria: el bloque PASA `renderInV2`, así que entraba al manifest y
  // quedaba un catálogo de propiedades en una página que no lo admite. El
  // problema histórico era peor: el backend lo BORRABA en silencio y la UI
  // seguía mostrando que la sección existía.
  //
  // Ahora la capability prohibida se RECHAZA con un 422 y el manifest no se
  // modifica: la UI puede mostrar el error y el estado local sigue siendo
  // exactamente el del servidor.
  if (!blockAllowedForCategory(block, context.category)) {
    res.status(422).json({
      message: `La sección "${SECTION_LABELS[capability] || capability}" no está disponible para ${categoryLabelOf(context.category)}`,
      capability,
      block,
      reason: 'CAPABILITY_NOT_ALLOWED_FOR_CATEGORY',
    });
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
      // El instanceId debe ser ÚNICO en TODO el manifest, no solo dentro de la
      // sección nueva. Antes se derivaba de forma determinista
      // (`${id}-${block}`), y eso rompía en cuanto el mismo bloque ya existía
      // en otra sección: es exactamente lo que hace la sección `extras`
      // (regla de no-pérdida al cambiar de diseño), donde quedan.blocks con
      // instanceIds viejos. El POST devolvía 422 "instanceId duplicado" y la
      // UI no explicaba nada: el usuario no podía volver a agregar la sección.
      instanceId: uniqueBlockInstanceId(manifest, `${id}-${block}`),
      config: variant ? { ...variant.config } : {},
      hidden: false,
      emphasis: 'secondary',
    }],
  });
  manifest.sections.sort((a, b) => a.order - b.order);

  const saved = await saveManifest(context.businessId, manifest, `Sección agregada: ${capability}`);
  if (!saved.ok) { res.status(422).json({ message: 'No se pudo agregar la sección', errors: saved.errors }); return; }
  // FASE 5 §12 — Se devuelve el sello real: sin esto, el siguiente autosave del
  // editor enviaría el `baseUpdatedAt` de la carga y el backend respondería 409.
  const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: context.businessId }, select: { updatedAt: true } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest, updatedAt: fresh?.updatedAt || null });
});

/** Rutas de lectura del manifest, para que el editor no adivine la estructura. */
router.get('/:id/manifest', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: context.manifest, updatedAt: context.updatedAt });
});

/**
 * PERSISTENCIA PRINCIPAL DEL EDITOR (Fase 4.2 · C).
 *
 * Todo cambio de contenido o configuracion del manifest termina aqui:
 *
 *   Manifest V2 -> saveManifest() -> BusinessSiteInstance -> revision
 *
 * NO se usa `PUT /businesses/:id/capabilities` para la estructura de la pagina:
 * esa ruta sigue existiendo solo para la compatibilidad V3.
 *
 * Optimismo de concurrencia: el editor envia `baseUpdatedAt` (el `updatedAt` de la
 * instancia que cargo). Si la instancia cambio en el meantime (otra pestana u
 * otro dispositivo) se responde 409 CONFLICTO: el editor detiene el guardado y
 * recarga, en lugar de pisar una modificacion mas reciente.
 */
router.put('/:id/manifest', requireBusinessOwner, async (req: AuthRequest, res) => {
  const context = await ownedInstance(req);
  if (!context) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }

  const body = (req.body || {}) as { manifest?: unknown; baseUpdatedAt?: unknown; reason?: unknown };
  if (body.manifest === undefined) { res.status(400).json({ message: 'Falta el manifest' }); return; }

  const baseUpdatedAt = body.baseUpdatedAt ? new Date(String(body.baseUpdatedAt)) : null;
  if (baseUpdatedAt && !Number.isNaN(baseUpdatedAt.getTime())) {
    const current = context.updatedAt ? new Date(context.updatedAt) : null;
    // La instancia no tiene marca de tiempo (no deberia pasar): se acepta el save.
    if (current && Math.abs(current.getTime() - baseUpdatedAt.getTime()) > 1) {
      res.status(409).json({
        conflict: true,
        message: 'La pagina cambio en otra pestana. Recargamos la version mas reciente.',
        manifest: context.manifest,
        updatedAt: context.updatedAt,
      });
      return;
    }
  }

  const candidate = migrateManifest(body.manifest) ?? body.manifest;
  const validation = validateTemplateManifest(candidate);
  if (!validation.valid) {
    res.status(422).json({ message: 'Manifest invalido', errors: validation.errors });
    return;
  }

  const saved = await saveManifest(context.businessId, candidate as TemplateManifestLike, String(body.reason || 'Guardado del editor').slice(0, 200));
  // 503 = reintentable: el autosave del editor lo reintenta en el próximo cambio.
  if (!saved.ok) { res.status(saved.transient ? 503 : 422).json({ message: 'No se pudo guardar el manifest', errors: saved.errors }); return; }

  const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: context.businessId }, select: { updatedAt: true } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ manifest: candidate, updatedAt: fresh?.updatedAt || null, warnings: validation.warnings });
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


