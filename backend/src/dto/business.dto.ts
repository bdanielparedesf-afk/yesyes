/**
 * YESYES BUSINESS — Contratos de datos (DTOs).
 *
 * Existen TRES contratos separados a proposito:
 *   - PublicBusinessDTO   → lo que ve cualquier visitante (sin ownerId, sin
 *     suscripcion, sin datos internos, sin leads);
 *   - BusinessDashboardDTO→ lo que ve el owner de su propio negocio;
 *   - BusinessAdminDTO    → lo que ve ADMIN (incluye owner y suscripcion).
 *
 * Nunca se devuelve el objeto Prisma completo al cliente.
 */

const PUBLIC_TEMPLATE_SELECT = {
  code: true,
  name: true,
  category: true,
  capabilities: true,
} as const;

/** Campos publicos de un negocio publicable. */
export const PUBLIC_BUSINESS_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
  status: true,
  logo: true,
  cover: true,
  description: true,
  phone: true,
  whatsapp: true,
  email: true,
  address: true,
  city: true,
  region: true,
  mapsUrl: true,
  lat: true,
  lng: true,
  hours: true,
  socials: true,
  cta: true,
  visual: true,
  seoTitle: true,
  seoDescription: true,
  ogImage: true,
  canonical: true,
  templateId: true,
  publishedAt: true,
  template: { select: PUBLIC_TEMPLATE_SELECT },
} as const;

/** Nunca puede salir por una respuesta publica. */
export const PRIVATE_BUSINESS_FIELDS = [
  'ownerId',
  'settings',
  'subscription',
  'paymentEvents',
  'previewTokens',
  'leads',
  'mercadoPago',
  'orders',
] as const;

export function toPublicBusinessDTO(business: any): any {
  if (!business) return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(PUBLIC_BUSINESS_SELECT)) {
    if (key === 'template') continue;
    out[key] = business[key];
  }
  out.template = business.template
    ? {
        code: business.template.code,
        name: business.template.name,
        category: business.template.category,
        capabilities: business.template.capabilities || [],
      }
    : null;
  return out;
}

/** Plantilla sin configuracion interna (no se expone `config`). */
export function toBusinessTemplateDTO(template: any): any {
  if (!template) return null;
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    description: template.description ?? null,
    category: template.category,
    version: template.version,
    previewUrl: template.previewUrl ?? null,
    previewImage: template.previewImage ?? null,
    capabilities: template.capabilities || [],
    active: template.active,
  };
}

/** Panel del owner: su negocio completo menos datos de otros/plataforma. */
export function toDashboardBusinessDTO(business: any): any {
  if (!business) return null;
  const { settings, previewTokens, paymentEvents, subscription, owner, ...rest } = business as any;
  const settingsObject = settings && typeof settings === 'object' ? settings : {};
  return {
    ...rest,
    capabilities: Array.isArray(settingsObject.capabilities) ? settingsObject.capabilities : [],
    sections: Array.isArray(settingsObject.sections) ? settingsObject.sections : [],
    delivery: settingsObject.delivery ?? null,
    template: business.template ? toBusinessTemplateDTO(business.template) : null,
  };
}

/** ADMIN: incluye dueño, suscripcion y estado de pago (nunca tokens). */
export function toAdminBusinessDTO(business: any, subscription?: any): any {
  if (!business) return null;
  const { settings, previewTokens, mercadoPago, owner, ...rest } = business as any;
  const settingsObject = settings && typeof settings === 'object' ? settings : {};
  return {
    ...rest,
    capabilities: Array.isArray(settingsObject.capabilities) ? settingsObject.capabilities : [],
    sections: Array.isArray(settingsObject.sections) ? settingsObject.sections : [],
    delivery: settingsObject.delivery ?? null,
    template: business.template ? toBusinessTemplateDTO(business.template) : null,
    owner: owner
      ? { id: owner.id, email: owner.email, name: owner.name, lastName: owner.lastName }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          effectiveStatus: subscription.effectiveStatus,
          amount: subscription.amount,
          currency: subscription.currency,
          frequency: subscription.frequency,
          frequencyType: subscription.frequencyType,
          plan: subscription.plan,
          nextPaymentAt: subscription.nextPaymentAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
          graceUntil: subscription.graceUntil,
          activatedAt: subscription.activatedAt,
          cancelledAt: subscription.cancelledAt,
          lastPaymentAt: subscription.lastPaymentAt,
        }
      : null,
  };
}

/** Solo estas claves llegaron/importan del body publico de un lead. */
export function toPublicLeadDTO(lead: any): any {
  if (!lead) return null;
  return {
    id: lead.id,
    type: lead.type,
    status: lead.status,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    message: lead.message,
    createdAt: lead.createdAt,
  };
}
