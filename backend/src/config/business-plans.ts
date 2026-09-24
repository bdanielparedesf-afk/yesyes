/**
 * YESYES BUSINESS — Definicion central de planes.
 *
 * El precio y el copy del plan viven AQUI (y se persisten en `business_plans`
 * via seed). Ningun otro archivo debe hardcodear el monto: la pagina de pago,
 * el checkout y el webhook leen SIEMPRE el plan desde la base de datos.
 *
 * Para agregar BUSINESS_PRO / BUSINESS_PREMIUM basta con sumar un objeto a
 * BUSINESS_PLAN_SEEDS: el codigo no asume un unico plan.
 */

export const DEFAULT_PLAN_CODE = 'BUSINESS_BASIC';

export interface BusinessPlanSeed {
  code: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: 'MONTH' | 'YEAR';
  features: string[];
  trialDays: number;
  active: boolean;
  order: number;
}

/** Beneficios reales de la plataforma (no se promete lo que no existe). */
export const BUSINESS_PLAN_FEATURES: string[] = [
  'Plantilla profesional para tu rubro',
  'Página pública en yesyes.cl/mi-negocio',
  'Hosting dentro de YesYes',
  'Edición completa desde tu panel',
  'Servicios, productos o propiedades según tu rubro',
  'Contacto, WhatsApp y mapa',
  'SEO básico (título, descripción, imagen)',
  'Estadísticas de visitas y contactos',
];

export const BUSINESS_PLAN_SEEDS: BusinessPlanSeed[] = [
  {
    code: DEFAULT_PLAN_CODE,
    name: 'YesYes Business',
    description: 'Página web profesional con panel de administración para tu negocio.',
    amount: 11990,
    currency: 'CLP',
    frequency: 1,
    frequencyType: 'MONTH',
    features: BUSINESS_PLAN_FEATURES,
    trialDays: 0,
    active: true,
    order: 1,
  },
];

/** Copy obligatorio exigido por Mercado Pago para cobros recurrentes. */
export const RECURRING_CHARGE_NOTICE =
  'El cobro recurrente será procesado por Mercado Pago. Puedes cancelar la suscripción desde tu panel.';
