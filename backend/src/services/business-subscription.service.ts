import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago';
import { prisma } from '../lib/prisma';
import {
  BUSINESS_PLAN_SEEDS,
  DEFAULT_PLAN_CODE,
  RECURRING_CHARGE_NOTICE,
  type BusinessPlanSeed,
} from '../config/business-plans';
import {
  computePeriod,
  effectiveSubscriptionStatus,
  graceUntilFrom,
  GRACE_DAYS_DEFAULT,
  mapProviderPaymentStatus,
  mapProviderPreapprovalStatus,
  subscriptionAllowsPublishing,
  subscriptionStatusMessage,
  type SubscriptionLike,
} from './business-subscription-state';

/**
 * YESYES BUSINESS — Suscripciones (cobro de YesYes al negocio).
 *
 * IMPORTANTE: esto es INDEPENDIENTE de `BusinessMercadoPago`, que guarda las
 * credenciales OAuth con las que un negocio cobra a SUS clientes. Aqui YesYes
 * cobra la suscripcion mensual usando su propia cuenta de Mercado Pago
 * (MERCADOPAGO_ACCESS_TOKEN) y la API de suscripciones (preapproval).
 */

export interface PreapprovalClientLike {
  create(args: { body: Record<string, unknown> }): Promise<any>;
  get(args: { id: string }): Promise<any>;
  update(args: { id: string; body: Record<string, unknown> }): Promise<any>;
}

export interface PaymentClientLike {
  get(args: { id: string }): Promise<any>;
}

function platformConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    const err = new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
    (err as any).status = 503;
    throw err;
  }
  return new MercadoPagoConfig({ accessToken });
}

export function platformPreapprovalClient(): PreapprovalClientLike {
  return new PreApproval(platformConfig()) as unknown as PreapprovalClientLike;
}

export function platformPaymentClient(): PaymentClientLike {
  return new Payment(platformConfig()) as unknown as PaymentClientLike;
}

export function businessPublicBaseUrl(): string {
  const explicit = (process.env.BUSINESS_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (frontend) return frontend;
  return 'https://yesyes.cl';
}

export function businessWebhookUrl(): string {
  const backend = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  const base = backend.startsWith('https://') ? backend : businessPublicBaseUrl();
  return `${base}/api/webhooks/mercadopago/business`;
}

export function graceDays(): number {
  const raw = Number(process.env.BUSINESS_GRACE_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : GRACE_DAYS_DEFAULT;
}

export function planSeedByCode(code: string): BusinessPlanSeed | undefined {
  return BUSINESS_PLAN_SEEDS.find((p) => p.code === code);
}

/**
 * Plan por defecto. Si el seed todavia no corrio se crea de forma idempotente
 * a partir de la definicion central: la pagina de pago nunca queda sin plan y
 * el precio existe en UN solo lugar del codigo.
 */
export async function getOrCreateDefaultPlan() {
  const existing = await prisma.businessPlan.findFirst({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
  if (existing) return existing;
  const seed = planSeedByCode(DEFAULT_PLAN_CODE) ?? BUSINESS_PLAN_SEEDS[0];
  if (!seed) {
    const err = new Error('No hay planes configurados (BUSINESS_PLAN_SEEDS vacío).');
    (err as any).status = 503;
    throw err;
  }
  return prisma.businessPlan.upsert({
    where: { code: seed.code },
    update: { active: true },
    create: {
      code: seed.code,
      name: seed.name,
      description: seed.description,
      amount: seed.amount,
      currency: seed.currency,
      frequency: seed.frequency,
      frequencyType: seed.frequencyType,
      features: seed.features,
      trialDays: seed.trialDays,
      active: true,
      order: seed.order,
    },
  });
}

export async function listActivePlans() {
  const plans = await prisma.businessPlan.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { amount: 'asc' }],
  });
  if (plans.length) return plans;
  return [await getOrCreateDefaultPlan()];
}

export async function getSubscriptionForBusiness(businessId: string) {
  return prisma.businessSubscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });
}

