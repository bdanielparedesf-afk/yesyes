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
import { cancelSubscription } from './business-subscription.service';

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

/**
 * ELIMINA una página, con o sin barreras.
 *
 * HAY DOS OPERACIONES DISTINTAS y por eso un solo parámetro las separa:
 *
 *  - SIN `force` (por defecto): solo borra páginas que NUNCA se publicaron, sin
 *    suscripción y sin actividad. Es la operación segura y la que usa un solo
 *    clic. Una página que estuvo en línea tiene visitas, enlaces compartidos y
 *    leads: para esa, la respuesta es dar de baja, no borrar.
 *
 *  - CON `force`: borra cualquier página. Es la limpieza de los negocios de
 *    prueba, que es un trabajo distinto: ahí no hay nadie esperando nada, y
 *    dejar filas que el admin tiene que revisar a mano no escala. Se audita con
 *    el motivo para poder revisar después qué se eliminó a la fuerza.
 *
 * LO QUE EL BARRENO DE FUERZA NO SE SALTA: si hay un preapproval VIVO de
 * Mercado Pago, se cancela en el proveedor ANTES de borrar la fila local.
 * Borrar la suscripción sin cancelar el cobro dejaría al dueño pagando un plan
 * recurrente por una página que ya no existe, y eso es dinero real saliendo de
 * una tarjeta real. Es el único punto donde el borrado toca el exterior, y por
 * eso va primero y nunca se omite.
 */
export async function deleteUnpublishedBusiness(input: {
  businessId: string;
  adminId: string;
  force?: boolean;
  reason?: string;
}): Promise<{ deleted: boolean; name: string; cancelledInProvider: boolean; forced: boolean }> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    include: {
      subscription: { select: { id: true, status: true, providerSubscriptionId: true } },
      _count: { select: { leads: true, orders: true, payments: true } },
    },
  });
  if (!business) throw Object.assign(new Error('Negocio no encontrado'), { status: 404 });

  const force = Boolean(input.force);
  if (!force) {
    // Se responde 409 y no con un borrado parcial: el admin tiene que saber
    // POR QUÉ no se borró, no ver que "no pasó nada".
    if (business.publishedAt || business.status === 'PUBLISHED') {
      throw Object.assign(
        new Error('Esta página estuvo publicada. Solo se eliminan páginas que nunca se publicaron; usa "Dar de baja" para conservarla, o "Eliminar de todos modos" si es una página de prueba.'),
        { status: 409 },
      );
    }
    if (business.subscription) {
      throw Object.assign(
        new Error('Este negocio tiene una suscripción asociada. Si es una página de prueba, puedes eliminarla de todos modos.'),
        { status: 409 },
      );
    }
    const { leads, orders, payments } = business._count;
    if (leads || orders || payments) {
      throw Object.assign(
        new Error('Este negocio tiene actividad (pedidos, pagos o contactos). Si es una página de prueba, puedes eliminarla de todos modos.'),
        { status: 409 },
      );
    }
  }

  // Primero el proveedor: es la única acción que no se puede deshacer borrando
  // la fila local, y deja al dueño cobrando por algo que ya no existe.
  let cancelledInProvider = false;
  if (business.subscription?.providerSubscriptionId) {
    try {
      // Se reusa `cancelSubscription`, que ya habla con el proveedor y aplica
      // el estado local. Duplicar la llamada al preapproval aquí sería una
      // segunda implementación de la misma cosa, y las dos terminarían
      // divergiendo.
      await cancelSubscription(business.id);
      cancelledInProvider = true;
    } catch {
      // Si el proveedor no responde, NO se borra la página: se avisaría al
      // dueño que se dio de baja cuando en realidad le seguirían cobrando.
      throw Object.assign(
        new Error('No se pudo cancelar el cobro en Mercado Pago, así que no se eliminó la página. Inténtalo de nuevo en unos minutos: no quieres que a este cliente se le siga cobrando.'),
        { status: 502 },
      );
    }
  }

  await prisma.business.delete({ where: { id: business.id } });
  await logBusinessAudit(force ? 'BUSINESS_DELETED_FORCED' : 'BUSINESS_DELETED_UNPUBLISHED', {
    businessId: business.id,
    userId: input.adminId,
    metadata: {
      nombre: business.name,
      categoria: business.category,
      forzado: force,
      motivo: input.reason || (force ? 'Limpieza de páginas de prueba' : 'Página nunca publicada'),
      canceladoEnMercadoPago: cancelledInProvider,
      leads: business._count.leads,
      orders: business._count.orders,
      payments: business._count.payments,
    },
  });
  return { deleted: true, name: business.name, cancelledInProvider, forced: force };
}


/**
 * ELIMINA VARIAS PÁGINAS DE UNA VEZ (limpieza de prueba).
 *
 * POR QUÉ NO ES UN `for` CON UN DELETE: la operación individual puede fallar
 * por una razón que no depende de las demás — el cobro de Mercado Pago que no
 * se pudo cancelar. Si el lote fuera una transacción, un solo fallo dejaría sin
 * borrar las 49 páginas de las 50, y el admin no sabría por qué. Así que cada
 * página se resuelve por separado y se devuelve qué se borró y qué no, con el
 * motivo de cada rechazo.
 *
 * LÍMITE DE TAMAÑO: no es un adorno. El endpoint reenvía al proveedor una vez
 * por cada página con cobro vivo, y un lote sin tope sería una forma de colgar
 * la API con una sola petición. Cuarenta y nueve es el lote real que se quiere
 * hacer; de sobra.
 */
export async function deleteManyBusinesses(input: {
  businessIds: string[];
  adminId: string;
  force?: boolean;
  reason?: string;
}): Promise<{
  deleted: string[];
  failed: { id: string; name: string; reason: string }[];
  cancelledInProvider: string[];
}> {
  const ids = Array.from(new Set(input.businessIds.map((id) => String(id)).filter(Boolean)));
  if (!ids.length) throw Object.assign(new Error('No se seleccionó ninguna página.'), { status: 400 });
  if (ids.length > 49) {
    throw Object.assign(new Error(`Solo se pueden eliminar 49 páginas por vez (seleccionaste ${ids.length}).`), { status: 400 });
  }

  const deleted: string[] = [];
  const failed: { id: string; name: string; reason: string }[] = [];
  const cancelledInProvider: string[] = [];

  for (const id of ids) {
    try {
      const result = await deleteUnpublishedBusiness({
        businessId: id,
        adminId: input.adminId,
        force: input.force,
        reason: input.reason,
      });
      deleted.push(id);
      if (result.cancelledInProvider) cancelledInProvider.push(id);
    } catch (error: any) {
      // Se sigue con las demás: una página que no se puede borrar no puede
      // impedir que se limpien las otras. El motivo se le devuelve al admin
      // para que sepa cuál quedó y por qué.
      const nombre = await prisma.business
        .findUnique({ where: { id }, select: { name: true } })
        .then((row) => row?.name || id)
        .catch(() => id);
      failed.push({ id, name: nombre, reason: error?.message || 'No se pudo eliminar' });
    }
  }

  return { deleted, failed, cancelledInProvider };
}

