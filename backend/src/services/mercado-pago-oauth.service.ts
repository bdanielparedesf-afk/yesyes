import { prisma } from '../lib/prisma';
import { mpEncryptionKey, encryptSecret, decryptSecret } from './mp-cipher-service';

export class MercadoPagoOAuthError extends Error {
  constructor(message: string, public reason: string = 'OAUTH_ERROR') {
    super(message);
    this.name = 'MercadoPagoOAuthError';
  }
}

function oauthEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  return {
    clientId: process.env.MERCADOPAGO_CLIENT_ID || '',
    clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET || '',
    redirectUri: process.env.MERCADOPAGO_OAUTH_REDIRECT_URI || '',
  };
}

export function resolveSandboxFromTokenResponse(
  tokenData: { live_mode?: boolean },
  accessToken: string,
): boolean {
  if (tokenData.live_mode !== undefined) return !tokenData.live_mode;
  return accessToken.includes('sandbox') || accessToken.includes('TEST');
}

const AUTHORIZE_ENDPOINT = 'https://auth.mercadopago.com/authorization';
const TOKEN_ENDPOINT = 'https://api.mercadopago.com/oauth/token';
const USERS_ME_ENDPOINT = 'https://api.mercadopago.com/users/me';

interface MercadoPagoTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
  live_mode?: boolean;
}

interface MercadoPagoUserResponse {
  id: string | number;
  email?: string;
  nickname?: string;
}

export function validateOAuthConfig(): void {
  const { clientId, clientSecret, redirectUri } = oauthEnv();
  if (!clientId || clientId.length < 10)
    throw new MercadoPagoOAuthError('MERCADOPAGO_CLIENT_ID no está configurado correctamente', 'CONFIGURATION');
  if (!clientSecret || clientSecret.length < 10)
    throw new MercadoPagoOAuthError('MERCADOPAGO_CLIENT_SECRET no está configurado correctamente', 'CONFIGURATION');
  if (!redirectUri || (!redirectUri.startsWith('https://') && !redirectUri.startsWith('http://localhost')))
    throw new MercadoPagoOAuthError('MERCADOPAGO_OAUTH_REDIRECT_URI no está configurado correctamente', 'CONFIGURATION');
  if (!process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY)
    throw new MercadoPagoOAuthError('MERCADOPAGO_TOKEN_ENCRYPTION_KEY no está configurado', 'CONFIGURATION');
}

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  expectedBusinessId: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string; mpUserId: string }> {
  validateOAuthConfig();
  if (!code || code.length > 4096 || /[\u0000-\u0020\u007f]/.test(code))
    throw new MercadoPagoOAuthError('Código de autorización inválido', 'REJECTED');

  const encryptionKey = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
  const { clientId, clientSecret, redirectUri } = oauthEnv();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    console.error('[mp-oauth] Token exchange failed:', tokenResponse.status);
    if (tokenResponse.status === 400 || tokenResponse.status === 401)
      throw new MercadoPagoOAuthError('Error al intercambiar código de autorización', 'TOKEN_EXCHANGE_FAILED');
    throw new MercadoPagoOAuthError('Error al comunicarse con Mercado Pago', 'NETWORK_ERROR');
  }

  const tokenData = await tokenResponse.json() as MercadoPagoTokenResponse;
  if (!tokenData.access_token || !tokenData.refresh_token) {
    console.error('[mp-oauth] Respuesta de token incompleta');
    throw new MercadoPagoOAuthError('Respuesta de Mercado Pago incompleta', 'TOKEN_EXCHANGE_FAILED');
  }

  const accessToken: string = tokenData.access_token;
  const refreshToken: string = tokenData.refresh_token;

  const userResponse = await fetch(USERS_ME_ENDPOINT, {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
  });

  if (!userResponse.ok) {
    console.error('[mp-oauth] Users/me failed:', userResponse.status);
    throw new MercadoPagoOAuthError('No se pudo verificar la cuenta conectada', 'VERIFICATION_FAILED');
  }

  const userData = await userResponse.json() as MercadoPagoUserResponse;
  const mpUserId = String(userData.id || '');
  if (!mpUserId) throw new MercadoPagoOAuthError('No se pudo obtener MP user ID', 'VERIFICATION_FAILED');

  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const sandbox = resolveSandboxFromTokenResponse(tokenData, accessToken);

  await prisma.$transaction(async (tx) => {
    await tx.businessMercadoPago.upsert({
      where: { businessId: expectedBusinessId },
      create: {
        businessId: expectedBusinessId,
        mpUserId,
        accessTokenEncrypted: encryptSecret(accessToken, encryptionKey, expectedBusinessId, 'access'),
        refreshTokenEncrypted: encryptSecret(refreshToken, encryptionKey, expectedBusinessId, 'refresh'),
        connectionStatus: 'CONNECTED',
        connectedAt: new Date(),
        lastVerifiedAt: new Date(),
        expiresAt,
        sandbox,
      },
      update: {
        mpUserId,
        accessTokenEncrypted: encryptSecret(accessToken, encryptionKey, expectedBusinessId, 'access'),
        refreshTokenEncrypted: encryptSecret(refreshToken, encryptionKey, expectedBusinessId, 'refresh'),
        connectionStatus: 'CONNECTED',
        connectedAt: new Date(),
        lastVerifiedAt: new Date(),
        expiresAt,
        sandbox,
      },
    });
  });

  return {
    accessToken,
    refreshToken,
    expiresIn,
    scope: tokenData.scope || 'offline_access',
    mpUserId,
  };
}
export async function disconnectBusinessMercadoPago(businessId: string): Promise<void> {
  try {
    await prisma.businessMercadoPago.upsert({
      where: { businessId },
      create: { businessId, connectionStatus: 'NOT_CONNECTED' },
      update: {
        connectionStatus: 'NOT_CONNECTED',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        mpUserId: null,
        connectedAt: null,
        lastVerifiedAt: null,
        expiresAt: null,
        sandbox: true,
      },
    });
    console.log('[mp-oauth] Business desconectado de Mercado Pago');
  } catch (err) {
    console.error('[mp-oauth] Error al desconectar');
    throw new MercadoPagoOAuthError('Error al desconectar Mercado Pago', 'STORAGE_ERROR');
  }
}