export interface SubscriptionDTO {
  id: string | null;
  businessId: string;
  status: string;
  effectiveStatus: string;
  message: string;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: string;
  plan: { code: string; name: string; features: string[] } | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentAt: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  activatedAt: string | null;
  cancelledAt: string | null;
  lastPaymentAt: string | null;
  canPublish: boolean;
  recurringNotice: string;
  provider: string;
}

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** DTO seguro: nunca expone tokens, ids de pago ni payloads del proveedor. */
export function toSubscriptionDTO(
  sub: any,
  businessId: string,
  now: Date = new Date(),
): SubscriptionDTO {
  const effective = effectiveSubscriptionStatus(sub as SubscriptionLike, now);
  return {
    id: sub?.id ?? null,
    businessId,
    status: String(sub?.status || 'NONE'),
    effectiveStatus: effective,
    message: subscriptionStatusMessage(sub as SubscriptionLike, now),
    amount: Number(sub?.amount ?? 0),
    currency: String(sub?.currency || 'CLP'),
    frequency: Number(sub?.frequency ?? 1),
    frequencyType: String(sub?.frequencyType || 'MONTH'),
    plan: sub?.plan ? { code: sub.plan.code, name: sub.plan.name, features: sub.plan.features || [] } : null,
    currentPeriodStart: iso(sub?.currentPeriodStart),
    currentPeriodEnd: iso(sub?.currentPeriodEnd),
    nextPaymentAt: iso(sub?.nextPaymentAt),
    graceUntil: iso(sub?.graceUntil),
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    activatedAt: iso(sub?.activatedAt),
    cancelledAt: iso(sub?.cancelledAt),
    lastPaymentAt: iso(sub?.lastPaymentAt),
    canPublish: subscriptionAllowsPublishing(sub as SubscriptionLike, now),
    recurringNotice: RECURRING_CHARGE_NOTICE,
    provider: String(sub?.provider || 'MERCADOPAGO'),
  };
}

export interface CheckoutResult {
  initPoint: string;
  subscriptionId: string | null;
  providerSubscriptionId: string | null;
  status: string;
  amount: number;
  currency: string;
  recurringNotice: string;
}

/**
 * Crea (o reutiliza) la suscripcion en Mercado Pago y devuelve el init_point.
 * Idempotente por negocio: si ya existe una suscripcion utilizable, se
 * reutiliza en lugar de crear otra (nunca duplica suscripciones).
 */
export async function createSubscriptionCheckout(params: {
  businessId: string;
  businessName: string;
  payerEmail: string;
  client?: PreapprovalClientLike;
}): Promise<CheckoutResult> {
  const plan = await getOrCreateDefaultPlan();
  const existing = await getSubscriptionForBusiness(params.businessId);
  const reusable = existing && existing.providerSubscriptionId
    && ['PENDING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'].includes(String(existing.status));
  if (reusable) {
    return {
      initPoint: '',
      subscriptionId: existing!.id,
      providerSubscriptionId: existing!.providerSubscriptionId,
      status: existing!.status,
      amount: Number(existing!.amount),
      currency: existing!.currency,
      recurringNotice: RECURRING_CHARGE_NOTICE,
    };
  }

  const client = params.client ?? platformPreapprovalClient();
  const base = businessPublicBaseUrl();
  const backUrl = `${base}/negocio/suscripcion/resultado?businessId=${encodeURIComponent(params.businessId)}`;

  const created: any = await client.create({
    body: {
      reason: `YesYes Business - ${params.businessName}`.slice(0, 120),
      external_reference: params.businessId,
      payer_email: params.payerEmail,
      back_url: backUrl,
      status: 'pending',
      notification_url: businessWebhookUrl(),
      auto_recurring: {
        frequency: plan.frequency,
        frequency_type: plan.frequencyType === 'YEAR' ? 'years' : 'months',
        transaction_amount: Number(plan.amount),
        currency_id: plan.currency,
      },
    },
  });

  const providerSubscriptionId = created?.id ? String(created.id) : null;
  const status = mapProviderPreapprovalStatus(created?.status);

  const subscription = await prisma.businessSubscription.upsert({
    where: { businessId: params.businessId },
    update: {
      planId: plan.id,
      providerSubscriptionId,
      providerPlanId: created?.preapproval_plan_id ? String(created.preapproval_plan_id) : null,
      status,
      amount: Number(plan.amount),
      currency: plan.currency,
      frequency: plan.frequency,
      frequencyType: plan.frequencyType,
      lastEventAt: new Date(),
    },
    create: {
      businessId: params.businessId,
      planId: plan.id,
      provider: 'MERCADOPAGO',
      providerSubscriptionId,
      providerPlanId: created?.preapproval_plan_id ? String(created.preapproval_plan_id) : null,
      status,
      amount: Number(plan.amount),
      currency: plan.currency,
      frequency: plan.frequency,
      frequencyType: plan.frequencyType,
      lastEventAt: new Date(),
    },
  });

  return {
    initPoint: String(created?.init_point || created?.sandbox_init_point || ''),
    subscriptionId: subscription.id,
    providerSubscriptionId,
    status: subscription.status,
    amount: Number(subscription.amount),
    currency: subscription.currency,
    recurringNotice: RECURRING_CHARGE_NOTICE,
  };
}


