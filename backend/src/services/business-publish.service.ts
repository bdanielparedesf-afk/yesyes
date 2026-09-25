import { prisma } from '../lib/prisma';
import { resolveCapabilities } from '../utils/business-capabilities';
import { subscriptionAllowsPublishing, type SubscriptionLike } from './business-subscription-state';
import { getSubscriptionForBusiness, toSubscriptionDTO } from './business-subscription.service';
import { logBusinessAudit } from './business-audit.service';
import { logger } from '../utils/logger';

/**
 * YESYES BUSINESS — Publicacion controlada.
 *
 * REGLA CRITICA: una pagina NO se publica porque el navegador volvio de
 * Mercado Pago. Se publica cuando existe una suscripcion con estado
 * publicable (ACTIVE / GRACE_PERIOD / PAST_DUE dentro de la gracia), es decir
 * cuando un evento del proveedor (o una activacion manual auditada de ADMIN)
 * movio el estado de pago.
 */

export type ChecklistKey =
  | 'name' | 'category' | 'template' | 'description' | 'contact' | 'cta'
  | 'mainContent' | 'mainImage' | 'seo' | 'subscription';

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  ok: boolean;
  required: boolean;
}

export interface PublishChecklist {
  items: ChecklistItem[];
  ready: boolean;
  missingRequired: ChecklistKey[];
  missingRecommended: ChecklistKey[];
}

/** Que contenido principal usa cada rubro (nunca exige lo que no corresponde). */
export const CATEGORY_REQUIREMENTS: Record<string, { mainContent: 'services' | 'products' | 'properties' | 'gallery' }> = {
  HAIR: { mainContent: 'services' },
  BARBER: { mainContent: 'services' },
  BEAUTY: { mainContent: 'services' },
  MECHANIC: { mainContent: 'services' },
  CLEANING: { mainContent: 'services' },
  TUTORING: { mainContent: 'services' },
  CONSTRUCTION: { mainContent: 'services' },
  DETAILING: { mainContent: 'services' },
  PET: { mainContent: 'services' },
  PHOTO: { mainContent: 'gallery' },
  BAKERY: { mainContent: 'products' },
  FLOWERS: { mainContent: 'products' },
  FOOD: { mainContent: 'products' },
  CAFE: { mainContent: 'products' },
  NAILS: { mainContent: 'services' },
  FITNESS: { mainContent: 'services' },
  AUTO: { mainContent: 'services' },
  PRO: { mainContent: 'services' },
  BOUTIQUE: { mainContent: 'products' },
  FURNITURE: { mainContent: 'products' },
  PHONE: { mainContent: 'products' },
  REAL_ESTATE: { mainContent: 'properties' },
};

export function mainContentKindFor(
  category: string | null | undefined,
): 'services' | 'products' | 'properties' | 'gallery' {
  return CATEGORY_REQUIREMENTS[String(category || '')]?.mainContent || 'gallery';
}

export interface PublishChecklistInput {
  business: any;
  template?: { id: string; code: string } | null;
  subscription?: SubscriptionLike | null;
  counts?: { services: number; products: number; properties: number; gallery: number };
  /** El backend puede publicar páginas administrativas sin suscripción. */
  isAdmin?: boolean;
}

/**
 * Checklist de publicacion. `required` impide publicar; el resto son
 * recomendaciones que NO bloquean (una inmobiliaria no necesita servicios y
 * una barberia no necesita propiedades).
 */
export function businessPublishChecklist(input: PublishChecklistInput): PublishChecklist {
  const b = input.business || {};
  const counts = input.counts || { services: 0, products: 0, properties: 0, gallery: 0 };
  const main = mainContentKindFor(b.category);
  const mainCount =
    main === 'services' ? counts.services
      : main === 'products' ? counts.products
        : main === 'properties' ? counts.properties
          : counts.gallery;

  const items: ChecklistItem[] = [
    { key: 'name', label: 'Nombre del negocio', ok: Boolean(b.name), required: true },
    { key: 'category', label: 'Categoría', ok: Boolean(b.category), required: true },
    { key: 'template', label: 'Plantilla elegida', ok: Boolean(input.template?.code || b.templateId), required: true },
    { key: 'description', label: 'Descripción', ok: Boolean(b.description), required: true },
    { key: 'contact', label: 'Al menos un canal de contacto', ok: Boolean(b.whatsapp || b.phone || b.email), required: true },
    { key: 'cta', label: 'Llamado a la acción', ok: Boolean(b.cta) || Boolean(b.whatsapp), required: true },
    { key: 'mainContent', label: `Contenido principal (${main})`, ok: mainCount > 0, required: false },
    { key: 'mainImage', label: 'Imagen principal (logo, portada o galería)', ok: Boolean(b.logo || b.cover || counts.gallery > 0), required: false },
    { key: 'seo', label: 'SEO (título o descripción)', ok: Boolean(b.seoTitle || b.seoDescription), required: false },
    { key: 'subscription', label: 'Suscripción activa', ok: Boolean(input.isAdmin) || subscriptionAllowsPublishing(input.subscription ?? null), required: !input.isAdmin },
  ];

  const missingRequired = items.filter((i) => i.required && !i.ok).map((i) => i.key);
  const missingRecommended = items.filter((i) => !i.required && !i.ok).map((i) => i.key);
  return { items, ready: missingRequired.length === 0, missingRequired, missingRecommended };
}

