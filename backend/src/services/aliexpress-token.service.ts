import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AliExpressOAuthError, exchangeAuthorizationCode, TokenGrant } from '../aliexpress/oauth-client';
import { decryptToken, encryptToken, tokenEncryptionKey } from '../aliexpress/token-crypto';

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

/** Backend-only entry point. The single-use code must never be a URL/log argument. */
export async function connectAliExpress(code: string): Promise<void> {
  const key = tokenEncryptionKey(process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY);
  // Check storage before consuming a one-use authorization code.
  try { await prisma.aliexpressToken.count(); } catch { throw new AliExpressOAuthError('STORAGE'); }
  const grant = await exchangeAuthorizationCode(code, {
    appKey: process.env.ALIEXPRESS_APP_KEY || '', appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
  });
  await saveAliExpressGrant(grant, key);
}

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

export async function getAliExpressAccessToken(account: string): Promise<string> {
  const key = tokenEncryptionKey(process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY);
  try {
    const row = await prisma.aliexpressToken.findUnique({ where: { account } });
    if (!row?.isActive || row.expiresAt.getTime() <= Date.now() + 60000) throw new AliExpressOAuthError('CONFIGURATION');
    return decryptToken(row.accessToken, key, row.account, 'access');
  } catch (error) {
    if (error instanceof AliExpressOAuthError) throw error;
    throw new AliExpressOAuthError('STORAGE');
  }
}
