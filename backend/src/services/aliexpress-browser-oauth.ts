import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { AliExpressOAuthError } from '../aliexpress/oauth-client';
import { tokenEncryptionKey } from '../aliexpress/token-crypto';
import { connectAliExpress } from './aliexpress-token.service';

export const CALLBACK_PATH = '/api/admin/aliexpress/oauth/callback';
export const AUTHORIZE_ENDPOINT = 'https://api-sg.aliexpress.com/oauth/authorize';
export const ATTEMPT_TTL = 10 * 60 * 1000;
/** Browser nonce cookie: HttpOnly, scoped to the OAuth routes, holds no credential. */
export const BROWSER_COOKIE = 'yesyes_ae_oauth';
export const COOKIE_PATH = '/api/admin/aliexpress/oauth';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function browserCookieOptions(secure: boolean) {
  // SameSite=Lax is required: AliExpress returns with a top-level GET navigation.
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: COOKIE_PATH, maxAge: ATTEMPT_TTL };
}

/** Reads only the OAuth browser nonce; never throws and never logs the header. */
export function readBrowserCookie(header?: string): string {
  if (!header) return '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== BROWSER_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    try { return decodeURIComponent(value); } catch { return value; }
  }
  return '';
}
export function oauthBrowserConfig() {
  try {
    const redirect = new URL(process.env.ALIEXPRESS_OAUTH_REDIRECT_URI || '');
    const local = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1'
      && redirect.hostname === 'localhost' && redirect.protocol === 'http:';
    if ((!local && redirect.protocol !== 'https:') || redirect.username || redirect.password
      || redirect.search || redirect.hash || redirect.pathname !== CALLBACK_PATH) throw new Error();
    if (process.env.ALIEXPRESS_APP_KEY !== '547536' || !process.env.ALIEXPRESS_APP_SECRET?.trim()) throw new Error();
    tokenEncryptionKey(process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY);
    return { redirectUri: redirect.href, origin: redirect.origin, secure: !local,
      appKey: process.env.ALIEXPRESS_APP_KEY };
  } catch { throw new AliExpressOAuthError('OAUTH_CONFIGURATION_ERROR'); }
}

type SafeOAuthEvent = { account: string; sellerId: string | null; resultado: string; errorCode?: string; timestamp?: string };

/** Only hashes of opaque random state/browser nonce are stored. No tokens or code. */
export function createAliExpressBrowserOAuth(overrides: Partial<{
  db: typeof prisma; connect: typeof connectAliExpress; config: typeof oauthBrowserConfig; now: () => Date;
  log: (event: SafeOAuthEvent) => void;
}> = {}) {
  const d = { db: prisma, connect: connectAliExpress, config: oauthBrowserConfig, now: () => new Date(),
    log: (event: SafeOAuthEvent) => { console.info('[aliexpress-oauth]', JSON.stringify(event)); },
    ...overrides };
  // Log only account, seller_id, outcome and timestamp: never tokens, code, secret or key.
  const emit = (event: SafeOAuthEvent) => {
    try { d.log({ account: event.account || 'desconocida', sellerId: event.sellerId,
      resultado: event.resultado, timestamp: d.now().toISOString(),
      ...(event.errorCode ? { errorCode: event.errorCode } : {}) }); }
    catch { /* Logging never changes authorization state. */ }
  };
  async function start(userId: string, account?: string) {
    try {
      const config = d.config();
      const user = await d.db.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
      if (!user?.isActive || user.role !== 'ADMIN') throw new AliExpressOAuthError('REJECTED');
      if (account && !await d.db.aliexpressToken.findUnique({ where: { account }, select: { id: true } })) {
        throw new AliExpressOAuthError('REJECTED');
      }
      const state = randomBytes(32).toString('hex'), browser = randomBytes(32).toString('hex');
      await d.db.aliExpressOAuthAttempt.deleteMany({ where: { expiresAt: { lte: d.now() } } });
      await d.db.aliExpressOAuthAttempt.create({ data: { stateHash: hash(state), browserHash: hash(browser), userId,
        account: account || null, expiresAt: new Date(d.now().getTime() + ATTEMPT_TTL) } });
      // Official article 120687: state echoed unchanged, redirect_uri must match registered callback.
      const url = new URL(AUTHORIZE_ENDPOINT);
      url.search = new URLSearchParams({ client_id: config.appKey, redirect_uri: config.redirectUri,
        response_type: 'code', force_auth: 'true', state }).toString();
      emit({ account: account || '', sellerId: null, resultado: 'OAUTH_STARTED' });
      return { authorizationUrl: url.href, browser, secure: config.secure };
    } catch (error) {
      const safe = error instanceof AliExpressOAuthError ? error : new AliExpressOAuthError('STORAGE');
      emit({ account: account || '', sellerId: null, resultado: 'OAUTH_ERROR', errorCode: safe.reason });
      throw safe;
    }
  }
  async function callback(state: string, browser: string, code?: string) {
    let account = '';
    try {
      if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(browser)) throw new AliExpressOAuthError('REJECTED');
      const stateHash = hash(state), browserHash = hash(browser);
      const attempt = await d.db.aliExpressOAuthAttempt.findUnique({ where: { stateHash } });
      if (!attempt || attempt.browserHash !== browserHash || attempt.expiresAt <= d.now()) {
        throw new AliExpressOAuthError('REJECTED');
      }
      // Atomic consumption committed BEFORE network I/O. Replays/concurrent callbacks cannot exchange twice.
      const consumed = await d.db.aliExpressOAuthAttempt.deleteMany({ where: { stateHash, browserHash,
        expiresAt: { gt: d.now() } } });
      if (consumed.count !== 1) throw new AliExpressOAuthError('REJECTED');
      account = attempt.account || '';
      const user = await d.db.user.findUnique({ where: { id: attempt.userId }, select: { role: true, isActive: true } });
      if (!user?.isActive || user.role !== 'ADMIN' || !code || code.length > 4096
        || /[\u0000-\u0020\u007f]/.test(code)) throw new AliExpressOAuthError('REJECTED');
      // Only a successful signed exchange activates the account (see saveAliExpressGrant).
      const saved = await d.connect(code, attempt.account || undefined);
      emit({ account: saved.account, sellerId: saved.sellerId, resultado: 'OAUTH_CONNECTED' });
    } catch (error) {
      const safe = error instanceof AliExpressOAuthError ? error : new AliExpressOAuthError('STORAGE');
      emit({ account, sellerId: null, resultado: 'OAUTH_ERROR', errorCode: safe.reason });
      throw safe;
    }
  }
  return { start, callback };
}
