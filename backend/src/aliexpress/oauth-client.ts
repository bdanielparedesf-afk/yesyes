import axios from 'axios';
import { z } from 'zod';
import { buildTokenCreateRequest } from './oauth-request';

export class AliExpressOAuthError extends Error {
  constructor(public readonly reason: 'CONFIGURATION' | 'REJECTED' | 'TIMEOUT' | 'TRANSPORT' | 'CONTRACT' | 'STORAGE') {
    super({ CONFIGURATION: 'Falta configuración OAuth en backend.', REJECTED: 'AliExpress rechazó la autorización.',
      TIMEOUT: 'El canje agotó el tiempo de espera; no se reintentó el código.',
      TRANSPORT: 'No fue posible completar el canje; no se reintentó el código.',
      CONTRACT: 'La respuesta OAuth no cumple el contrato documentado.',
      STORAGE: 'No fue posible guardar la autorización de forma segura.' }[reason]);
    this.name = 'AliExpressOAuthError';
  }
}

const seconds = z.union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number).pipe(z.number().int().nonnegative().max(315360000));
const tokenResponse = z.object({
  code: z.union([z.literal('0'), z.literal(0)]),
  account: z.string().trim().min(1).max(320),
  seller_id: z.string().max(128).optional(),
  access_token: z.string().min(1).max(16384),
  refresh_token: z.string().max(16384).optional(),
  expires_in: seconds,
  refresh_expires_in: seconds,
});

/** Official generateToken response: https://openservice.aliexpress.com/doc/api.htm
 * Expirations are calculated from request start (conservative), never hardcoded.
 * No raw response, Zod issue or Axios error may escape into logs or HTTP errors.
 */
export function parseTokenResponse(raw: unknown, requestedAt: Date) {
  const parsed = tokenResponse.safeParse(raw);
  if (!parsed.success || !Number.isFinite(requestedAt.getTime())) throw new AliExpressOAuthError('CONTRACT');
  const data = parsed.data;
  if (data.expires_in <= 0 || (data.refresh_expires_in > 0 && !data.refresh_token)) {
    throw new AliExpressOAuthError('CONTRACT');
  }
  return {
    account: data.account, sellerId: data.seller_id || null,
    accessToken: data.access_token, refreshToken: data.refresh_token || '',
    expiresAt: new Date(requestedAt.getTime() + data.expires_in * 1000),
    refreshExpiresAt: new Date(requestedAt.getTime() + data.refresh_expires_in * 1000),
  };
}

export type TokenGrant = ReturnType<typeof parseTokenResponse>;
export type OAuthTransport = (request: ReturnType<typeof buildTokenCreateRequest>) => Promise<unknown>;

const transport: OAuthTransport = async request => {
  try {
    const response = await axios.post<unknown>(request.url, request.body, {
      headers: request.headers, timeout: 15000, maxRedirects: 0,
      maxContentLength: 65536, maxBodyLength: 32768, proxy: false,
    });
    return response.data;
  } catch (error) {
    throw new AliExpressOAuthError(axios.isAxiosError(error) && error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'TRANSPORT');
  }
};

/** Single attempt only: automatic retries may consume a one-use authorization code. */
export async function exchangeAuthorizationCode(
  code: string,
  config: { appKey: string; appSecret: string },
  send: OAuthTransport = transport,
  now: () => Date = () => new Date(),
): Promise<TokenGrant> {
  if (config.appKey !== '547536' || !config.appSecret?.trim() || !code?.trim() || code.length > 4096) {
    throw new AliExpressOAuthError('CONFIGURATION');
  }
  const requestedAt = now();
  const request = buildTokenCreateRequest({ ...config, code, timestamp: requestedAt.getTime() });
  let raw: unknown;
  try { raw = await send(request); } catch (error) {
    if (error instanceof AliExpressOAuthError) throw error;
    throw new AliExpressOAuthError('TRANSPORT');
  }
  if (raw && typeof raw === 'object' && 'code' in raw && !['0', 0].includes(raw.code as string | number)) {
    throw new AliExpressOAuthError('REJECTED');
  }
  return parseTokenResponse(raw, requestedAt);
}
