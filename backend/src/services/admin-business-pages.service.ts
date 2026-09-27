/**
 * ADMIN â€” GESTIÃ“N DE PÃGINAS PUBLICADAS.
 *
 * La polÃ­tica de vida de una pÃ¡gina vive en `business-subscription-state`
 * (`publicAvailability`). Este servicio NO la redefine: la usa, y agrega lo que
 * el admin necesita hacer con ella.
 *
 * REGLA CENTRAL: dar de baja una pÃ¡gina NUNCA borra contenido. Se cambia el
 * estado del negocio, y con eso la ruta pÃºblica deja de servirlo mientras el
 * servicio siga caÃ­do. Todo el trabajo del dueÃ±o (fotos, servicios, reseÃ±as,
 * la versiÃ³n publicada del manifest) queda intacto y vuelve en lÃ­nea en un clic
 * cuando el pago se regulariza.
 */
import { prisma } from '../lib/prisma';
import { publicAvailability, availabilityLabel, type PublicAvailability } from './business-subscription-state';
import { logBusinessAudit } from './business-audit.service';

export interface AdminBusinessRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  live: boolean;
  availabilityReason: string;
  availabilityLabel: string;
  graceDaysLeft: number;
  graceUntil: string | null;
  periodEnd: string | null;
  subscriptionStatus: string | null;
  amount: number | null;
  currency: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  publishedAt: string | null;
  updatedAt: string;
  counts: { services: number; products: number; gallery: number };
}

/** Fila del panel con el estado de vida calculado en el servidor. */
export function toAdminRow(business: any, now = new Date()): AdminBusinessRow {
  const subscription = business.subscription || null;
  const availability: PublicAvailability = publicAvailability({
    businessStatus: business.status,
    subscription,
    now,
  });
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    category: business.category,
    status: business.status,
    live: availability.live,
    availabilityReason: availability.reason,
    availabilityLabel: availabilityLabel(availability),
    graceDaysLeft: availability.graceDaysLeft,
    graceUntil: availability.graceUntil ? availability.graceUntil.toISOString() : null,
    periodEnd: subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toISOString() : null,
    subscriptionStatus: subscription?.status || null,
    amount: subscription?.amount ?? null,
    currency: subscription?.currency ?? null,
    ownerEmail: business.owner?.email || null,
    ownerName: business.owner?.name || null,
    publishedAt: business.publishedAt ? new Date(business.publishedAt).toISOString() : null,
    updatedAt: new Date(business.updatedAt).toISOString(),
    counts: {
      services: business._count?.services ?? 0,
      products: business._count?.catalogItems ?? 0,
      gallery: business._count?.gallery ?? 0,
    },
  };
}

const WITH_RELATIONS = {
  subscription: { select: { status: true, amount: true, currency: true, currentPeriodEnd: true, graceUntil: true } },
  owner: { select: { id: true, email: true, name: true } },
  _count: { select: { services: true, catalogItems: true, gallery: true } },
} as const;

/** Listado con filtro por estado de vida, no solo por status del negocio. */
export async function listAdminBusinesses(options: { filter?: string; search?: string } = {}): Promise<{
  rows: AdminBusinessRow[];
  summary: { total: number; live: number; inGrace: number; down: number; activeSubs: number; monthlyRevenue: number };
}> {
  const now = new Date();
  const businesses = await prisma.business.findMany({ include: WITH_RELATIONS as any, orderBy: { updatedAt: 'desc' } });
  const all = businesses.map((b) => toAdminRow(b, now));
  let rows = all;

  const filter = String(options.filter || 'TODOS').toUpperCase();
  if (filter === 'EN_LINEA') rows = rows.filter((r) => r.live);
  else if (filter === 'BAJA') rows = rows.filter((r) => r.status === 'PUBLISHED' && !r.live);
  else if (filter === 'GRACIA') rows = rows.filter((r) => r.availabilityReason === 'GRACE_ACTIVE');
  else if (filter === 'SIN_PLAN') rows = rows.filter((r) => r.availabilityReason === 'NO_SUBSCRIPTION');
  else if (filter === 'BORRADOR') rows = rows.filter((r) => r.status === 'DRAFT');
  else if (filter === 'ARCHIVADA') rows = rows.filter((r) => r.status === 'ARCHIVED');

  const term = String(options.search || '').trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) =>
      r.name.toLowerCase().includes(term) ||
      r.slug.toLowerCase().includes(term) ||
      (r.ownerEmail || '').toLowerCase().includes(term));
  }

  const activeSubs = all.filter((r) => ['ACTIVE', 'PAST_DUE'].includes(String(r.subscriptionStatus)));
  return {
    rows,
    summary: {
      total: all.length,
      live: all.filter((r) => r.live).length,
      inGrace: all.filter((r) => r.availabilityReason === 'GRACE_ACTIVE').length,
      down: all.filter((r) => r.status === 'PUBLISHED' && !r.live).length,
      activeSubs: activeSubs.length,
      // `Number(x.amount || 0)`: si el monto viene como string desde SQLite,
      // `reduce` sobre strings concatenaria en vez de sumar. Se fuerza a número.
      monthlyRevenue: activeSubs.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
    },
  };
}

