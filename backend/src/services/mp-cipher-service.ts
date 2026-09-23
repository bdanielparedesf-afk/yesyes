import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

/**
 * Deriva la clave de cifrado a partir de la variable de entorno.
 * Requiere exactamente 64 caracteres hex (32 bytes = 256 bits para AES-256-GCM).
 */
export function mpEncryptionKey(value: string | undefined): Buffer {
  if (!value || !/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('MERCADOPAGO_TOKEN_ENCRYPTION_KEY debe ser 64 caracteres hex (32 bytes).');
  }
  return Buffer.from(value, 'hex');
}

/**
 * Cifra un secreto usando AES-256-GCM con autenticación.
 * Formato: mp1:iv:authenTag:ciphertext (hex)
 */
export function encryptSecret(
  value: string,
  key: Buffer,
  businessId: string,
  field: 'access' | 'refresh',
): string {
  try {
    const iv = randomBytes(12); // 96 bits para GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    // AAD (Additional Authenticated Data) para bind del contexto
    const aad = Buffer.from(
      JSON.stringify(['yesyes', 'mercadopago', businessId, field]),
      'utf8',
    );
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      'mp1',
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  } catch (err) {
    throw new Error(`Error cifrando secreto: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

/**
 * Descifra un secreto previamente cifrado.
 * Lanza si el formato, el IV, el tag o el AAD no son válidos.
 */
export function decryptSecret(
  envelope: string,
  key: Buffer,
  businessId: string,
  field: 'access' | 'refresh',
): string {
  try {
    if (!envelope || !/^mp1:[a-f\d]{24}:[a-f\d]{32}:[a-f\d]+$/i.test(envelope)) {
      throw new Error('Envelope de cifrado inválido');
    }

    const parts = envelope.split(':');
    if (parts.length !== 4) {
      throw new Error('Envelope de cifrado inválido');
    }

    const [, ivHex, tagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(tagHex!, 'hex');
    const ciphertext = Buffer.from(ciphertextHex!, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);

    const aad = Buffer.from(
      JSON.stringify(['yesyes', 'mercadopago', businessId, field]),
      'utf8',
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error(`Error descifrando secreto: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}