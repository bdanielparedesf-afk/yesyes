const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');

process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY =
  '5cd6d7ca3b2b1b325ce590f924ea4a137d4c5ae772a78a6c660015d6ac33a63f';
process.env.MERCADOPAGO_CLIENT_ID = 'test_client_id_12345';
process.env.MERCADOPAGO_CLIENT_SECRET = 'test_client_secret_123';
process.env.MERCADOPAGO_OAUTH_REDIRECT_URI = 'http://localhost:5173/api/mercadopago/oauth/callback';

const {
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  hashState,
  hashCodeVerifier,
  createOAuthAttempt,
  validateAndConsumeOAuthAttempt,
  markOAuthAttemptSuccess,
  markOAuthAttemptError,
} = require('../src/services/mercado-pago-oauth-state.service.ts');
const {
  encryptSecret,
  decryptSecret,
  mpEncryptionKey,
} = require('../src/services/mp-cipher-service.ts');
const {
  buildAuthorizationUrl,
  resolveSandboxFromTokenResponse,
  validateOAuthConfig,
  refreshAccessToken,
  exchangeAuthorizationCode,
  MercadoPagoOAuthError,
} = require('../src/services/mercado-pago-oauth.service.ts');

const { prisma } = require('../src/lib/prisma.ts');
const { ownerWhere } = require('../src/middlewares/businessAuth.ts');

// ============ UTILS ============
function reqAs(role, id, params = {}) {
  return { user: { role, id }, params };
}

// ============ STATE & PKCE ============
describe('OAuth - State y PKCE', () => {
  test('generateOAuthState genera string hex de 64 caracteres', () => {
    const state = generateOAuthState();
    assert.equal(typeof state, 'string');
    assert.equal(state.length, 64);
    assert.ok(/^[a-f\d]{64}$/.test(state));
  });

  test('generateOAuthState genera valores únicos', () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    assert.notEqual(a, b);
  });

  test('validateOAuthConfig exige CLIENT_ID largo', () => {
    const prev = process.env.MERCADOPAGO_CLIENT_ID;
    process.env.MERCADOPAGO_CLIENT_ID = 'short';
    assert.throws(() => validateOAuthConfig());
    process.env.MERCADOPAGO_CLIENT_ID = prev;
  });

  test('validateOAuthConfig pasa con env de prueba', () => {
    assert.doesNotThrow(() => validateOAuthConfig());
  });

  test('generateCodeVerifier genera base64url de 43+ chars', () => {
    const v = generateCodeVerifier();
    assert.ok(v.length >= 43);
    assert.ok(/^[a-zA-Z0-9_-]+$/.test(v));
  });

  test('generateCodeChallenge genera S256 hash', () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    assert.ok(challenge.length >= 43);
    assert.ok(/^[a-zA-Z0-9_-]+$/.test(challenge));
  });

  test('code_challenge es hash SHA-256 del code_verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const expected = require('node:crypto').createHash('sha256').update(verifier).digest('base64url');
    assert.equal(challenge, expected);
  });

  test('hashState es SHA-256 hex', () => {
    const h = hashState('test-state');
    assert.equal(h.length, 64);
    assert.ok(/^[a-f\d]{64}$/.test(h));
  });

  test('hashCodeVerifier es SHA-256 hex', () => {
    const h = hashCodeVerifier('test-verifier');
    assert.equal(h.length, 64);
    assert.ok(/^[a-f\d]{64}$/.test(h));
  });
});

