import type { SubscriptionStatus } from '@prisma/client';

/**
 * YESYES BUSINESS — Maquina de estados de la suscripcion.
 *
 * Esta parte es PURA (sin DB ni red) para poder testearla y para garantizar
 * que el estado de pago NUNCA se derive de query params del navegador: solo
 * se mueve con eventos verificados de Mercado Pago (o activacion manual de
 * ADMIN, auditada) y siempre de forma idempotente.
 */

export const GRACE_DAYS_DEFAULT = 5;

/** Estados en los que la pagina publica puede estar publicada. */
export const PUBLISHABLE_SUB_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'GRACE_PERIOD', 'PAST_DUE'];

export interface SubscriptionLike {
  status?: string | null;
  graceUntil?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  nextPaymentAt?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
}

const asDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Mercado Pago (preapproval) → estado interno.
 *  pending    → PENDING      (autorizada por el usuario, falta confirmacion)
 *  authorized → ACTIVE
 *  paused     → PAUSED
 *  cancelled  → CANCELLED
 *  expired    → EXPIRED
 *  rejected   → PAST_DUE
 */
export function mapProviderPreapprovalStatus(providerStatus: unknown): SubscriptionStatus {
  switch (String(providerStatus || '').toLowerCase()) {
    case 'authorized':
    case 'approved':
      return 'ACTIVE';
    case 'pending':
    case 'in_process':
      return 'PENDING';
    case 'paused':
      return 'PAUSED';
    case 'cancelled':
    case 'canceled':
      return 'CANCELLED';
    case 'expired':
      return 'EXPIRED';
    case 'rejected':
      return 'PAST_DUE';
    default:
      return 'NONE';
  }
}

/** Pago individual de Mercado Pago → estado interno (renovacion / fallo). */
export function mapProviderPaymentStatus(providerStatus: unknown): SubscriptionStatus {
  switch (String(providerStatus || '').toLowerCase()) {
    case 'approved':
      return 'ACTIVE';
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'PENDING';
    case 'rejected':
    case 'charged_back':
      return 'PAST_DUE';
    case 'cancelled':
    case 'canceled':
      return 'CANCELLED';
    case 'refunded':
      return 'PAST_DUE';
    default:
      return 'NONE';
  }
}

/** Suma periodos respetando el fin de mes (31 ene + 1 mes = 28/29 feb). */
export function addPeriods(from: Date, frequency: number, frequencyType: string): Date {
  const periods = Number.isFinite(Number(frequency)) && Number(frequency) > 0 ? Number(frequency) : 1;
  const d = new Date(from.getTime());
  if (String(frequencyType).toUpperCase() === 'YEAR') {
    d.setFullYear(d.getFullYear() + periods);
    return d;
  }
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + periods);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export interface PeriodWindow {
  start: Date;
  end: Date;
  next: Date;
}

export function computePeriod(
  start: Date,
  frequency: number,
  frequencyType: string,
): PeriodWindow {
  const end = addPeriods(start, frequency, frequencyType);
  return { start, end, next: end };
}

export function graceUntilFrom(periodEnd: Date | null, graceDays = GRACE_DAYS_DEFAULT): Date | null {
  if (!periodEnd) return null;
  const days = Number.isFinite(graceDays) && graceDays >= 0 ? graceDays : GRACE_DAYS_DEFAULT;
  return new Date(periodEnd.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Estado efectivo considerando el reloj: un PAST_DUE deja de ser publicable
 * cuando vence el periodo de gracia (pasa a PAUSED sin borrar nada).
 */
export function effectiveSubscriptionStatus(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): SubscriptionStatus {
  const status = (String(sub?.status || 'NONE') as SubscriptionStatus) || 'NONE';
  if (status !== 'PAST_DUE') return status;
  const grace = asDate(sub?.graceUntil);
  if (grace && now.getTime() > grace.getTime()) return 'PAUSED';
  return 'PAST_DUE';
}

export function subscriptionAllowsPublishing(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  return PUBLISHABLE_SUB_STATUSES.includes(effectiveSubscriptionStatus(sub, now));
}

/** Mensaje para el panel (nunca se usa para decidir nada en el backend). */
export function subscriptionStatusMessage(sub: SubscriptionLike | null | undefined, now: Date = new Date()): string {
  switch (effectiveSubscriptionStatus(sub, now)) {
    case 'ACTIVE':
      return 'Tu suscripción está activa.';
    case 'PENDING':
      return 'Estamos verificando el pago con Mercado Pago. Tu página se publicará al confirmarse.';
    case 'PAST_DUE':
      return 'No pudimos cobrar tu suscripción. Regulariza el pago para mantener tu página publicada.';
    case 'GRACE_PERIOD':
      return 'Tu pago está pendiente. Mantendremos tu página publicada durante el periodo de gracia.';
    case 'PAUSED':
      return 'Tu suscripción está pausada. Tu contenido se conserva: reactívala para volver a publicar.';
    case 'CANCELLED':
      return 'Tu suscripción fue cancelada. Tu contenido se conserva y puedes reactivarla.';
    case 'EXPIRED':
      return 'Tu suscripción expiró. Reactívala para volver a publicar tu página.';
    default:
      return 'Aún no tienes una suscripción activa.';
  }
}

export function isSubscriptionActiveLike(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const s = effectiveSubscriptionStatus(sub, now);
  return s === 'ACTIVE' || s === 'GRACE_PERIOD' || s === 'PAST_DUE';
}
