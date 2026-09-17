import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AliExpressOAuthError, exchangeAuthorizationCode, TokenGrant } from '../aliexpress/oauth-client';
import { createAliExpressTokenManager } from './aliexpress-token-manager';
import { encryptToken, tokenEncryptionKey } from '../aliexpress/token-crypto';

const statusSelect = { account: true, sellerId: true, expiresAt: true, refreshExpiresAt: true, isActive: true } as const;

export async function saveAliExpressGrant(grant: TokenGrant, key: Buffer, db: Pick<Prisma.TransactionClient, 'aliexpressToken'> = prisma): Promise<void> {
  const data = {
    sellerId: grant.sellerId,
    accessToken: encryptToken(grant.accessToken, key, grant.account, 'access'),
    refreshToken: encryptToken(grant.refreshToken, key, grant.account, 'refresh'),
    expiresAt: grant.expiresAt, refreshExpiresAt: grant.refreshExpiresAt, isActive: true,
  };
  try {
    await db.aliexpressToken.upsert({
      where: { account: grant.account }, create: { account: grant.account, ...data }, update: data,
      select: { id: true },
    });
  } catch { throw new AliExpressOAuthError('STORAGE'); }
}

/** Backend-only entry point. Reuses the existing signed code exchange and encrypted upsert. */
export function createAliExpressConnector(overrides: Partial<{
  db: typeof prisma;
  exchange: typeof exchangeAuthorizationCode;
  config: () => { appKey: string; appSecret: string; encryptionKey: string | undefined };
}> = {}) {
  const d = { db: prisma, exchange: exchangeAuthorizationCode,
    config: () => ({ appKey: process.env.ALIEXPRESS_APP_KEY || '', appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
      encryptionKey: process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY }), ...overrides };
  return async (code: string, expectedAccount?: string): Promise<{ account: string; sellerId: string | null }> => {
    const config = d.config();
    const key = tokenEncryptionKey(config.encryptionKey);
    try {
      // Check storage before consuming a one-use authorization code.
      await d.db.aliexpressToken.count();
      const grant = await d.exchange(code, config);
      // A reconnect must confirm the same identity the administrator targeted.
      if (expectedAccount && grant.account !== expectedAccount) throw new AliExpressOAuthError('CONTRACT');
      return await d.db.$transaction(async tx => {
        // Reuses the existing row when the provider confirms the same account: no duplicates.
        await tx.$queryRaw`SELECT id FROM aliexpress_tokens WHERE account = ${grant.account} FOR UPDATE`;
        const existing = await tx.aliexpressToken.findUnique({ where: { account: grant.account },
          select: { sellerId: true } });
        if (existing?.sellerId && grant.sellerId && existing.sellerId !== grant.sellerId) {
          throw new AliExpressOAuthError('CONTRACT');
        }
        // Missing seller_id must not erase a previously confirmed identity.
        const sellerId = grant.sellerId || existing?.sellerId || null;
        await saveAliExpressGrant({ ...grant, sellerId }, key, tx);
        return { account: grant.account, sellerId };
      });
    } catch (error) {
      throw error instanceof AliExpressOAuthError ? error : new AliExpressOAuthError('STORAGE');
    }
  };
}
export const connectAliExpress = createAliExpressConnector();

export async function getAliExpressAccounts() {
  try {
    const accounts = await prisma.aliexpressToken.findMany({ select: statusSelect, orderBy: { account: 'asc' }, take: 100 });
    return accounts.map(account => ({ ...account,
      tokenUnexpired: account.isActive && account.expiresAt.getTime() > Date.now(),
      authenticationVerified: false,
    }));
  } catch { throw new AliExpressOAuthError('STORAGE'); }
}

export async function disconnectAliExpress(account: string): Promise<void> {
  try {
    // Local disconnection, not remote revocation. No token is exposed or deleted.
    await prisma.aliexpressToken.updateMany({ where: { account }, data: { isActive: false } });
  } catch { throw new AliExpressOAuthError('STORAGE'); }
}

const tokenManager = createAliExpressTokenManager();
export const getAliExpressAccessToken = tokenManager.getAliExpressAccessToken;
export const refreshAliexpressToken = tokenManager.refreshAliexpressToken;