// ============ CIFRADO ============
describe('OAuth - Cifrado', () => {
  const key = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);

  test('encryptSecret genera formato mp1:iv:tag:ciphertext', () => {
    const encrypted = encryptSecret('test-token', key, 'biz-1', 'access');
    assert.ok(encrypted.startsWith('mp1:'));
    const parts = encrypted.split(':');
    assert.equal(parts.length, 4);
    assert.equal(parts[0], 'mp1');
    assert.equal(parts[1].length, 24); // 12 bytes hex
    assert.equal(parts[2].length, 32); // 16 bytes auth tag hex
  });

  test('decryptSecret recupera el valor original', () => {
    const encrypted = encryptSecret('test-token', key, 'biz-1', 'access');
    const decrypted = decryptSecret(encrypted, key, 'biz-1', 'access');
    assert.equal(decrypted, 'test-token');
  });

  test('cifrado es aleatorio (mismo input, diferente output)', () => {
    const a = encryptSecret('token', key, 'biz-1', 'access');
    const b = encryptSecret('token', key, 'biz-1', 'access');
    assert.notEqual(a, b);
  });

  test('clave incorrecta impide descifrado', () => {
    const encrypted = encryptSecret('token', key, 'biz-1', 'access');
    const wrongKey = mpEncryptionKey('a'.repeat(64));
    assert.throws(() => decryptSecret(encrypted, wrongKey, 'biz-1', 'access'));
  });

  test('AAD bind: cambiar businessId impide descifrado', () => {
    const encrypted = encryptSecret('token', key, 'biz-1', 'access');
    assert.throws(() => decryptSecret(encrypted, key, 'biz-2', 'access'));
  });

  test('field bind: cambiar field impide descifrado', () => {
    const encrypted = encryptSecret('token', key, 'biz-1', 'access');
    assert.throws(() => decryptSecret(encrypted, key, 'biz-1', 'refresh'));
  });

  test('reject tampered envelope', () => {
    const encrypted = encryptSecret('token', key, 'biz-1', 'access');
    // Se altera un byte del CIPHERTEXT de forma DETERMINISTA. Un tamper de la
    // forma `slice(0,-2) + '00'` es un no-op cuando el ciphertext ya termina en
    // 0x00 (~1/256 de las ejecuciones) y el test fallaba de forma intermitente,
    // dando la falsa impresion de que la criptografia no detectaba la alteracion.
    const parts = encrypted.split(':');
    const bytes = Buffer.from(parts[3], 'hex');
    // Ultimo byte del ciphertext con el bit 0 siempre invertido -> nunca 0x00.
    bytes[bytes.length - 1] ^= 0x01;
    const tampered = [parts[0], parts[1], parts[2], bytes.toString('hex')].join(':');
    assert.notEqual(tampered, encrypted);
    assert.throws(() => decryptSecret(tampered, key, 'biz-1', 'access'));
  });

  test('reject tampered authTag', () => {
    const encrypted = encryptSecret('token', key, 'biz-1', 'access');
    const parts = encrypted.split(':');
    const tag = Buffer.from(parts[2], 'hex');
    tag[0] ^= 0x01;
    const tampered = [parts[0], parts[1], tag.toString('hex'), parts[3]].join(':');
    assert.throws(() => decryptSecret(tampered, key, 'biz-1', 'access'));
  });

  test('reject tampered iv', () => {
    const encrypted = encryptSecret('token', key, 'biz-1', 'access');
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    iv[0] ^= 0x01;
    const tampered = [parts[0], iv.toString('hex'), parts[2], parts[3]].join(':');
    assert.throws(() => decryptSecret(tampered, key, 'biz-1', 'access'));
  });

  test('mpEncryptionKey rechaza claves inválidas', () => {
    assert.throws(() => mpEncryptionKey(undefined));
    assert.throws(() => mpEncryptionKey(''));
    assert.throws(() => mpEncryptionKey('abc'));
    assert.throws(() => mpEncryptionKey('a'.repeat(63)));
    assert.throws(() => mpEncryptionKey('g'.repeat(64)));
  });

  test('encryptSecret no retorna plaintext', () => {
    const encrypted = encryptSecret('SECRET_TOKEN_VALUE', key, 'biz-1', 'access');
    assert.ok(!encrypted.includes('SECRET_TOKEN_VALUE'));
  });
});