/**
 * Registra un evento del proveedor de forma IDEMPOTENTE.
 * Devuelve `duplicate: true` cuando el evento ya habia sido procesado: quien
 * llama NO debe volver a aplicar efectos (ni publicar, ni duplicar pagos).
 */
export async function recordPaymentEvent(params: {
  businessId: string;
  subscriptionId?: string | null;
  providerEventId: string;
  eventType: string;
  status: string;
  amount?: number | null;
  currency?: string | null;
  payload?: unknown;
  provider?: string;
}): Promise<{ id: string; duplicate: boolean }> {
  const provider = params.provider || 'MERCADOPAGO';
  const existing = await prisma.businessPaymentEvent.findUnique({
    where: { provider_providerEventId: { provider, providerEventId: params.providerEventId } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, duplicate: true };

  try {
    const created = await prisma.businessPaymentEvent.create({
      data: {
        businessId: params.businessId,
        subscriptionId: params.subscriptionId ?? null,
        provider,
        providerEventId: params.providerEventId,
        eventType: params.eventType,
        status: params.status,
        amount: params.amount ?? null,
        currency: params.currency ?? null,
        payload: (params.payload as any) ?? undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { id: created.id, duplicate: false };
  } catch (error: any) {
    // Carrera entre dos webhooks identicos: la unique constraint gana.
    if (error?.code === 'P2002') {
      const again = await prisma.businessPaymentEvent.findUnique({
        where: { provider_providerEventId: { provider, providerEventId: params.providerEventId } },
        select: { id: true },
      });
      return { id: again?.id || '', duplicate: true };
    }
    throw error;
  }
}

export interface ApplyStateParams {
  businessId: string;
  status: string;
  providerSubscriptionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  frequency?: number | null;
  frequencyType?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  nextPaymentAt?: Date | null;
  paid?: boolean;
  now?: Date;
}

/**
 * Aplica un estado verificado a la suscripcion. Nunca publica ni borra nada:
 * solo mueve el estado de pago y sus fechas. Toda transicion es idempotente
 * (aplicar el mismo estado dos veces deja la fila igual).
 */
export async function applySubscriptionState(params: ApplyStateParams) {
  const now = params.now ?? new Date();
  const current = await getSubscriptionForBusiness(params.businessId);
  const plan = current?.plan || (await getOrCreateDefaultPlan());

  const frequency = params.frequency ?? current?.frequency ?? plan.frequency;
  const frequencyType = params.frequencyType ?? current?.frequencyType ?? plan.frequencyType;
  const amount = params.amount ?? current?.amount ?? Number(plan.amount);
  const currency = params.currency ?? current?.currency ?? plan.currency;

  const status = params.status as any;
  const start = params.periodStart ?? current?.currentPeriodStart ?? (status === 'ACTIVE' ? now : null);
  const end = params.periodEnd
    ?? (start ? computePeriod(new Date(start), frequency, String(frequencyType)).end : null);
  const nextPaymentAt = params.nextPaymentAt ?? end;
  const graceUntil = status === 'PAST_DUE' ? graceUntilFrom(end ? new Date(end) : now, graceDays()) : null;

  const data: Record<string, unknown> = {
    planId: plan.id,
    status,
    amount,
    currency,
    frequency,
    frequencyType,
    currentPeriodStart: start ? new Date(start) : null,
    currentPeriodEnd: end ? new Date(end) : null,
    nextPaymentAt: nextPaymentAt ? new Date(nextPaymentAt) : null,
    graceUntil,
    lastEventAt: now,
    ...(params.providerSubscriptionId ? { providerSubscriptionId: params.providerSubscriptionId } : {}),
    ...(status === 'ACTIVE'
      ? { activatedAt: current?.activatedAt ?? now, cancelAtPeriodEnd: false, cancelledAt: null }
      : {}),
    ...(params.paid && status === 'ACTIVE' ? { lastPaymentAt: now } : {}),
    ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
  };

  return prisma.businessSubscription.upsert({
    where: { businessId: params.businessId },
    update: data as any,
    create: {
      businessId: params.businessId,
      planId: plan.id,
      provider: 'MERCADOPAGO',
      providerSubscriptionId: params.providerSubscriptionId ?? null,
      ...(data as any),
    },
  });
}

/**
 * Procesa una notificacion del proveedor: consulta el recurso real (nunca
 * confia en el status del payload), registra el evento con idempotencia y
 * aplica el estado. NO publica ni pausa: esa decision es del servicio de
 * publicacion, para mantener una sola fuente de verdad de negocio.
 */
export async function processProviderNotification(params: {
  type: string;
  dataId: string;
  payload?: unknown;
  preapprovalClient?: PreapprovalClientLike;
  paymentClient?: PaymentClientLike;
}): Promise<{ handled: boolean; duplicate: boolean; businessId?: string; status?: string }> {
  const type = String(params.type || '');
  const isPreapproval =
    type === 'subscription_preapproval' || type === 'preapproval' || type === 'subscription_authorized';
  const isPayment = type === 'payment' || type === 'subscription_authorized_payment';
  if (!isPreapproval && !isPayment) return { handled: false, duplicate: false };
  if (!params.dataId) return { handled: false, duplicate: false };

  const providerEventId = `${type}:${params.dataId}`;

  if (isPreapproval) {
    const client = params.preapprovalClient ?? platformPreapprovalClient();
    const resource: any = await client.get({ id: String(params.dataId) });
    const external = String(resource?.external_reference || '');
    const target = external
      ? { businessId: external, subscription: await getSubscriptionForBusiness(external) }
      : await findSubscriptionByProviderId(String(params.dataId));
    if (!target?.businessId) return { handled: false, duplicate: false };

    const evt = await recordPaymentEvent({
      businessId: target.businessId,
      subscriptionId: target.subscription?.id ?? null,
      providerEventId,
      eventType: type,
      status: String(resource?.status || 'unknown'),
      amount: Number(resource?.auto_recurring?.transaction_amount) || null,
      currency: resource?.auto_recurring?.currency_id || null,
      payload: params.payload,
    });
    if (evt.duplicate) {
      return { handled: true, duplicate: true, businessId: target.businessId, status: target.subscription?.status };
    }

    const status = mapProviderPreapprovalStatus(resource?.status);
    const sub = await applySubscriptionState({
      businessId: target.businessId,
      status,
      providerSubscriptionId: String(params.dataId),
      amount: Number(resource?.auto_recurring?.transaction_amount) || undefined,
      currency: resource?.auto_recurring?.currency_id || undefined,
      periodStart: status === 'ACTIVE' ? new Date() : null,
    });
    return { handled: true, duplicate: false, businessId: target.businessId, status: sub.status };
  }

  const paymentClient = params.paymentClient ?? platformPaymentClient();
  const payment: any = await paymentClient.get({ id: String(params.dataId) });
  const external = String(payment?.external_reference || '');
  const preapprovalId = String(payment?.metadata?.preapproval_id || payment?.preapproval_id || '');
  const target = external
    ? { businessId: external, subscription: await getSubscriptionForBusiness(external) }
    : await findSubscriptionByProviderId(preapprovalId);
  if (!target?.businessId) return { handled: false, duplicate: false };

  const evt = await recordPaymentEvent({
    businessId: target.businessId,
    subscriptionId: target.subscription?.id ?? null,
    providerEventId,
    eventType: type,
    status: String(payment?.status || 'unknown'),
    amount: Number(payment?.transaction_amount) || null,
    currency: payment?.currency_id || null,
    payload: params.payload,
  });
  if (evt.duplicate) {
    return { handled: true, duplicate: true, businessId: target.businessId, status: target.subscription?.status };
  }

  const status = mapProviderPaymentStatus(payment?.status);
  const sub = await applySubscriptionState({
    businessId: target.businessId,
    status,
    providerSubscriptionId: preapprovalId || undefined,
    paid: String(payment?.status) === 'approved',
    periodStart: status === 'ACTIVE' ? new Date() : null,
  });
  return { handled: true, duplicate: false, businessId: target.businessId, status: sub.status };
}

async function findSubscriptionByProviderId(providerSubscriptionId: string) {
  if (!providerSubscriptionId) return null;
  const sub = await prisma.businessSubscription.findFirst({
    where: { providerSubscriptionId: String(providerSubscriptionId) },
    select: { id: true, businessId: true, status: true },
  });
  return sub ? { businessId: sub.businessId, subscription: sub } : null;
}


/**
 * Reconciliacion manual (ADMIN): consulta Mercado Pago y aplica el estado real.
 * Es el mecanismo para no depender exclusivamente de los webhooks.
 */
export async function syncSubscriptionFromProvider(
  businessId: string,
  client?: PreapprovalClientLike,
) {
  const current = await getSubscriptionForBusiness(businessId);
  if (!current?.providerSubscriptionId) {
    return { synced: false as const, reason: 'NO_PROVIDER_SUBSCRIPTION', subscription: current };
  }
  const preapproval = client ?? platformPreapprovalClient();
  const resource: any = await preapproval.get({ id: current.providerSubscriptionId });

  await recordPaymentEvent({
    businessId,
    subscriptionId: current.id,
    providerEventId: `manual_sync:${current.providerSubscriptionId}:${Date.now()}`,
    eventType: 'manual_sync',
    status: String(resource?.status || 'unknown'),
    payload: { id: resource?.id, status: resource?.status },
  });

  const subscription = await applySubscriptionState({
    businessId,
    status: mapProviderPreapprovalStatus(resource?.status),
    providerSubscriptionId: current.providerSubscriptionId,
  });
  return { synced: true as const, subscription };
}

/** Cancela la suscripcion en el proveedor y localmente (NUNCA borra el negocio). */
export async function cancelSubscription(businessId: string, client?: PreapprovalClientLike) {
  const current = await getSubscriptionForBusiness(businessId);
  if (!current) return { cancelled: false as const, reason: 'NO_SUBSCRIPTION', subscription: null };

  if (current.providerSubscriptionId) {
    try {
      const preapproval = client ?? platformPreapprovalClient();
      await preapproval.update({ id: current.providerSubscriptionId, body: { status: 'cancelled' } });
    } catch (error: any) {
      // Si MP no responde, la cancelacion local igual se aplica: el usuario
      // pidio cancelar, el contenido se conserva y el webhook reconciliara.
      console.warn('[business-subscription] no se pudo cancelar en el proveedor:', error?.message);
    }
  }

  const subscription = await applySubscriptionState({
    businessId,
    status: 'CANCELLED',
    providerSubscriptionId: current.providerSubscriptionId,
  });
  return { cancelled: true as const, subscription };
}

/** Reactiva una suscripcion pausada/cancelada reutilizando la MISMA fila. */
export async function reactivateSubscription(businessId: string, client?: PreapprovalClientLike) {
  const current = await getSubscriptionForBusiness(businessId);
  if (!current) return { reactivated: false as const, reason: 'NO_SUBSCRIPTION', subscription: null };

  if (current.providerSubscriptionId) {
    try {
      const preapproval = client ?? platformPreapprovalClient();
      await preapproval.update({ id: current.providerSubscriptionId, body: { status: 'authorized' } });
    } catch (error: any) {
      console.warn('[business-subscription] no se pudo reactivar en el proveedor:', error?.message);
      const err = new Error(
        'No se pudo reactivar la suscripción en Mercado Pago. Intenta nuevamente o contacta a soporte.',
      );
      (err as any).status = 502;
      throw err;
    }
  }

  const subscription = await applySubscriptionState({
    businessId,
    status: 'ACTIVE',
    providerSubscriptionId: current.providerSubscriptionId,
    periodStart: new Date(),
  });
  return { reactivated: true as const, subscription };
}

/**
 * Activacion manual por ADMIN (pago recibido fuera de Mercado Pago o
 * reconciliacion). Queda auditada como evento MANUAL_ACTIVATION: permite
 * publicar sin permitir NUNCA publicar sin un pago registrado.
 */
export async function activateSubscriptionManually(params: {
  businessId: string;
  adminId: string;
  note?: string;
}) {
  const subscription = await applySubscriptionState({
    businessId: params.businessId,
    status: 'ACTIVE',
    periodStart: new Date(),
    paid: true,
  });
  await recordPaymentEvent({
    businessId: params.businessId,
    subscriptionId: subscription.id,
    providerEventId: `manual:${params.businessId}:${Date.now()}`,
    eventType: 'MANUAL_ACTIVATION',
    status: 'ACTIVE',
    amount: Number(subscription.amount),
    currency: subscription.currency,
    payload: { adminId: params.adminId, note: params.note || null },
  });
  return subscription;
}