/** Carga una fila con todo lo necesario para las acciones del panel. */
async function loadRow(businessId: string): Promise<any> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, include: WITH_RELATIONS as any });
  if (!business) throw Object.assign(new Error('Negocio no encontrado'), { status: 404 });
  return business;
}

/**
 * DA DE BAJA la pÃ¡gina: pausa el negocio. El contenido se conserva.
 * Idempotente: si ya estaba pausada no vuelve a pausarla ni duplica el aviso.
 */
export async function takeDownBusinessPage(input: { businessId: string; adminId: string; reason?: string }): Promise<AdminBusinessRow> {
  const business = await loadRow(input.businessId);
  if (business.status === 'PAUSED' || business.status === 'ARCHIVED') return toAdminRow(business);
  const updated = await prisma.business.update({ where: { id: business.id }, data: { status: 'PAUSED' } });
  await logBusinessAudit('BUSINESS_PAUSED', {
    businessId: business.id,
    userId: input.adminId,
    metadata: { motivo: input.reason || 'Baja administrativa por falta de pago' },
  });
  return toAdminRow({ ...updated, subscription: business.subscription, owner: business.owner, _count: business._count });
}

/**
 * RESTABLECE la pÃ¡gina: vuelve a PUBLICAR sin volver a cobrar ni revalidar el
 * checklist. Es la operaciÃ³n de soporte: el admin ya verificÃ³ que el pago entrÃ³.
 */
export async function restoreBusinessPage(input: { businessId: string; adminId: string; reason?: string }): Promise<AdminBusinessRow> {
  const business = await loadRow(input.businessId);
  if (business.status === 'PUBLISHED') return toAdminRow(business);
  // Sin plan, publicar dejarÃ­a la pÃ¡gina visible solo por el status: exactamente
  // la fuga que se cerrÃ³. Se avisa en vez de fingir que funcionÃ³.
  if (!business.subscription) {
    throw Object.assign(new Error('Este negocio no tiene plan. Activa el cobro antes de publicarlo.'), { status: 409 });
  }
  const updated = await prisma.business.update({
    where: { id: business.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  await logBusinessAudit('BUSINESS_RESTORED', {
    businessId: business.id,
    userId: input.adminId,
    metadata: { motivo: input.reason || 'RestauraciÃ³n administrativa' },
  });
  return toAdminRow({ ...updated, subscription: business.subscription, owner: business.owner, _count: business._count });
}

/**
 * Ajuste manual del plan (soporte). NO simula un pago de Mercado Pago: queda
 * auditado y con `provider` intacto, para que un cobro real siga siendo la
 * Ãºnica fuente de verdad del estado.
 */
export async function markSubscriptionActive(input: {
  businessId: string; adminId: string; status: 'ACTIVE' | 'PAST_DUE' | 'EXPIRED'; graceDays?: number;
}): Promise<AdminBusinessRow> {
  const existing = await prisma.businessSubscription.findUnique({ where: { businessId: input.businessId } });
  if (!existing) throw Object.assign(new Error('El negocio no tiene suscripciÃ³n que activar.'), { status: 404 });
  const graceDays = Number.isFinite(input.graceDays) ? Number(input.graceDays) : 5;
  const updated = await prisma.businessSubscription.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      lastEventAt: new Date(),
      graceUntil: input.status === 'PAST_DUE' ? new Date(Date.now() + graceDays * 86400000) : null,
    },
  });
  await logBusinessAudit('BUSINESS_PAYMENT_MANUAL_ACTIVATION', {
    businessId: input.businessId,
    userId: input.adminId,
    metadata: { estado: input.status, diasGracia: graceDays },
  });
  const business = await loadRow(input.businessId);
  return toAdminRow({ ...business, subscription: { ...business.subscription, ...updated } });
}
