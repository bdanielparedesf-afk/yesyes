import { Router } from 'express';
import { createHash } from 'crypto';
import { authenticate, type AuthRequest } from '../middlewares/auth';
import { requireBusinessOwner, ownerWhere } from '../middlewares/businessAuth';
import { prisma } from '../lib/prisma';
import {
  BLOCK_DEFINITIONS,
  LAYOUT_DEFINITIONS,
  CURRENT_MANIFEST_VERSION,
  validateTemplateManifest,
  migrateManifest,
  resolveRenderPlan,
  legacyTemplateManifest,
  createSiteInstance,
  applyOverrides,
  industryProfileOf,
  capabilitiesForCategory,
  forbiddenBlocksForCategory,
  layoutFingerprint,
} from '../template-engine';
import { canonicalCategoryCode } from '../utils/business-taxonomy';
import { sanitizeRevisionReason, latestPublishedRevision } from '../services/business-site-version.service';

const router = Router();
router.use(authenticate);

/**
 * Contrato del motor (registries). El frontend lo usa para el editor y la
 * galería, pero el BACKEND sigue siendo quien valida.
 */
router.get('/registries', (_req: AuthRequest, res) => {
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json({
    manifestVersion: CURRENT_MANIFEST_VERSION,
    blocks: BLOCK_DEFINITIONS.map((block) => ({
      id: block.id,
      label: block.label,
      description: block.description,
      group: block.group,
      capabilities: block.capabilities,
      media: block.media,
      responsive: block.responsive,
      configSchema: block.configSchema,
      actions: block.actions,
      renderInV2: block.renderInV2,
    })),
    layouts: LAYOUT_DEFINITIONS.map((layout) => ({
      id: layout.id,
      label: layout.label,
      description: layout.description,
      fingerprint: layoutFingerprint(layout.id),
      preferredBlocks: layout.preferredBlocks,
      renderInV2: layout.renderInV2,
    })),
  });
});

/** Perfil de un rubro: qué puede usar y qué le está prohibido. */
router.get('/industries/:category', (req: AuthRequest, res) => {
  const category = canonicalCategoryCode(String(req.params.category));
  const profile = industryProfileOf(category);
  res.json({
    category,
    shape: profile.shape,
    primaryAction: profile.primaryAction,
    capabilities: capabilitiesForCategory(category),
    allowedBlocks: profile.allowedBlocks,
    forbiddenBlocks: forbiddenBlocksForCategory(category),
    suggestedLayouts: profile.suggestedLayouts,
  });
});

/**
 * Valida un manifest en el BACKEND. El frontend nunca es fuente de verdad:
 * este endpoint es el que decide.
 */
router.post('/manifest/validate', (req: AuthRequest, res) => {
  const result = validateTemplateManifest((req.body as any)?.manifest);
  res.status(result.valid ? 200 : 422).json(result);
});

/** Instancia de sitio del negocio (MASTER TEMPLATE ≠ sitio del cliente). */
router.get('/:id/site-instance', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: { siteInstance: { include: { template: { select: { code: true, name: true, category: true } } } } },
  });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ instance: business.siteInstance || null });
});

/**
 * Crea (o devuelve) la instancia de sitio a partir del template elegido.
 *
 * Para un template V3 se genera un manifest de compatibilidad (`legacy: true`):
 * el negocio queda con instancia propia sin tocar su template. La migración a
 * V2 real es progresiva y posterior.
 */
router.post('/:id/site-instance', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: { template: true, siteInstance: true },
  });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  if (!business.templateId || !business.template) { res.status(400).json({ message: 'El negocio no tiene un template asignado' }); return; }

  // Idempotente: si ya existe instancia se devuelve sin recrear, para nunca
  // pisar configuracion por accidente.
  if (business.siteInstance) { res.json({ instance: business.siteInstance, created: false }); return; }

  const template = business.template;
  const isLegacy = template.legacy === true;
  const masterManifest = isLegacy
    ? legacyTemplateManifest({ code: template.code, name: template.name, category: template.category, capabilities: template.capabilities, legacy: true })
    : (template.config as Record<string, unknown> | null);

  if (!isLegacy && (!masterManifest || typeof masterManifest !== 'object')) {
    res.status(409).json({ message: 'Este template todavia no tiene un manifest V2 publicado' });
    return;
  }

  const instanceId = `site-${business.id}`;
  let manifest: unknown;
  let removedBlocks: string[] = [];

  if (isLegacy) {
    // Compatibilidad: manifest V2 minimo marcado legacy. El sitio se sigue
    // renderizando por la via V3, pero ya tiene identidad y version propias.
    manifest = { ...(masterManifest as Record<string, unknown>), templateId: instanceId };
  } else {
    const created = createSiteInstance({ masterManifest, businessCategory: business.category, instanceId });
    if (!created.ok || !created.manifest) {
      res.status(422).json({ message: 'El manifest del template no es valido', errors: created.errors, removedBlocks: created.removedBlocks });
      return;
    }
    manifest = created.manifest;
    removedBlocks = created.removedBlocks;
  }

  const validated = validateTemplateManifest(manifest);
  if (!validated.valid) { res.status(422).json({ message: 'Manifest invalido', errors: validated.errors }); return; }

  const instance = await prisma.businessSiteInstance.create({
    data: {
      businessId: business.id,
      templateId: template.id,
      manifestVersion: CURRENT_MANIFEST_VERSION,
      manifest: manifest as any,
      legacyCompatibility: isLegacy,
      revisions: {
        create: {
          manifestVersion: CURRENT_MANIFEST_VERSION,
          manifest: manifest as any,
          reason: isLegacy ? 'instancia creada desde template V3 (compatibilidad)' : 'instancia creada desde master V2',
        },
      },
    },
  });
  res.status(201).json({ instance, created: true, removedBlocks, legacy: isLegacy });
});

