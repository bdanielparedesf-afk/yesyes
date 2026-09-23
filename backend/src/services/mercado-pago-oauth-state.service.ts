import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { mpEncryptionKey, encryptSecret, decryptSecret } from './mp-cipher-service';

const ATTEMPT_TTL_MS = 10 * 60 * 1000;
function getEncryptionKey(): Buffer {
  return mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
}

export function generateOAuthState(): string {
  return randomBytes(32).toString('hex');
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

export function hashCodeVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('hex');
}

export async function createOAuthAttempt(
  businessId: string,
  userId: string,
  state: string,
  codeVerifier: string,
): Promise<{ state: string; codeVerifier: string }> {
  await prisma.mercadoPagoOAuthAttempt.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });

  const encryptionKey = getEncryptionKey();
  const stateHash = hashState(state);
  const codeVerifierHash = hashCodeVerifier(codeVerifier);
  const codeVerifierEncrypted = encryptSecret(codeVerifier, encryptionKey, businessId, 'access');

  await prisma.mercadoPagoOAuthAttempt.create({
    data: {
      stateHash,
      businessId,
      userId,
      codeVerifierHash,
      codeVerifierEncrypted,
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    },
  });

  return { state, codeVerifier };
}

export async function validateAndConsumeOAuthAttempt(
  state: string,
): Promise<{
  businessId: string;
  userId: string;
  codeVerifierForExchange: string;
} | null> {
  if (typeof state !== 'string' || !/^[a-f\d]{64}$/i.test(state)) return null;
  const stateHash = hashState(state);
  const encryptionKey = getEncryptionKey();

  const attempt = await prisma.mercadoPagoOAuthAttempt.findUnique({
    where: { stateHash },
  });

  if (!attempt) return null;
  if (attempt.expiresAt <= new Date()) return null;
  if (attempt.consumedAt) return null;

  let codeVerifierDecrypted: string;
  try {
    codeVerifierDecrypted = decryptSecret(
      attempt.codeVerifierEncrypted!,
      encryptionKey,
      attempt.businessId,
      'access',
    );
  } catch {
    return null;
  }

  if (!codeVerifierDecrypted) return null;

  const claimed = await prisma.mercadoPagoOAuthAttempt.updateMany({
    where: {
      stateHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  if (claimed.count !== 1) return null;

  return {
    businessId: attempt.businessId,
    userId: attempt.userId,
    codeVerifierForExchange: codeVerifierDecrypted,
  };
}

/**
 * Guarda el resultado exitoso de un intento OAuth.
 */
export async function markOAuthAttemptSuccess(
  stateHash: string,
  mpUserId: string,
): Promise<void> {
  await prisma.mercadoPagoOAuthAttempt.updateMany({
    where: { stateHash, consumedAt: null },
    data: {
      success: true,
      mpUserId,
      consumedAt: new Date(),
    },
  });
}

/**
 * Guarda el resultado fallido de un intento OAuth.
 */
export async function markOAuthAttemptError(
  stateHash: string,
  error: string,
): Promise<void> {
  await prisma.mercadoPagoOAuthAttempt.updateMany({
    where: { stateHash, consumedAt: null },
    data: {
      success: false,
      error,
      consumedAt: new Date(),
    },
  });
}