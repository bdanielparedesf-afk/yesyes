// FASE 3 — Validacion OAuth Mercado Pago (mocks, sin secretos reales).
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('tsx/cjs');

process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY =
  '5cd6d7ca3b2b1b325ce590f924ea4a137d4c5ae772a78a6c660015d6ac33a63f';
process.env.MERCADOPAGO_CLIENT_ID = 'test_client_id_12345';
process.env.MERCADOPAGO_CLIENT_SECRET = 'test_client_secret_123';
process.env.MERCADOPAGO_OAUTH_REDIRECT_URI = 'http://localhost:5173/api/mercadopago/oauth/callback';

const oauthService = require('../src/services/mercado-pago-oauth.service.ts');
const stateService = require('../src/services/mercado-pago-oauth-state.service.ts');
const cipher = require('../src/services/mp-cipher-service.ts');
const { prisma } = require('../src/lib/prisma.ts');

const { resolveSandboxFromTokenResponse, refreshAccessToken, buildAuthorizationUrl } = oauthService;
const ENC_KEY = cipher.mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);

function mockFetchOnce(handler) {
  const original = global.fetch;
  global.fetch = handler;
  return () => { global.fetch = original; };
}

function patchPrisma(target, methods) {
  const originals = {};
  for (const k of Object.keys(methods)) { originals[k] = target[k]; target[k] = methods[k]; }
  return () => { for (const k of Object.keys(originals)) target[k] = originals[k]; };
}

describe('FASE3 S3 — live_mode a sandbox', () => {
  test('Caso A: live_mode=true => sandbox=false', () => {
    assert.equal(resolveSandboxFromTokenResponse({ live_mode: true }, 'APP-123'), false);
  });
  test('Caso B: live_mode=false => sandbox=true', () => {
    assert.equal(resolveSandboxFromTokenResponse({ live_mode: false }, 'APP-123'), true);
  });
  test('Caso C: sin live_mode usa fallback existente', () => {
    assert.equal(resolveSandboxFromTokenResponse({}, 'TEST-sandbox-token'), true);
    assert.equal(resolveSandboxFromTokenResponse({}, 'APP-999999999-live'), false);
  });
});


