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

/**
 * ¿ESTÁ VIVA LA PÁGINA DE ESTE NEGOCIO?
 *
 * Es la UNICA fuente de verdad de esa pregunta. La usan por igual la ruta
 * pública (para decidir si sirve o no) y el panel de admin (para explicar por
 * qué), así que no pueden discrepar.
 *
 * POLÍTICA (la acordada):
 *  - Con plan al día o dentro de la gracia: la página vive.
 *  - Vencida la gracia: se da de BAJA de inmediato. No hay aviso intermedio:
 *    el dueño ya tuvo 5 días de gracia para regularizar, y una franja de
 *    "regulariza tu pago" en el sitio de un restaurante se lee como que la
 *    plataforma anda mal.
 *
 * IMPORTANTE: dar de baja NUNCA borra contenido. El negocio, sus servicios,
 * fotos y reseñas siguen intactos para poder reactivarlo en un clic. Por eso
 * se responde con "viva: sí/no" y no se toca la fila.
 */

export interface PublicAvailability {
  live: boolean;
  reason: 'NO_SUBSCRIPTION' | 'NOT_PUBLISHABLE' | 'GRACE_ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'OK';
  /** Días que quedan de gracia; 0 cuando ya venció. */
  graceDaysLeft: number;
  graceUntil: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Estados en los que la página sigue en línea. */
const LIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'PENDING', 'PAST_DUE'];

/** ¿La suscripción está en un estado que impide, por sí solo, publicar? */
function isPublishable(status: SubscriptionStatus | null | undefined): boolean {
  return PUBLISHABLE_SUB_STATUSES.includes(String(status) as SubscriptionStatus);
}

/**
 * Gracia vencida = 0 días. Si `graceUntil` es null y el estado es PAST_DUE, se
 * trata como vencida: no regalar un plazo infinito por un dato ausente.
 */
function graceDaysLeft(subscription: SubscriptionLike, now: Date): number {
  if (String(subscription.status) !== 'PAST_DUE') return 0;
  const until = asDate(subscription.graceUntil);
  if (!until) return 0;
  const left = Math.ceil((until.getTime() - now.getTime()) / DAY);
  return left > 0 ? left : 0;
}

/**
 * Decide si la página pública debe servirse.
 *
 * `isAdmin` NO salta el chequeo: el admin tampoco puede ver en vivo una página
 * sin plan (debe usar el preview con token). Lo que sí puede es forzar la
 * baja o la reactivación desde el panel, que son acciones explícitas.
 */
export function publicAvailability(input: {
  businessStatus?: string | null;
  subscription?: SubscriptionLike | null;
  now?: Date;
}): PublicAvailability {
  const now = input.now ?? new Date();

  if (input.businessStatus !== 'PUBLISHED') {
    return { live: false, reason: 'NOT_PUBLISHABLE', graceDaysLeft: 0, graceUntil: null };
  }
  // Un negocio sin fila de suscripción nunca se cobró: no puede estar en línea.
  // Esto es lo que cerró la fuga descrita en el diagnóstico.
  if (!input.subscription) {
    return { live: false, reason: 'NO_SUBSCRIPTION', graceDaysLeft: 0, graceUntil: null };
  }
  const status = String(input.subscription.status) as SubscriptionStatus;
  if (status === 'CANCELLED') {
    return { live: false, reason: 'CANCELLED', graceDaysLeft: 0, graceUntil: null };
  }
  if (!LIVE_STATUSES.includes(status)) {
    return { live: false, reason: 'EXPIRED', graceDaysLeft: 0, graceUntil: null };
  }
  if (status === 'PAST_DUE') {
    const left = graceDaysLeft(input.subscription, now);
    const until = asDate(input.subscription.graceUntil);
    if (left <= 0) {
      return { live: false, reason: 'EXPIRED', graceDaysLeft: 0, graceUntil: null };
    }
    return { live: true, reason: 'GRACE_ACTIVE', graceDaysLeft: left, graceUntil: until };
  }
  return { live: true, reason: 'OK', graceDaysLeft: 0, graceUntil: asDate(input.subscription.graceUntil) };
}

/** Texto corto para el panel de admin. */
export function availabilityLabel(availability: PublicAvailability): string {
  switch (availability.reason) {
    case 'OK': return 'En línea';
    case 'GRACE_ACTIVE': return `En línea · ${availability.graceDaysLeft} día(s) de gracia`;
    case 'EXPIRED': return 'Dada de baja · pago vencido';
    case 'CANCELLED': return 'Dada de baja · suscripción cancelada';
    case 'NO_SUBSCRIPTION': return 'Dada de baja · sin plan';
    default: return 'No publicada';
  }
}

export { isPublishable };


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