/**
 * Guarda la instancia del negocio. Cada cambio abre una revisión: el sitio
 * publicado NUNCA cambia en silencio y siempre se puede auditar.
 */
router.put('/:id/site-instance', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: ownerWhere(req, String(req.params.id)), include: { siteInstance: true } });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  if (!business.siteInstance) { res.status(404).json({ message: 'El negocio aun no tiene instancia de sitio' }); return; }

  const body = (req.body || {}) as { manifest?: unknown; overrides?: unknown; reason?: string };
  let nextManifest: unknown = business.siteInstance.manifest;

  if (body.manifest !== undefined) {
    const candidate = migrateManifest(body.manifest) ?? body.manifest;
    const result = validateTemplateManifest(candidate);
    if (!result.valid) { res.status(422).json({ message: 'Manifest invalido', errors: result.errors }); return; }
    nextManifest = candidate;
  } else if (body.overrides !== undefined) {
    const migrated = migrateManifest(business.siteInstance.manifest) ?? business.siteInstance.manifest;
    nextManifest = applyOverrides(migrated as any, body.overrides as Record<string, unknown>);
  }

  const result = validateTemplateManifest(nextManifest);
  if (!result.valid) { res.status(422).json({ message: 'Manifest invalido', errors: result.errors }); return; }

  const updated = await prisma.$transaction(async (tx) => {
    const instance = await tx.businessSiteInstance.update({
      where: { id: business.siteInstance!.id },
      data: { manifest: nextManifest as any, manifestVersion: CURRENT_MANIFEST_VERSION },
    });
    await tx.businessSiteRevision.create({
      data: {
        instanceId: instance.id,
        manifestVersion: CURRENT_MANIFEST_VERSION,
        manifest: nextManifest as any,
        // El motivo lo decide el backend: un `reason` del cliente no puede
        // disfrazarse de publicación y publicar la página sin el gate de pago.
        reason: sanitizeRevisionReason(body.reason),
      },
    });
    return instance;
  });

  res.setHeader('Cache-Control', 'no-store');
  res.json({ instance: updated, warnings: result.warnings });
});

/**
 * ESTADO DE VERSIONES del sitio: qué es el borrador, cuál es la versión
 * publicada y si divergen.
 *
 * Es la fuente de verdad observable del contrato DRAFT ≠ PUBLISHED: el editor
 * (y las pruebas de esta fase) comparan estas dos identificaciones en vez de
 * suponer que el historial implica separación.
 */
router.get('/:id/site-versions', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    select: { id: true, status: true, siteInstance: { select: { id: true, manifest: true, manifestVersion: true, updatedAt: true } } },
  });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const instance = business.siteInstance;
  if (!instance) { res.json({ draft: null, published: null, inSync: false, status: business.status }); return; }

  const revisionCount = await prisma.businessSiteRevision.count({ where: { instanceId: instance.id } });
  const published = await latestPublishedRevision(instance.id);
  const draft = { revision: 'DRAFT', manifestVersion: instance.manifestVersion, fingerprint: fingerprintOf(instance.manifest), updatedAt: instance.updatedAt };
  const publishedView = published
    ? { revision: published.id, manifestVersion: published.manifestVersion, fingerprint: fingerprintOf(published.manifest), publishedAt: published.createdAt }
    : null;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: business.status,
    instanceId: instance.id,
    draft,
    published: publishedView,
    // `inSync: true` significa que el borrador coincide con lo publicado: el
    // sitio en vivo ya muestra exactamente lo que se está editando.
    inSync: Boolean(published && JSON.stringify(published.manifest) === JSON.stringify(instance.manifest)),
    revisionCount,
  });
});

/** Huella estable de un manifest: permite comparar sin volcar el contenido. */
function fingerprintOf(manifest: unknown): string {
  return createHash('sha256').update(JSON.stringify(manifest ?? null)).digest('hex').slice(0, 16);
}

/** Historial de revisiones: auditoría de qué cambió y cuándo. */
router.get('/:id/site-instance/revisions', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: ownerWhere(req, String(req.params.id)), select: { siteInstance: { select: { id: true } } } });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  if (!business.siteInstance) { res.json({ revisions: [] }); return; }
  const revisions = await prisma.businessSiteRevision.findMany({
    where: { instanceId: business.siteInstance.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, manifestVersion: true, reason: true, createdAt: true },
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ revisions });
});

/** Plan de render del sitio: lo que consumirá el renderer único. */
router.get('/:id/site-plan', requireBusinessOwner, async (req: AuthRequest, res) => {
  const business = await prisma.business.findFirst({ where: ownerWhere(req, String(req.params.id)), include: { siteInstance: true } });
  if (!business) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const plan = resolveRenderPlan(business.siteInstance?.manifest);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    plan: {
      legacy: plan.legacy,
      legacyTemplateCode: plan.legacyTemplateCode,
      layout: plan.layout?.id || null,
      sections: plan.sections.map((section) => ({
        id: section.id,
        label: section.label,
        blocks: section.blocks.map((block) => ({ instanceId: block.instanceId, block: block.block.id })),
      })),
      warnings: plan.warnings,
    },
  });
});

export default router;

