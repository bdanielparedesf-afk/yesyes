import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AliExpressOAuthError } from './oauth-client';

/** Separate backend key: 32 random bytes encoded as 64 hex characters. */
export function tokenEncryptionKey(value: string | undefined): Buffer {
  if (!value || !/^[a-f\d]{64}$/i.test(value)) throw new AliExpressOAuthError('CONFIGURATION');
  return Buffer.from(value, 'hex');
}

export function encryptToken(value: string, key: Buffer, account: string, field: 'access' | 'refresh'): string {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(['yesyes', 'aliexpress', account, field]), 'utf8'));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['ae1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
  } catch { throw new AliExpressOAuthError('STORAGE'); }
}

/** No plaintext fallback: legacy rows must be explicitly migrated or reauthorized. */
export function decryptToken(envelope: string, key: Buffer, account: string, field: 'access' | 'refresh'): string {
  try {
    if (!/^ae1:[a-f\d]{24}:[a-f\d]{32}:(?:[a-f\d]{2})*$/i.test(envelope)) throw new Error();
    const [, iv, tag, ciphertext] = envelope.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv!, 'hex'));
    decipher.setAAD(Buffer.from(JSON.stringify(['yesyes', 'aliexpress', account, field]), 'utf8'));
    decipher.setAuthTag(Buffer.from(tag!, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext!, 'hex')), decipher.final()]).toString('utf8');
  } catch { throw new AliExpressOAuthError('STORAGE'); }
}
