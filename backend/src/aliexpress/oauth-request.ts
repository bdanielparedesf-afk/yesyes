import { createHmac } from 'node:crypto';

/**
 * Contract supplied by the administrator: OAuth token/create uses SHA256,
 * NOT the unverified HMAC-MD5 contract of the business /sync gateway.
 * Pure helpers only: no network, environment access, logging or persistence.
 */
export const TOKEN_CREATE_ENDPOINT = 'https://api-sg.aliexpress.com/rest/auth/token/create';
const TOKEN_CREATE_PATH = '/auth/token/create';
const PARAMETER_NAMES = ['app_key', 'code', 'sign_method', 'timestamp'] as const;

export interface TokenCreateParameters {
  app_key: string;
  code: string;
  timestamp: string;
  sign_method: 'sha256';
}

export class OAuthRequestValidationError extends Error {
  constructor() {
    // Never include a supplied value, code or secret in an error.
    super('Configuración o parámetros OAuth inválidos.');
    this.name = 'OAuthRequestValidationError';
  }
}

function validateParameters(params: TokenCreateParameters): void {
  if (!params || typeof params !== 'object'
    || Object.keys(params).length !== PARAMETER_NAMES.length
    || !PARAMETER_NAMES.every(key => Object.prototype.hasOwnProperty.call(params, key))
    || typeof params.app_key !== 'string' || !/^\d+$/.test(params.app_key)
    || typeof params.code !== 'string' || !params.code.trim()
    || /[\u0000-\u001f\u007f]/.test(params.code)
    || params.sign_method !== 'sha256'
    || typeof params.timestamp !== 'string' || !/^[1-9]\d*$/.test(params.timestamp)
    || !Number.isSafeInteger(Number(params.timestamp))) {
    throw new OAuthRequestValidationError();
  }
}

/** Sign raw UTF-8 values before form encoding. The sign parameter is excluded. */
export function signTokenCreate(params: TokenCreateParameters, appSecret: string): string {
  validateParameters(params);
  if (typeof appSecret !== 'string' || !appSecret.trim()) {
    throw new OAuthRequestValidationError();
  }
  const canonical = TOKEN_CREATE_PATH
    + [...PARAMETER_NAMES].sort().map(key => key + params[key]).join('');
  return createHmac('sha256', appSecret).update(canonical, 'utf8').digest('hex').toUpperCase();
}

/**
 * Builds a form-encoded POST, without executing it. The body contains the
 * single-use authorization code and signature: keep it backend-only, never log
 * or return it to the browser. Form encoding matches the earlier probe; that
 * rejection is NOT proof of a successful exchange or the response contract.
 */
export function buildTokenCreateRequest(input: {
  appKey: string;
  appSecret: string;
  code: string;
  timestamp: number;
}): { url: string; method: 'POST'; headers: Record<string, string>; body: string } {
  if (!input || !Number.isSafeInteger(input.timestamp) || input.timestamp <= 0) {
    throw new OAuthRequestValidationError();
  }
  const params: TokenCreateParameters = {
    app_key: input.appKey,
    code: input.code,
    timestamp: String(input.timestamp),
    sign_method: 'sha256',
  };
  const sign = signTokenCreate(params, input.appSecret);
  return {
    url: TOKEN_CREATE_ENDPOINT,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, sign }).toString(),
  };
}