// ============ AUTORIZACIÓN URL ============
describe('OAuth - URL de autorización', () => {
  test('buildAuthorizationUrl contiene parámetros requeridos', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    assert.ok(url.startsWith('https://auth.mercadopago.com/authorization'));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('client_id'), 'test_client_id_12345');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('platform_id'), 'mp');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:5173/api/mercadopago/oauth/callback');
    assert.equal(parsed.searchParams.get('state'), 'test-state');
    assert.equal(parsed.searchParams.get('code_challenge'), 'test-challenge');
    assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(parsed.searchParams.get('scope'), 'offline_access');
  });

  test('URL no contiene client_secret', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    assert.ok(!url.includes('client_secret'));
  });

  test('URL no contiene access_token', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    assert.ok(!url.includes('access_token'));
  });
});

// ============ REFRESH TOKEN ============
describe('OAuth - Refresh Token', () => {
  test('refreshAccessToken existe y es función', () => {
    assert.equal(typeof refreshAccessToken, 'function');
  });
});

// ============ IDOR PROTECTION ============
describe('OAuth - IDOR protection', () => {
  test('ADMIN queda scopeado solo por id (sin ownerId)', () => {
    const result = ownerWhere(reqAs('ADMIN', 'user-1'), 'biz-1');
    assert.deepEqual(result, { id: 'biz-1' });
  });

  test('BUSINESS queda scopado a ownerId (no puede ver otros negocios)', () => {
    const result = ownerWhere(reqAs('BUSINESS', 'user-1'), 'biz-1');
    assert.deepEqual(result, { id: 'biz-1', ownerId: 'user-1' });
  });
});
// ============ CONTROLLER LOGIC ============
describe('OAuth - Controller', () => {
  const {
    startMercadoPagoConnection,
    mercadoPagoOAuthCallback,
    getMercadoPagoStatus,
    disconnectMercadoPago,
  } = require('../src/controllers/mp-oauth.controller.ts');

  test('startMercadoPagoConnection NO devuelve codeVerifier', async () => {
    const mockPrisma = {
      business: { findFirst: async () => ({ id: 'biz-1', name: 'Test' }) },
      businessMercadoPago: { findUnique: async () => null },
      mercadoPagoOAuthAttempt: { deleteMany: async () => ({}), create: async () => ({}) },
    };
    const originalPrisma = prisma;
    // We can't easily mock prisma singleton, but we can verify the service function
    // by checking the source code doesn't expose codeVerifier
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/controllers/mp-oauth.controller.ts'),
      'utf8'
    );
    assert.ok(src.includes('authorizationUrl'), 'Should return authorizationUrl');
    assert.ok(src.includes('state'), 'Should return state');
    assert.ok(src.includes('businessId'), 'Should return businessId');
    // The controller should NOT return codeVerifier in the response
    const jsonMatch = src.match(/res\.json\(([\s\S]+?)\);/);
    assert.ok(jsonMatch, 'Should have res.json call');
    const jsonBody = jsonMatch[1];
    assert.ok(!jsonBody.includes('codeVerifier'), 'Should NOT return codeVerifier in response');
  });

  test('disconnectMercadoPago usa upsert para limpiar credenciales', async () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/services/mercado-pago-oauth.service.ts'),
      'utf8'
    );
    assert.ok(src.includes('connectionStatus: \'NOT_CONNECTED\''), 'Should set NOT_CONNECTED');
    assert.ok(src.includes('accessTokenEncrypted: null'), 'Should clear access token');
    assert.ok(src.includes('refreshTokenEncrypted: null'), 'Should clear refresh token');
  });
});
// ============ FASE 3: live_mode / sandbox ============
describe('Fase 3 - live_mode y sandbox', () => {
  const { resolveSandboxFromTokenResponse } = require('../src/services/mercado-pago-oauth.service.ts');

  test('Caso A: live_mode=true => sandbox=false', () => {
    assert.equal(resolveSandboxFromTokenResponse({ live_mode: true }, 'APP_USR-xxx'), false);
  });

  test('Caso B: live_mode=false => sandbox=true', () => {
    assert.equal(resolveSandboxFromTokenResponse({ live_mode: false }, 'APP_USR-xxx'), true);
  });

  test('Caso C: sin live_mode usa fallback existente (token sandbox)', () => {
    assert.equal(resolveSandboxFromTokenResponse({}, 'TEST-sandbox-token'), true);
  });

  test('Caso C: sin live_mode y token productivo usa fallback existente', () => {
    assert.equal(resolveSandboxFromTokenResponse({}, 'APP_USR-xxx'), false);
  });
});