export interface PublishGateError {
  status: number;
  code: 'PAYMENT_REQUIRED' | 'INCOMPLETE' | 'ARCHIVED' | 'NOT_FOUND';
  message: string;
}

export const PAYMENT_REQUIRED_MESSAGE =
  'Necesitas una suscripción activa para publicar tu página. Completa el pago y vuelve a intentarlo.';

/** Contexto completo (business + template + suscripcion + capacidades + checklist). */
export async function businessPublishContext(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      template: { select: { id: true, code: true, capabilities: true } },
      subscription: { include: { plan: true } },
    },
  });
  if (!business) return null;

  const services = await prisma.businessService.count({ where: { businessId, active: true, NOT: { name: { startsWith: 'Contenido de ejemplo' } } } });
  const products = await prisma.businessCatalogItem.count({ where: { businessId, active: true, NOT: { OR: [{ metadata: { path: ['demo'], equals: true } }, { name: { startsWith: 'Contenido de ejemplo' } }] } } });
  const properties = await prisma.property.count({ where: { businessId, published: true } });
  const gallery = await prisma.businessGalleryImage.count({ where: { businessId } });
  const subscription = await getSubscriptionForBusiness(businessId);
  const category = await prisma.businessCategory.findUnique({
    where: { code: business.category },
    select: { defaultCapabilities: true },
  });

  const counts = { services, products, properties, gallery };
  return {
    business,
    template: business.template,
    subscription,
    counts,
    checklist: businessPublishChecklist({ business, template: business.template, subscription, counts }),
    capabilities: resolveCapabilities({
      templateCapabilities: business.template?.capabilities,
      categoryDefaults: category?.defaultCapabilities,
      businessCapabilities: (business.settings as any)?.capabilities,
      savedSections: (business.settings as any)?.sections,
    }),
  };
}

/** Error que impide publicar, o null si todo esta OK. */
export function publishGate(input: { business: any; checklist: PublishChecklist }): PublishGateError | null {
  if (String(input.business?.status) === 'ARCHIVED') {
    return { status: 409, code: 'ARCHIVED', message: 'Este negocio está archivado. Restáuralo antes de publicarlo.' };
  }
  if (input.checklist.missingRequired.includes('subscription')) {
    return { status: 409, code: 'PAYMENT_REQUIRED', message: PAYMENT_REQUIRED_MESSAGE };
  }
  if (!input.checklist.ready) {
    return { status: 400, code: 'INCOMPLETE', message: 'Faltan datos obligatorios para publicar.' };
  }
  return null;
}


/**
 * Publica el negocio si (y solo si) el pago esta confirmado y el checklist
 * obligatorio se cumple. Idempotente: publicar dos veces no rompe nada.
 */
export async function publishBusiness(params: {
  businessId: string;
  userId?: string | null;
  ip?: string | null;
  isAdmin?: boolean;
}): Promise<
  | { ok: true; business: any; checklist: PublishChecklist; subscription: any }
  | { ok: false; error: PublishGateError; checklist?: PublishChecklist }
