import { AliexpressToken, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AliExpressOAuthError } from '../aliexpress/oauth-client';
import { exchangeRefreshToken } from '../aliexpress/oauth-refresh';
import { decryptToken, encryptToken, tokenEncryptionKey } from '../aliexpress/token-crypto';

type SafeEvent = { account: string; tokenId: string; timestamp: string; resultado: string; errorCode?: string };
type Dependencies = {
  db: Pick<typeof prisma, 'aliexpressToken' | '$transaction'>;
  exchange: typeof exchangeRefreshToken;
  now: () => Date;
  config: () => { appKey: string; appSecret: string; encryptionKey: string | undefined };
  log: (event: SafeEvent) => void;
};
function normalize(error: unknown): AliExpressOAuthError {
  if (!(error instanceof AliExpressOAuthError)) return new AliExpressOAuthError('OAUTH_STORAGE_ERROR');
  const mapped = { CONFIGURATION: 'OAUTH_CONFIGURATION_ERROR', STORAGE: 'OAUTH_STORAGE_ERROR',
    CONTRACT: 'OAUTH_CONTRACT_ERROR', TRANSPORT: 'OAUTH_NETWORK_ERROR', TIMEOUT: 'OAUTH_NETWORK_ERROR',
    REJECTED: 'TOKEN_REFRESH_FAILED' } as const;
  return new AliExpressOAuthError(mapped[error.reason as keyof typeof mapped] || error.reason);
}

/** Row locks live in the transaction, not the session: safe with PgBouncer and
 * independent serverless instances. Never retry a remotely rotated credential.
 * No token or raw exception may be passed to logging or returned by HTTP routes.
 */
export function createAliExpressTokenManager(overrides: Partial<Dependencies> = {}) {
  const d: Dependencies = {
    db: prisma, exchange: exchangeRefreshToken, now: () => new Date(),
    config: () => ({ appKey: process.env.ALIEXPRESS_APP_KEY || '', appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
      encryptionKey: process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY }),
    log: event => { console.info('[aliexpress-oauth]', JSON.stringify(event)); }, ...overrides,
  };
  const usable = (r: AliexpressToken) => r.expiresAt.getTime() > d.now().getTime() + 60000;
  const active = (r: AliexpressToken | null): AliexpressToken => {
    if (!r?.isActive) throw new AliExpressOAuthError('OAUTH_CONFIGURATION_ERROR');
    return r;
  };
  const emit = (r: AliexpressToken, resultado: string, errorCode?: string) => {
    try { d.log({ account: r.account, tokenId: r.id, timestamp: d.now().toISOString(), resultado,
      ...(errorCode ? { errorCode } : {}) }); } catch { /* Logging never changes credential state. */ }
  };
  async function find(account: string) {
    return active(account ? await d.db.aliexpressToken.findUnique({ where: { account } })
      : await d.db.aliexpressToken.findFirst({ where: { isActive: true }, orderBy: [{ expiresAt: 'desc' }, { account: 'asc' }] }));
  }
  async function refreshAliexpressToken(account = ''): Promise<string> {
    let initial: AliexpressToken | undefined;
    let renewed = false;
    try {
      initial = await find(account);
      const config = d.config();
      const key = tokenEncryptionKey(config.encryptionKey);
      const result = await d.db.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '20000ms'`;
        // Select only ID: encrypted credentials do not enter SQL diagnostics.
        await tx.$queryRaw`SELECT id FROM aliexpress_tokens WHERE account = ${initial!.account} FOR UPDATE`;
        const row = active(await tx.aliexpressToken.findUnique({ where: { account: initial!.account } }));
        // A previous waiter may already have refreshed or an admin disconnected.
        if (usable(row)) return decryptToken(row.accessToken, key, row.account, 'access');
        if (!Number.isFinite(row.refreshExpiresAt.getTime()) || row.refreshExpiresAt.getTime() <= d.now().getTime()) {
          throw new AliExpressOAuthError('REFRESH_TOKEN_EXPIRED');
        }
        const refresh = decryptToken(row.refreshToken, key, row.account, 'refresh');
        if (!refresh.trim()) throw new AliExpressOAuthError('REFRESH_TOKEN_EXPIRED');
        emit(row, 'TOKEN_REFRESH_STARTED');
        const grant = await d.exchange(refresh, config, row, undefined, d.now);
        // Official docs: refresh lifetime is NOT reset. Do not extend it on rotation.
        const refreshExpiresAt = new Date(Math.min(grant.refreshExpiresAt.getTime(), row.refreshExpiresAt.getTime()));
        await tx.aliexpressToken.update({ where: { id: row.id }, data: {
          accessToken: encryptToken(grant.accessToken, key, row.account, 'access'),
          refreshToken: encryptToken(grant.refreshToken, key, row.account, 'refresh'),
          expiresAt: grant.expiresAt, refreshExpiresAt, sellerId: grant.sellerId,
          // Deliberately do not set isActive: refresh never reactivates a row.
        }, select: { id: true } });
        renewed = true;
        return grant.accessToken;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 25000, timeout: 40000 });
      if (renewed) emit(initial, 'TOKEN_REFRESH_SUCCESS'); // Only after commit succeeds.
      return result;
    } catch (error) {
      const safe = normalize(error);
      if (initial) emit(initial, safe.reason === 'REFRESH_TOKEN_EXPIRED' ? 'REFRESH_TOKEN_EXPIRED' : 'TOKEN_REFRESH_FAILED', safe.reason);
      throw safe;
    }
  }
  async function getAliExpressAccessToken(account = ''): Promise<string> {
    try {
      const row = await find(account);
      if (!usable(row)) return await refreshAliexpressToken(row.account);
      return decryptToken(row.accessToken, tokenEncryptionKey(d.config().encryptionKey), row.account, 'access');
    } catch (error) { throw normalize(error); }
  }
  return { getAliExpressAccessToken, refreshAliexpressToken };
}
