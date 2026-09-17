import { createHmac } from 'node:crypto';
import axios from 'axios';
import { z } from 'zod';
import { AliExpressOAuthError } from './oauth-client';

// Official AliExpress docs 120687/120689/120691/120692 and SDK AuthTokenRefreshRequest.
export const REFRESH_ENDPOINT = 'https://api-sg.aliexpress.com/rest/auth/token/refresh';
export function buildRefreshRequest(config: { appKey: string; appSecret: string }, refreshToken: string, timestamp: number) {
  if (!/^\d+$/.test(config.appKey) || !config.appSecret?.trim() || !refreshToken?.trim()
    || refreshToken.length > 16384 || /[\u0000-\u001f\u007f]/.test(refreshToken)
    || !Number.isSafeInteger(timestamp) || timestamp <= 0) throw new AliExpressOAuthError('OAUTH_CONFIGURATION_ERROR');
  const params: Record<string, string> = { app_key: config.appKey, refresh_token: refreshToken,
    timestamp: String(timestamp), sign_method: 'sha256' };
  const canonical = '/auth/token/refresh' + Object.keys(params).sort().map(k => k + params[k]).join('');
  const sign = createHmac('sha256', config.appSecret).update(canonical, 'utf8').digest('hex').toUpperCase();
  return { url: REFRESH_ENDPOINT, body: new URLSearchParams({ ...params, sign }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
}
export type RefreshTransport = (request: ReturnType<typeof buildRefreshRequest>) => Promise<unknown>;
const integer = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const duration = integer.pipe(z.number().max(315360000));
const token = z.string().min(1).max(16384).refine(s => Boolean(s.trim()));
const responseSchema = z.object({
  code: z.union([z.literal('0'), z.literal(0)]), access_token: token, refresh_token: token,
  expires_in: duration, refresh_expires_in: duration,
  expire_time: integer.optional(), refresh_token_valid_time: integer.optional(),
  account: z.string().trim().min(1).max(320).optional(), seller_id: z.string().min(1).max(128).optional(),
});

/** Durations are documented seconds. SDK absolute fields lack unit annotations:
 * accept only the UNIQUE seconds/ms interpretation consistent with that duration.
 * No magnitude heuristic, invented unit, or silent fallback for malformed absolute dates.
 */
function expiration(absolute: number | undefined, seconds: number, receivedAt: number): Date {
  const relative = receivedAt + seconds * 1000;
  if (absolute === undefined) return new Date(relative);
  const candidates = [absolute, absolute * 1000].filter(n => Number.isSafeInteger(n)
    && Number.isFinite(new Date(n).getTime()) && Math.abs(n - relative) <= 60000);
  if (candidates.length !== 1) throw new AliExpressOAuthError('OAUTH_CONTRACT_ERROR');
  return new Date(candidates[0]!);
}
export function parseRefreshResponse(raw: unknown, receivedAt: Date, identity: { account: string; sellerId: string | null }) {
  const result = responseSchema.safeParse(raw);
  if (!result.success || !Number.isFinite(receivedAt.getTime())) throw new AliExpressOAuthError('OAUTH_CONTRACT_ERROR');
  const d = result.data;
  if ((d.account && d.account !== identity.account) || (d.seller_id && identity.sellerId && d.seller_id !== identity.sellerId)
    || d.expires_in === 0) throw new AliExpressOAuthError('OAUTH_CONTRACT_ERROR');
  const expiresAt = expiration(d.expire_time, d.expires_in, receivedAt.getTime());
  const refreshExpiresAt = expiration(d.refresh_token_valid_time, d.refresh_expires_in, receivedAt.getTime());
  if (expiresAt.getTime() <= receivedAt.getTime() + 60000) throw new AliExpressOAuthError('OAUTH_CONTRACT_ERROR');
  return { account: identity.account, sellerId: d.seller_id || identity.sellerId,
    accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt,
    refreshExpiresAt: d.refresh_expires_in === 0 ? receivedAt : refreshExpiresAt };
}
const transport: RefreshTransport = async request => {
  try {
    const response = await axios.post<unknown>(request.url, request.body, {
      headers: request.headers, timeout: 15000, maxRedirects: 0, proxy: false,
      maxContentLength: 65536, maxBodyLength: 65536,
    });
    return response.data;
  } catch (error) {
    throw new AliExpressOAuthError(axios.isAxiosError(error) && error.response
      ? 'TOKEN_REFRESH_FAILED' : 'OAUTH_NETWORK_ERROR');
  }
};
export async function exchangeRefreshToken(refreshToken: string, config: { appKey: string; appSecret: string },
  identity: { account: string; sellerId: string | null }, send: RefreshTransport = transport,
  now: () => Date = () => new Date()) {
  const request = buildRefreshRequest(config, refreshToken, now().getTime());
  let raw: unknown;
  try { raw = await send(request); } catch (e) {
    if (e instanceof AliExpressOAuthError) throw e;
    throw new AliExpressOAuthError('OAUTH_NETWORK_ERROR');
  }
  if (raw && typeof raw === 'object' && 'code' in raw && raw.code !== 0 && raw.code !== '0') {
    throw new AliExpressOAuthError('TOKEN_REFRESH_FAILED');
  }
  return parseRefreshResponse(raw, now(), identity);
}