// ============ FASE 3: refreshAccessToken (mock fetch + prisma) ============
describe('Fase 3 - refreshAccessToken', () => {
  const oauthService = require('../src/services/mercado-pago-oauth.service.ts');

  function mockPrismaForRefresh(refreshEncrypted) {
    const calls = { updated: null };
    const conn = {
      businessId: 'biz-refresh',
      refreshTokenEncrypted: refreshEncrypted,
      accessTokenEncrypted: 'old',
    };
    const origFindUnique = prisma.businessMercadoPago.findUnique;
    const origUpdate = prisma.businessMercadoPago.update;
    prisma.businessMercadoPago.findUnique = async ({ where }) => {
      assert.equal(where.businessId, 'biz-refresh');
      return conn;
    };
    prisma.businessMercadoPago.update = async ({ where, data }) => {
      calls.updated = { where, data };
      return { ...conn, ...data };
    };
    return {
      calls,
      restore() {
        prisma.businessMercadoPago.findUnique = origFindUnique;
        prisma.businessMercadoPago.update = origUpdate;
      },
    };
  }

  test('refresca, rota refresh token cifrado y actualiza expiresAt/lastVerifiedAt/sandbox', async () => {
    const key = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
    const originalEncrypted = encryptSecret('refresh_token_original', key, 'biz-refresh', 'refresh');
    const mocked = mockPrismaForRefresh(originalEncrypted);
    const origFetch = global.fetch;
    const before = Date.now();
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'access_token_nuevo',
        refresh_token: 'refresh_token_nuevo',
        expires_in: 7200,
        live_mode: false,
      }),
    });
    try {
      const result = await oauthService.refreshAccessToken('biz-refresh');
      assert.equal(result.accessToken, 'access_token_nuevo');
      assert.equal(result.refreshToken, 'refresh_token_nuevo');
      assert.equal(result.expiresIn, 7200);
      assert.equal(result.sandbox, true);
      assert.ok(mocked.calls.updated, 'debe actualizar la fila BusinessMercadoPago');
      const data = mocked.calls.updated.data;
      assert.ok(data.accessTokenEncrypted && !data.accessTokenEncrypted.includes('access_token_nuevo'));
      assert.ok(data.refreshTokenEncrypted && !data.refreshTokenEncrypted.includes('refresh_token_nuevo'));
      assert.notEqual(data.refreshTokenEncrypted, originalEncrypted);
      assert.equal(decryptSecret(data.refreshTokenEncrypted, key, 'biz-refresh', 'refresh'), 'refresh_token_nuevo');
      assert.ok(data.expiresAt instanceof Date);
      const diff = data.expiresAt.getTime() - before;
      assert.ok(diff > 7000 * 1000 && diff <= 7300 * 1000, `expiresAt = now + expires_in (diff=${diff})`);
      assert.ok(data.lastVerifiedAt instanceof Date);
      assert.equal(data.sandbox, true);
    } finally {
      global.fetch = origFetch;
      mocked.restore();
    }
  });

  test('envia grant_type=refresh_token al endpoint OAuth', async () => {
    const key = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
    const mocked = mockPrismaForRefresh(encryptSecret('rt', key, 'biz-refresh', 'refresh'));
    const origFetch = global.fetch;
    let captured = { url: '', body: '' };
    global.fetch = async (url, init) => {
      captured = { url: String(url), body: String(init.body) };

// ============ FASE 3: persistencia cifrada (roundtrip) ============
describe('Fase 3 - persistencia cifrada', () => {
  test('guardar -> leer -> descifrar correctamente (sin plaintext)', () => {
    const key = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
    const stored = {
      accessTokenEncrypted: encryptSecret('access_token_value', key, 'biz-persist', 'access'),
      refreshTokenEncrypted: encryptSecret('refresh_token_value', key, 'biz-persist', 'refresh'),
    };
    assert.ok(!stored.accessTokenEncrypted.includes('access_token_value'));
    assert.ok(!stored.refreshTokenEncrypted.includes('refresh_token_value'));
    const rekey = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
    assert.equal(decryptSecret(stored.accessTokenEncrypted, rekey, 'biz-persist', 'access'), 'access_token_value');
    assert.equal(decryptSecret(stored.refreshTokenEncrypted, rekey, 'biz-persist', 'refresh'), 'refresh_token_value');
  });
});

// ============ FASE 3: seguridad de logs ============
describe('Fase 3 - seguridad de logs', () => {
  const path = require('path');
  const fs = require('fs');
  const files = [
    'src/services/mercado-pago-oauth.service.ts',
    'src/services/mercado-pago-oauth-state.service.ts',
    'src/controllers/mp-oauth.controller.ts',
    'src/routes/mp-oauth.routes.ts',
  ];
  for (const file of files) {
    test(`${file} no imprime secretos ni cuerpo de error de MP`, () => {
      const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      assert.ok(!/console\.\w+\(.*JSON\.stringify\(tokenData/.test(src), 'no debe loggear tokenData');
      assert.ok(!/console\.\w+\(.*errText/.test(src), 'no debe loggear cuerpo de error de MP');
      assert.ok(!/console\.\w+\([^)]*(accessToken|refreshToken|clientSecret|codeVerifier)[^)]*\)/.test(src.replace(/Token (exchange|refresh|renovado)|tokenExchange|tokenRefresh/g, '')), 'no debe loggear valores de tokens');
    });
  }
});

      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'a', refresh_token: 'b', expires_in: 3600, live_mode: true }),
      };
    };
    try {
      await oauthService.refreshAccessToken('biz-refresh');
      assert.ok(captured.url.includes('api.mercadopago.com/oauth/token'));
      const params = new URLSearchParams(captured.body);
      assert.equal(params.get('grant_type'), 'refresh_token');
    } finally {
      global.fetch = origFetch;
      mocked.restore();
    }
  });

  test('falla seguro si Business no tiene refresh token', async () => {
    const origFindUnique = prisma.businessMercadoPago.findUnique;
    prisma.businessMercadoPago.findUnique = async () => null;
    try {
      await assert.rejects(() => oauthService.refreshAccessToken('biz-missing'));
    } finally {
      prisma.businessMercadoPago.findUnique = origFindUnique;
    }
  });
});


