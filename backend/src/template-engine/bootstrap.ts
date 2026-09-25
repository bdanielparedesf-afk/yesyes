
/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Bootstrap de instancia (Fase 4.1).
 *
 * Crea la instancia de sitio V2 de un negocio recien creado, o recupera la que
 * ya tenia. Nunca lanza por falta de plantilla: si no se puede construir, el
 * negocio sigue siendo valido y caera a la via de compatibilidad.
 *
 * La instancia se construye SIEMPRE desde un DISEÑO (no desde un componente
 * V3): la plantilla elegida aporta composicion inicial, y el sitio queda
 * conteniendo un manifest V2 con bloques reales.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { CURRENT_MANIFEST_VERSION } from './template-manifest';
import { designFromTemplate, manifestFromDesign, type DesignSourceRow } from './design-registry';
import { validateTemplateManifest } from './template-manifest';

type Tx = Prisma.TransactionClient | typeof prisma;

const INSTANCE_SELECT = {
  id: true,
  manifest: true,
  manifestVersion: true,
  legacyCompatibility: true,
  templateId: true,
  updatedAt: true,
} as const;

/**
 * Crea o devuelve la instancia V2 del negocio. Idempotente: si ya existe, la
 * devuelve sin tocar su manifest (nunca se pisa configuracion por accidente).
 */
export async function ensureSiteInstance(businessId: string, tx: Tx = prisma): Promise<{
  instance: { id: string; manifest: unknown; manifestVersion: number; legacyCompatibility: boolean; templateId: string; updatedAt: Date } | null;
  created: boolean;
  designId: string | null;
}> {
  const existing = await tx.businessSiteInstance.findUnique({ where: { businessId }, select: INSTANCE_SELECT });
  if (existing) return { instance: existing, created: false, designId: null };

  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, category: true, templateId: true },
  });
  if (!business) return { instance: null, created: false, designId: null };

  const template = business.templateId
    ? await tx.businessTemplate.findUnique({
        where: { id: business.templateId },
        select: { id: true, code: true, name: true, category: true, style: true, capabilities: true, legacy: true },
      })
    : null;

  if (!template) {
    // Sin plantilla no hay diseño inicial. Se registra y el sitio usa la via
    // de compatibilidad: es preferible a inventar una composicion.
    logger.warn('[business] el negocio no tiene plantilla: sin instancia de sitio', { businessId });
    return { instance: null, created: false, designId: null };
  }

  const row: DesignSourceRow = {
    templateId: template.id,
    code: template.code,
    name: template.name,
    category: String(business.category),
    style: template.style,
    capabilities: template.capabilities,
  };
  const instanceId = 'site-' + business.id;
  const design = designFromTemplate(row);
  const manifest = manifestFromDesign(design, { instanceId, businessName: business.name });

  const validation = validateTemplateManifest(manifest);
  if (!validation.valid) {
    logger.error('[business] el manifest generado no es valido; se usa la via de compatibilidad', {
      businessId,
      errors: validation.errors,
    });
    return { instance: null, created: false, designId: null };
  }

  const instance = await tx.businessSiteInstance.create({
    data: {
      id: instanceId,
      businessId: business.id,
      templateId: template.id,
      manifestVersion: CURRENT_MANIFEST_VERSION,
      manifest: manifest as any,
      overrides: {} as any,
      legacyCompatibility: false,
    },
    select: INSTANCE_SELECT,
  });

  // Historial append-only: deja constancia del punto de partida.
  await tx.businessSiteRevision.create({
    data: {
      id: `rev-${business.id}-inicio`,
      instanceId,
      manifestVersion: CURRENT_MANIFEST_VERSION,
      manifest: manifest as any,
      reason: `Diseño inicial: ${design.label}`,
    },
  });

  return { instance, created: true, designId: design.id };
}

/** Filas de plantillas que sirven para derivar el catálogo de diseños. */
export async function loadDesignSources(): Promise<DesignSourceRow[]> {
  const rows = await prisma.businessTemplate.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, name: true, category: true, style: true, capabilities: true },
  });
  return rows.map((row) => ({
    templateId: row.id,
    code: row.code,
    name: row.name,
    category: String(row.category),
    style: row.style,
    capabilities: row.capabilities,
  }));
}