> {
  const ctx = await businessPublishContext(params.businessId);
  if (!ctx) {
    return { ok: false, error: { status: 404, code: 'NOT_FOUND', message: 'Negocio no encontrado' } };
  }
  if (params.isAdmin) {
    ctx.checklist = businessPublishChecklist({ business: ctx.business, template: ctx.template, subscription: ctx.subscription, counts: ctx.counts, isAdmin: true });
  }
  const gate = publishGate({ business: ctx.business, checklist: ctx.checklist });
  if (gate) return { ok: false, error: gate, checklist: ctx.checklist };

  const alreadyPublished = ctx.business.status === 'PUBLISHED';
  const business = await prisma.business.update({
    where: { id: params.businessId },
    data: {
      status: 'PUBLISHED',
      ...(ctx.business.publishedAt ? {} : { publishedAt: new Date() }),
    },
  });

  // Congelar el borrador actual como revisión PUBLICADA. La página pública
  // renderiza esta revisión, así que el usuario puede seguir experimentando
  // con el diseño sin que el sitio en vivo cambie hasta volver a publicar.
  try {
    const instance = await prisma.businessSiteInstance.findUnique({
      where: { businessId: params.businessId },
      select: { id: true, manifest: true, manifestVersion: true },
    });
    if (instance) {
      const alreadyFrozen = await prisma.businessSiteRevision.findFirst({
        where: { instanceId: instance.id, reason: { startsWith: 'PUBLICADO' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, manifest: true },
      });
      const sameAsPublished = JSON.stringify(alreadyFrozen?.manifest ?? null) === JSON.stringify(instance.manifest);
      if (!sameAsPublished) {
        await prisma.businessSiteRevision.create({
          data: {
            id: `rev-${params.businessId}-pub-${Date.now()}`,
            instanceId: instance.id,
            manifestVersion: instance.manifestVersion,
            manifest: instance.manifest as any,
            reason: `PUBLICADO ${new Date().toISOString()}`,
          },
        });
      }
    }
  } catch {
    // Publicar el negocio nunca falla por la congelación del manifest: el
    // sitio seguirá funcionando por la vía que ya tenía.
    logger.warn('[business] no se pudo congelar la revisión publicada', { businessId: params.businessId });
  }

  if (!alreadyPublished) {
    await logBusinessAudit('BUSINESS_PUBLISHED', {
      businessId: params.businessId,
      userId: params.userId,
      ip: params.ip,
      metadata: { status: business.status, subscription: ctx.subscription?.status || 'NONE' },
    });
    if (ctx.subscription) {
      await logBusinessAudit('BUSINESS_PAYMENT_CONFIRMED', {
        businessId: params.businessId,
        userId: params.userId,
        metadata: { subscriptionId: ctx.subscription.id, status: ctx.subscription.status },
      });
    }
  }

  return { ok: true, business, checklist: ctx.checklist, subscription: ctx.subscription };
}

/** Pausa la pagina (conserva contenido, leads, estadisticas y suscripcion). */
export async function pauseBusiness(params: {
  businessId: string;
  userId?: string | null;
  ip?: string | null;
  reason?: string;
}) {
  const business = await prisma.business.update({
    where: { id: params.businessId },
    data: { status: 'PAUSED' },
  });
  await logBusinessAudit('BUSINESS_PAUSED', {
    businessId: params.businessId,
    userId: params.userId,
    ip: params.ip,
    metadata: { reason: params.reason || null },
  });
  return business;
}

/**
 * Archiva el negocio (borrado logico). NUNCA borra relaciones: conserva leads,
 * estadisticas, pagos, suscripcion y contenido.
 */
export async function archiveBusinessSoft(params: {
  businessId: string;
  userId?: string | null;
  ip?: string | null;
}) {
  const business = await prisma.business.update({
    where: { id: params.businessId },
    data: { status: 'ARCHIVED' },
  });
  await logBusinessAudit('BUSINESS_ARCHIVED', {
    businessId: params.businessId,
    userId: params.userId,
    ip: params.ip,
  });
  return business;
}

/**
 * Sincroniza la publicacion con el estado de pago. Se invoca DESPUES de aplicar
 * un cambio de suscripcion verificado (webhook, sync admin o activacion manual).
 *
 *  - pago publicable + negocio en PAYMENT_PENDING/PREVIEW/DRAFT → publica si el
 *    checklist obligatorio esta completo (si no, queda en PREVIEW y el owner
 *    publica cuando termine de completar los datos);
 *  - pago no publicable + negocio PUBLISHED → la pagina publica pasa a
 *    mantenimiento (PAUSED) sin borrar nada.
 */
export async function syncPublicationWithSubscription(
  businessId: string,
  actor?: { userId?: string | null; ip?: string | null },
) {
  const ctx = await businessPublishContext(businessId);
  if (!ctx) return { changed: false, status: null as string | null };

  const canPublish = subscriptionAllowsPublishing(ctx.subscription ?? null);
  const status = String(ctx.business.status);

  if (canPublish && ['PAYMENT_PENDING', 'PREVIEW', 'DRAFT'].includes(status) && ctx.checklist.ready) {
    const result = await publishBusiness({ businessId, userId: actor?.userId, ip: actor?.ip });
    return { changed: true, status: result.ok ? 'PUBLISHED' : status };
  }

  if (!canPublish && status === 'PUBLISHED') {
    await pauseBusiness({
      businessId,
      userId: actor?.userId,
      ip: actor?.ip,
      reason: 'SUBSCRIPTION_NOT_PUBLISHABLE',
    });
    return { changed: true, status: 'PAUSED' };
  }

  return { changed: false, status };
}

/** Marca el negocio como pendiente de pago (al iniciar el checkout). */
export async function markPaymentPending(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { status: true } });
  if (!business) return null;
  // Una pagina ya publicada no se cae por iniciar una renovacion o pago.
  if (business.status === 'PUBLISHED' || business.status === 'PAUSED') return business;
  return prisma.business.update({ where: { id: businessId }, data: { status: 'PAYMENT_PENDING' } });
}

/** Estado resumido de facturacion para el panel del owner/ADMIN. */
export async function businessBillingOverview(businessId: string) {
  const subscription = await getSubscriptionForBusiness(businessId);
  return toSubscriptionDTO(subscription, businessId);
}