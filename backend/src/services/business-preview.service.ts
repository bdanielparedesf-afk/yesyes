import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { logBusinessAudit } from './business-audit.service';

/**
 * YESYES BUSINESS — Vista previa privada.
 *
 * Un DRAFT/PREVIEW/PAYMENT_PENDING NUNCA es visible agregando `?preview=1`.
 * La preview requiere:
 *   - ser el OWNER del negocio o ADMIN (endpoint autenticado), o
 *   - un token temporal, aleatorio, expirable y revocable (este servicio).
 *
 * El token en claro se devuelve UNA sola vez y NUNCA se guarda ni se loguea:
 * en la base de datos solo vive su hash SHA-256.
 */

export const PREVIEW_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function hashPreviewToken(token: string): string {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function generatePreviewToken(): string {
  return randomBytes(32).toString('hex');
}

export interface PreviewTokenCheck {
  valid: boolean;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED';
  businessId?: string;
}

/** Valida un token contra la base (sin filtrar el motivo al cliente). */
export async function validatePreviewToken(token: string, now: Date = new Date()): Promise<PreviewTokenCheck> {
  if (!token || typeof token !== 'string' || token.length < 32 || token.length > 256) {
    return { valid: false, reason: 'NOT_FOUND' };
  }
  const record = await prisma.businessPreviewToken.findUnique({
    where: { tokenHash: hashPreviewToken(token) },
    select: { businessId: true, expiresAt: true, revokedAt: true },
  });
  if (!record) return { valid: false, reason: 'NOT_FOUND' };
  if (record.revokedAt) return { valid: false, reason: 'REVOKED' };
  if (record.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: 'EXPIRED' };
  return { valid: true, businessId: record.businessId };
}

/** Crea un token nuevo. Revoca los anteriores para que exista uno solo vigente. */
export async function createPreviewToken(params: {
  businessId: string;
  createdBy?: string | null;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const ttl = Number.isFinite(Number(params.ttlMs)) && Number(params.ttlMs) > 0
    ? Number(params.ttlMs)
    : PREVIEW_TOKEN_TTL_MS;

  await prisma.businessPreviewToken.updateMany({
    where: { businessId: params.businessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = generatePreviewToken();
  const expiresAt = new Date(Date.now() + ttl);
  await prisma.businessPreviewToken.create({
    data: {
      businessId: params.businessId,
      tokenHash: hashPreviewToken(token),
      createdBy: params.createdBy || null,
      expiresAt,
    },
  });

  await logBusinessAudit('BUSINESS_PREVIEW_TOKEN_CREATED', {
    businessId: params.businessId,
    userId: params.createdBy || null,
    metadata: { expiresAt: expiresAt.toISOString() },
  });

  return { token, expiresAt };
}

export async function revokePreviewTokens(businessId: string): Promise<number> {
  const result = await prisma.businessPreviewToken.updateMany({
    where: { businessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** URL de preview lista para compartir con el cliente. */
export function previewUrl(slug: string, token: string): string {
  return `/mi-negocio/${slug}?preview=${encodeURIComponent(token)}`;
}