export async function refreshAccessToken(businessId: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; sandbox: boolean }> {
  validateOAuthConfig();
  const encryptionKey = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);

  const conn = await prisma.businessMercadoPago.findUnique({
    where: { businessId },
    select: { refreshTokenEncrypted: true },
  });

  if (!conn?.refreshTokenEncrypted) {
    throw new MercadoPagoOAuthError('No hay refresh token disponible para este negocio', 'NO_REFRESH_TOKEN');
  }

  const refreshToken = decryptSecret(conn.refreshTokenEncrypted, encryptionKey, businessId, 'refresh');
  const { clientId, clientSecret } = oauthEnv();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    console.error('[mp-oauth] Token refresh failed:', tokenResponse.status);
    if (tokenResponse.status === 400 || tokenResponse.status === 401)
      throw new MercadoPagoOAuthError('Error al renovar token de acceso', 'TOKEN_REFRESH_FAILED');
    throw new MercadoPagoOAuthError('Error al comunicarse con Mercado Pago', 'NETWORK_ERROR');
  }

  const tokenData = await tokenResponse.json() as MercadoPagoTokenResponse;
  if (!tokenData.access_token || !tokenData.refresh_token) {
    console.error('[mp-oauth] Respuesta de refresh incompleta');
    throw new MercadoPagoOAuthError('Respuesta de Mercado Pago incompleta al renovar', 'TOKEN_REFRESH_FAILED');
  }

  const accessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token;
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const sandbox = resolveSandboxFromTokenResponse(tokenData, accessToken);

  await prisma.businessMercadoPago.update({
    where: { businessId },
    data: {
      accessTokenEncrypted: encryptSecret(accessToken, encryptionKey, businessId, 'access'),
      refreshTokenEncrypted: encryptSecret(newRefreshToken, encryptionKey, businessId, 'refresh'),
      lastVerifiedAt: new Date(),
      expiresAt,
      sandbox,
    },
  });

  console.log('[mp-oauth] Token renovado');

  return { accessToken, refreshToken: newRefreshToken, expiresIn, sandbox };
}

export async function getMercadoPagoConnectionStatus(
  businessId: string,
): Promise<{
  connected: boolean;
  status: string;
  mpUserId: string | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  sandbox: boolean;
} | null> {
  const conn = await prisma.businessMercadoPago.findUnique({
    where: { businessId },
    select: {
      mpUserId: true,
      connectionStatus: true,
      connectedAt: true,
      lastVerifiedAt: true,
      expiresAt: true,
      sandbox: true,
      accessTokenEncrypted: true,
    },
  });
  if (!conn) return null;
  return {
    connected: conn.connectionStatus === 'CONNECTED' && !!conn.accessTokenEncrypted,
    status: conn.connectionStatus,
    mpUserId: conn.mpUserId,
    connectedAt: conn.connectedAt?.toISOString() || null,
    lastVerifiedAt: conn.lastVerifiedAt?.toISOString() || null,
    expiresAt: conn.expiresAt?.toISOString() || null,
    sandbox: conn.sandbox,
  };
}

export async function verifyAuthenticatedOperation(
  businessId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; mpUserId?: string | number; sandbox?: boolean }> {
  const encryptionKey = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
  const conn = await prisma.businessMercadoPago.findUnique({
    where: { businessId },
    select: { accessTokenEncrypted: true, sandbox: true, connectionStatus: true },
  });
  if (!conn || !conn.accessTokenEncrypted) {
    return { ok: false };
  }
  const accessToken = decryptSecret(conn.accessTokenEncrypted, encryptionKey, businessId, 'access');
  const res = await fetcher(USERS_ME_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { ok: false };
  const data = await res.json() as MercadoPagoUserResponse;
  return { ok: true, mpUserId: data.id, sandbox: conn.sandbox };
}

export function buildAuthorizationUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = oauthEnv();
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'offline_access',
  }).toString();
  return url.href;
}