describe('FASE3 S4-S6 — refreshAccessToken()', () => {
  let restoreFetch = null;
  let restoreBmp = null;
  afterEach(() => {
    if (restoreFetch) { restoreFetch(); restoreFetch = null; }
    if (restoreBmp) { restoreBmp(); restoreBmp = null; }
  });

  async function setupRefresh(opts = {}) {
    const expiresIn = opts.expiresIn || 21600;
    const liveMode = opts.liveMode || false;
    const businessId = 'biz-refresh-1';
    const encryptedOriginal = cipher.encryptSecret('refresh_token_original', ENC_KEY, businessId, 'refresh');
    const row = {
      businessId,
      refreshTokenEncrypted: encryptedOriginal,
      accessTokenEncrypted: cipher.encryptSecret('old-access', ENC_KEY, businessId, 'access'),
      expiresAt: new Date(Date.now() - 1000),
      lastVerifiedAt: new Date(Date.now() - 3600000),
      sandbox: false,
    };
    let capturedBody = null;
    restoreFetch = mockFetchOnce(async (_url, fetchOpts) => {
      capturedBody = new URLSearchParams(fetchOpts.body);
      return {
        ok: true, status: 200,
        json: async () => ({
          access_token: 'access_token_nuevo',
          refresh_token: 'refresh_token_nuevo',
          expires_in: expiresIn,
          live_mode: liveMode,
        }),
      };
    });
    restoreBmp = patchPrisma(prisma.businessMercadoPago, {
      findUnique: async (args) => {
        assert.equal(args.where.businessId, businessId);
        return { ...row };
      },
      update: async (args) => {
        assert.equal(args.where.businessId, businessId);
        Object.assign(row, args.data);
        return { ...row };
      },
    });
    return { businessId, row, getBody: () => capturedBody, before: new Date() };
  }

  test('envia grant_type=refresh_token y devuelve tokens nuevos', async () => {
    const ctx = await setupRefresh();
    const result = await refreshAccessToken(ctx.businessId);
    assert.equal(ctx.getBody().get('grant_type'), 'refresh_token');
    assert.equal(result.accessToken, 'access_token_nuevo');
    assert.equal(result.refreshToken, 'refresh_token_nuevo');
    assert.equal(typeof result.expiresIn, 'number');
    assert.equal(typeof result.sandbox, 'boolean');
  });

  test('rota el refresh token y el nuevo queda cifrado', async () => {
    const ctx = await setupRefresh();
    const beforeEncrypted = ctx.row.refreshTokenEncrypted;
    assert.equal(cipher.decryptSecret(beforeEncrypted, ENC_KEY, ctx.businessId, 'refresh'), 'refresh_token_original');
    await refreshAccessToken(ctx.businessId);
    assert.ok(ctx.row.refreshTokenEncrypted.startsWith('mp1:'));
    assert.notEqual(ctx.row.refreshTokenEncrypted, beforeEncrypted);
    const activeNow = cipher.decryptSecret(ctx.row.refreshTokenEncrypted, ENC_KEY, ctx.businessId, 'refresh');
    assert.equal(activeNow, 'refresh_token_nuevo');
  });

  test('actualiza expiresAt, lastVerifiedAt y sandbox', async () => {
    const ctx = await setupRefresh({ expiresIn: 7200, liveMode: false });
    const lastBefore = ctx.row.lastVerifiedAt.getTime();
    const result = await refreshAccessToken(ctx.businessId);
    const expected = ctx.before.getTime() + 7200 * 1000;
    assert.ok(Math.abs(ctx.row.expiresAt.getTime() - expected) < 60000);
    assert.ok(ctx.row.lastVerifiedAt.getTime() >= lastBefore);
    assert.equal(ctx.row.sandbox, true);
    assert.equal(result.sandbox, true);
  });

  test('live_mode=true => sandbox=false en refresh', async () => {
    const ctx = await setupRefresh({ liveMode: true });
    const result = await refreshAccessToken(ctx.businessId);
    assert.equal(ctx.row.sandbox, false);
    assert.equal(result.sandbox, false);
  });

  test('falla seguro sin conexion', async () => {
    restoreBmp = patchPrisma(prisma.businessMercadoPago, {
      findUnique: async () => null,
      update: async () => { throw new Error('no debe llamarse'); },
    });
    await assert.rejects(() => refreshAccessToken('biz-inexistente'));
  });

  test('falla seguro ante 401 de Mercado Pago', async () => {
    restoreFetch = mockFetchOnce(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    restoreBmp = patchPrisma(prisma.businessMercadoPago, {
      findUnique: async () => ({
        businessId: 'b401',
        refreshTokenEncrypted: cipher.encryptSecret('rt', ENC_KEY, 'b401', 'refresh'),
      }),
      update: async () => { throw new Error('no debe llamarse'); },
    });
    await assert.rejects(() => refreshAccessToken('b401'));
  });
});

describe('FASE3 S6-S7 — expiracion y persistencia', () => {
  test('expiresAt usa el expires_in de la respuesta (sin hardcode)', async () => {
    const businessId = 'biz-exp-1';
    const row = {
      businessId,
      refreshTokenEncrypted: cipher.encryptSecret('rt', ENC_KEY, businessId, 'refresh'),
      lastVerifiedAt: new Date(),
      expiresAt: new Date(),
      sandbox: true,
    };
    const rFetch = mockFetchOnce(async () => ({
      ok: true, status: 200,
      json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 10800, live_mode: false }),
    }));
    const rBmp = patchPrisma(prisma.businessMercadoPago, {
      findUnique: async () => ({ ...row }),
      update: async (args) => { Object.assign(row, args.data); return row; },
    });
    const before = Date.now();
    try {
      const result = await refreshAccessToken(businessId);
      assert.equal(result.expiresIn, 10800);
      const delta = row.expiresAt.getTime() - before;
      assert.ok(delta > 10700000 && delta <= 10900000);
    } finally { rFetch(); rBmp(); }
  });

  test('guardar, leer y descifrar tras reinicio (re-deriva clave)', () => {
    const businessId = 'biz-persist-1';
    const stored = {
      accessTokenEncrypted: cipher.encryptSecret('access_token_nuevo', ENC_KEY, businessId, 'access'),
      refreshTokenEncrypted: cipher.encryptSecret('refresh_token_nuevo', ENC_KEY, businessId, 'refresh'),
    };
    assert.ok(!stored.accessTokenEncrypted.includes('access_token_nuevo'));
    assert.ok(!stored.refreshTokenEncrypted.includes('refresh_token_nuevo'));
    const keyAfterRestart = cipher.mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
    assert.equal(cipher.decryptSecret(stored.accessTokenEncrypted, keyAfterRestart, businessId, 'access'), 'access_token_nuevo');
    assert.equal(cipher.decryptSecret(stored.refreshTokenEncrypted, keyAfterRestart, businessId, 'refresh'), 'refresh_token_nuevo');
  });
});

