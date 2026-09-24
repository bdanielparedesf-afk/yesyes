import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * YESYES BUSINESS — Auditoria de acciones de negocio.
 *
 * Reutiliza el modelo existente `AuditLog` (no se crea un sistema paralelo).
 * Es best-effort: si la auditoria falla, la accion del usuario no se rompe
 * (se registra un warning). NUNCA guarda tokens ni credenciales.
 */
export const BUSINESS_AUDIT_ACTIONS = [
  'BUSINESS_CREATED',
  'BUSINESS_UPDATED',
  'BUSINESS_PUBLISHED',
  'BUSINESS_PAUSED',
  'BUSINESS_ARCHIVED',
  'BUSINESS_RESTORED',
  'BUSINESS_TEMPLATE_CHANGED',
  'BUSINESS_CAPABILITIES_UPDATED',
  'BUSINESS_OWNER_CHANGED',
  'BUSINESS_PREVIEW_TOKEN_CREATED',
  'BUSINESS_SUBSCRIPTION_CREATED',
  'BUSINESS_SUBSCRIPTION_CANCELLED',
  'BUSINESS_SUBSCRIPTION_REACTIVATED',
  'BUSINESS_SUBSCRIPTION_SYNCED',
  'BUSINESS_PAYMENT_CONFIRMED',
  'BUSINESS_PAYMENT_FAILED',
  'BUSINESS_PAYMENT_MANUAL_ACTIVATION',
] as const;

export type BusinessAuditAction = (typeof BUSINESS_AUDIT_ACTIONS)[number];

export async function logBusinessAudit(
  action: BusinessAuditAction,
  params: {
    businessId: string;
    userId?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action,
        entity: 'Business',
        entityId: params.businessId,
        ip: params.ip || null,
        metadata: (params.metadata as any) ?? undefined,
      },
    });
  } catch (error: any) {
    logger.warn(`[business-audit] no se pudo registrar ${action}: ${error?.message}`);
  }
}