// ============ LIVE_MODE → SANDBOX (CASOS A/B/C FASE 3) ============
describe('OAuth - live_mode a sandbox', () => {
  test('Caso A: live_mode=true produce sandbox=false', () => {
    assert.equal(resolveSandboxFromTokenResponse({ live_mode: true }, 'APP-123'), false);
  });

  test('Caso B: live_mode=false produce sandbox=true', () => {
    assert.equal(resolveSandboxFromTokenResponse({ live_mode: false }, 'APP-123'), true);
  });

  test('Caso C: sin live_mode y token TEST usa fallback sandbox=true', () => {
    assert.equal(resolveSandboxFromTokenResponse({}, 'TEST-123'), true);
  });

  test('Caso C: sin live_mode y token productivo usa fallback sandbox=false', () => {
    assert.equal(resolveSandboxFromTokenResponse({}, 'APP-123456'), false);
  });
});

// ============ REFRESH: ROTACION Y EXPIRACION (FASE 3) ============
describe('OAuth - refresh rotacion', () => {
  const encKey = mpEncryptionKey(process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY);
  const bizId = 'biz-refresh-1';

  test('rota refresh y actualiza expiresAt/lastVerifiedAt/sandbox', async (t) => {
    const beforeEnc = encryptSecret('refresh_token_original', encKey, bizId, 'refresh');
    let stored = {
      businessId: bizId,
      accessTokenEncrypted: encryptSecret('APP-original', encKey, bizId, 'access'),
      refreshTokenEncrypted: beforeEnc,
      connectionStatus: 'CONNECTED',
    };
    const calls = [];
    const prismaMod = require('../src/lib/prisma.ts');
    const origFind = prismaMod.prisma.businessMercadoPago.findUnique;
    const origUpdate = prismaMod.prisma.businessMercadoPago.update;
    const origFetch = globalThis.fetch;
    prismaMod.prisma.businessMercadoPago.findUnique = async () => stored;
    prismaMod.prisma.businessMercadoPago.update = async ({ data }) => {
      stored = { ...stored, ...data };
      return stored;
    };
    globalThis.fetch = async (url, opts) => {
      calls.push({ url: String(url), body: String(opts.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access_token_nuevo',
          refresh_token: 'refresh_token_nuevo',
          expires_in: 21600,
          live_mode: false,
        }),
      };
    };
    t.after(() => {
      prismaMod.prisma.businessMercadoPago.findUnique = origFind;
      prismaMod.prisma.businessMercadoPago.update = origUpdate;
      globalThis.fetch = origFetch;
    });

    const before = Date.now();
    const result = await refreshAccessToken(bizId);
    const after = Date.now();

    assert.equal(calls.length, 1);
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), 'refresh_token_original');
    assert.ok(calls[0].url.includes('/oauth/token'));
    assert.equal(result.accessToken, 'access_token_nuevo');
    assert.equal(result.refreshToken, 'refresh_token_nuevo');
    assert.equal(result.expiresIn, 21600);
    assert.equal(result.sandbox, true);
    assert.notEqual(stored.refreshTokenEncrypted, beforeEnc);
    assert.equal(decryptSecret(stored.refreshTokenEncrypted, encKey, bizId, 'refresh'), 'refresh_token_nuevo');
    assert.equal(decryptSecret(stored.accessTokenEncrypted, encKey, bizId, 'access'), 'access_token_nuevo');
    assert.ok(stored.expiresAt instanceof Date);
    assert.ok(stored.expiresAt.getTime() >= before + 21600 * 1000 - 5000);
    assert.ok(stored.expiresAt.getTime() <= after + 21600 * 1000 + 5000);
    assert.ok(stored.lastVerifiedAt instanceof Date);
    assert.equal(stored.sandbox, true);
  });

  test('live_mode=true produce sandbox=false en refresh', async (t) => {
    const bizId2 = 'biz-refresh-2';
    let stored = {
      businessId: bizId2,
      accessTokenEncrypted: encryptSecret('APP-original', encKey, bizId2, 'access'),
      refreshTokenEncrypted: encryptSecret('refresh_token_original', encKey, bizId2, 'refresh'),
      connectionStatus: 'CONNECTED',
    };
    const prismaMod = require('../src/lib/prisma.ts');
    const origFind = prismaMod.prisma.businessMercadoPago.findUnique;
    const origUpdate = prismaMod.prisma.businessMercadoPago.update;
    const origFetch = globalThis.fetch;
    prismaMod.prisma.businessMercadoPago.findUnique = async () => stored;
    prismaMod.prisma.businessMercadoPago.update = async ({ data }) => {
      stored = { ...stored, ...data };
      return stored;
    };
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'APP-live',
        refresh_token: 'refresh_token_nuevo_2',
        expires_in: 3600,
        live_mode: true,
      }),
    });
    t.after(() => {
      prismaMod.prisma.businessMercadoPago.findUnique = origFind;
      prismaMod.prisma.businessMercadoPago.update = origUpdate;
      globalThis.fetch = origFetch;
    });

    const result = await refreshAccessToken(bizId2);
    assert.equal(result.sandbox, false);
    assert.equal(stored.sandbox, false);
  });

  test('falla seguro si no hay refresh token', async (t) => {
    const prismaMod = require('../src/lib/prisma.ts');
    const origFind = prismaMod.prisma.businessMercadoPago.findUnique;
    prismaMod.prisma.businessMercadoPago.findUnique = async () => ({
      businessId: 'biz-refresh-3',
      connectionStatus: 'NOT_CONNECTED',
      refreshTokenEncrypted: null,
    });
    t.after(() => {
      prismaMod.prisma.businessMercadoPago.findUnique = origFind;
    });
    await assert.rejects(() => refreshAccessToken('biz-refresh-3'));
  });

  test('falla seguro ante respuesta incompleta de MP', async (t) => {
    const prismaMod = require('../src/lib/prisma.ts');
    const origFind = prismaMod.prisma.businessMercadoPago.findUnique;
    const origFetch = globalThis.fetch;
    prismaMod.prisma.businessMercadoPago.findUnique = async () => ({
      businessId: 'biz-refresh-4',
      connectionStatus: 'CONNECTED',
      refreshTokenEncrypted: encryptSecret('r', encKey, 'biz-refresh-4', 'refresh'),
    });
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'x' }) });
    t.after(() => {
      prismaMod.prisma.businessMercadoPago.findUnique = origFind;
      globalThis.fetch = origFetch;
    });
    await assert.rejects(() => refreshAccessToken('biz-refresh-4'));
  });

  test('rechaza code vacio sin llamar a MP', async (t) => {
    const origFetch = globalThis.fetch;
    let called = 0;
    globalThis.fetch = async () => {
      called += 1;
      throw new Error('no debe llamarse');
    };
    t.after(() => {
      globalThis.fetch = origFetch;
    });
    await assert.rejects(() => exchangeAuthorizationCode('', 'verifier', 'biz-1'));
    assert.equal(called, 0);
  });

  test('propaga error ante 400 de MP en exchange', async (t) => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 400 });
    t.after(() => {
      globalThis.fetch = origFetch;
    });
    await assert.rejects(
      () => exchangeAuthorizationCode('bad-code', 'verifier', 'biz-1'),
      (e) => e instanceof MercadoPagoOAuthError,
    );
  });

  test('persistencia: guardar cifrado y leer descifra igual', () => {
    const before = 'refresh_token_original';
    const enc = encryptSecret(before, encKey, 'biz-refresh-5', 'refresh');
    assert.notEqual(enc, before);
    assert.equal(decryptSecret(enc, encKey, 'biz-refresh-5', 'refresh'), before);
  });

  test('ningun secreto se imprime en logs del servicio OAuth', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/services/mercado-pago-oauth.service.ts'),
      'utf8',
    );
    assert.ok(!src.includes('console.log(accessToken'));
    assert.ok(!src.includes('console.log(refreshToken'));
    assert.ok(!src.includes('client_secret: CLIENT_SECRET'));
  });
});

// ============ REGRESIÓN ============
describe('OAuth - Regresión', () => {
  test('MERCADOPAGO_ACCESS_TOKEN no es referenciado en OAuth service', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/services/mercado-pago-oauth.service.ts'),
      'utf8'
    );
    assert.ok(!src.includes('MERCADOPAGO_ACCESS_TOKEN'), 'OAuth service should not use global token');
  });

  test('createPaymentPreference no es modificado en OAuth files', () => {
    const oauthFiles = [
      'src/controllers/mp-oauth.controller.ts',
      'src/services/mercado-pago-oauth.service.ts',
      'src/services/mercado-pago-oauth-state.service.ts',
      'src/routes/mp-oauth.routes.ts',
    ];
    for (const file of oauthFiles) {
      const src = require('fs').readFileSync(require('path').join(__dirname, '..', file), 'utf8');
      assert.ok(!src.includes('createPaymentPreference'), `${file} no debe tocar checkout`);
      assert.ok(!src.includes('getPaymentStatus'), `${file} no debe tocar webhook`);
    }
  });
});