describe('FASE3 S8 — logs sin secretos', () => {
  test('no se vuelcan tokens ni cuerpos de MP en logs', () => {
    const rels = [
      'src/services/mercado-pago-oauth.service.ts',
      'src/services/mercado-pago-oauth-state.service.ts',
      'src/controllers/mp-oauth.controller.ts',
      'src/routes/mp-oauth.routes.ts',
    ];
    for (const rel of rels) {
      const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      const lines = src.split('\n').filter((l) => /console\.(log|error|warn|debug)/.test(l));
      for (const line of lines) {
        assert.ok(!/JSON\.stringify\(tokenData/.test(line), rel + ': vuelca tokenData');
        assert.ok(!/errText/.test(line), rel + ': vuelca cuerpo de MP');
        assert.ok(!/mp_user_id=\$\{/.test(line), rel + ': expone mp_user_id');
      }
    }
  });
  test('no se lee el cuerpo de error de MP', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/services/mercado-pago-oauth.service.ts'), 'utf8');
    assert.ok(!src.includes('await tokenResponse.text()'));
  });
});

describe('FASE3 S9 — autorizacion y callback', () => {
  test('buildAuthorizationUrl correcta (PKCE S256, offline_access)', () => {
    const url = new URL(buildAuthorizationUrl('a'.repeat(64), 'challenge123'));
    assert.equal(url.origin + url.pathname, 'https://auth.mercadopago.com/authorization');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('scope'), 'offline_access');
    assert.equal(url.searchParams.get('state'), 'a'.repeat(64));
    assert.equal(url.searchParams.get('code_challenge'), 'challenge123');
  });
  test('state invalido o inexistente falla seguro', async () => {
    assert.equal(await stateService.validateAndConsumeOAuthAttempt('no-es-state'), null);
    const restore = patchPrisma(prisma.mercadoPagoOAuthAttempt, { findUnique: async () => null });
    try {
      assert.equal(await stateService.validateAndConsumeOAuthAttempt('b'.repeat(64)), null);
    } finally { restore(); }
  });
  test('state expirado o reutilizado falla seguro', async () => {
    const expired = {
      stateHash: 'h', businessId: 'b', userId: 'u',
      codeVerifierEncrypted: cipher.encryptSecret('v', ENC_KEY, 'b', 'access'),
      expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    };
    let restore = patchPrisma(prisma.mercadoPagoOAuthAttempt, { findUnique: async () => expired });
    try {
      assert.equal(await stateService.validateAndConsumeOAuthAttempt('c'.repeat(64)), null);
    } finally { restore(); }
    const consumed = { ...expired, expiresAt: new Date(Date.now() + 60000), consumedAt: new Date() };
    restore = patchPrisma(prisma.mercadoPagoOAuthAttempt, { findUnique: async () => consumed });
    try {
      assert.equal(await stateService.validateAndConsumeOAuthAttempt('c'.repeat(64)), null);
    } finally { restore(); }
  });
  test('state valido se consume una sola vez', async () => {
    const businessId = 'biz-state-1';
    const verifier = 'verifier-secreto';
    let claimed = false;
    const attempt = {
      stateHash: 'h', businessId, userId: 'u1',
      codeVerifierEncrypted: cipher.encryptSecret(verifier, ENC_KEY, businessId, 'access'),
      expiresAt: new Date(Date.now() + 60000), consumedAt: null,
    };
    const restore = patchPrisma(prisma.mercadoPagoOAuthAttempt, {
      findUnique: async () => (claimed ? { ...attempt, consumedAt: new Date() } : { ...attempt }),
      updateMany: async () => {
        if (claimed) return { count: 0 };
        claimed = true;
        return { count: 1 };
      },
    });
    try {
      const first = await stateService.validateAndConsumeOAuthAttempt('d'.repeat(64));
      assert.ok(first);
      assert.equal(first.businessId, businessId);
      assert.equal(first.codeVerifierForExchange, verifier);
      assert.equal(await stateService.validateAndConsumeOAuthAttempt('d'.repeat(64)), null);
    } finally { restore(); }
  });
  test('challenge = SHA256(verifier) base64url', () => {
    const v = stateService.generateCodeVerifier();
    const expected = require('node:crypto').createHash('sha256').update(v).digest('base64url');
    assert.equal(stateService.generateCodeChallenge(v), expected);
  });
});

// ============ FASE3 S8 — LOGS SEGUROS ============
describe('FASE3 S8 — seguridad de logs', () => {
  test('ningun secreto en logs del flujo OAuth', () => {
    const files = [
      'src/services/mercado-pago-oauth.service.ts',
      'src/services/mercado-pago-oauth-state.service.ts',
      'src/controllers/mp-oauth.controller.ts',
    ];
    const sensitiveRe = /(access_token|refresh_token|client_secret|authorization_code|code_verifier)\s*[:=]/i;
    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      for (const line of src.split('\n')) {
        if (/console\.(log|error|warn|debug)|logger\.(info|error|warn|debug)/.test(line)) {
          assert.ok(!sensitiveRe.test(line), `${f} expone secreto en log: ${line.trim().slice(0, 120)}`);
          assert.ok(!/JSON\.stringify\(tokenData/.test(line), `${f} vuelca tokenData en log`);
        }
      }
    }
  });
});

// ============ FASE3 S13 — OPERACION API AUTENTICADA (MOCK) ============
describe('FASE3 S13 — operacion API autenticada (mock)', () => {
  test('usa token descifrado como Bearer contra users/me', async () => {
    const businessId = 'biz-api-1';
    const stored = {
      accessTokenEncrypted: cipher.encryptSecret('APP-ACCESS-OK', ENC_KEY, businessId, 'access'),
      sandbox: true,
      connectionStatus: 'CONNECTED',
    };
    const restoreBmp = patchPrisma(prisma.businessMercadoPago, { findUnique: async () => stored });
    let capturedAuth = null;
    const fakeFetch = async (_url, opts) => {
      capturedAuth = opts.headers.Authorization;
      return { ok: true, json: async () => ({ id: 123456789 }) };
    };
    try {
      const res = await oauthService.verifyAuthenticatedOperation(businessId, fakeFetch);
      assert.equal(res.ok, true);
      assert.equal(res.mpUserId, 123456789);
      assert.equal(capturedAuth, 'Bearer APP-ACCESS-OK');
    } finally { restoreBmp(); }
  });
  test('sin credenciales falla seguro (ok=false)', async () => {
    const restoreBmp = patchPrisma(prisma.businessMercadoPago, { findUnique: async () => null });
    try {
      const res = await oauthService.verifyAuthenticatedOperation('biz-missing', async () => ({ ok: true, json: async () => ({}) }));
      assert.equal(res.ok, false);
    } finally { restoreBmp(); }
  });
});

// ============ FASE3 S10-S12 — E2E REAL (requiere credenciales externas) ============
describe('FASE3 S10-S12 — E2E real Mercado Pago', () => {
  test('REAL E2E: BLOQUEADA POR DEPENDENCIA EXTERNA (documentado)', () => {
    const canRun =
      !!process.env.MP_E2E_BUSINESS_ID &&
      !!process.env.MERCADOPAGO_CLIENT_ID &&
      !!process.env.MERCADOPAGO_CLIENT_SECRET;
    assert.equal(canRun, false, 'REAL E2E requiere MP_E2E_BUSINESS_ID + credenciales OAuth reales y autorizacion manual; ver docs/FASE3-E2E.md');
  });
});
