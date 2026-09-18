const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
require('tsx/cjs');
const axios = require('axios');
const { createAliExpressTokenManager } = require('../src/services/aliexpress-token-manager.ts');
const { buildRefreshRequest, exchangeRefreshToken, parseRefreshResponse } = require('../src/aliexpress/oauth-refresh.ts');
const { encryptToken, decryptToken } = require('../src/aliexpress/token-crypto.ts');
const { AliExpressOAuthError } = require('../src/aliexpress/oauth-client.ts');
const at = Date.parse('2026-09-17T12:00:00Z');
const key = Buffer.alloc(32, 9);
const identity = { account: 'test@example.invalid', sellerId: 'test-seller' };
const config = { appKey: '547536', appSecret: 'TEST_SECRET', encryptionKey: key.toString('hex') };
const raw = () => ({ code: '0', access_token: 'TEST_NEW_ACCESS', refresh_token: 'TEST_NEW_REFRESH',
  expires_in: 3600, refresh_expires_in: 7200, account: identity.account, seller_id: identity.sellerId });
const reason = expected => e => e instanceof AliExpressOAuthError && e.reason === expected;
function fixture(delta = -1, refreshDelta = 7200000, response = raw) {
  let row = { id: 'test-row', ...identity, isActive: true, expiresAt: new Date(at + delta),
    refreshExpiresAt: new Date(at + refreshDelta), accessToken: encryptToken('TEST_OLD_ACCESS', key, identity.account, 'access'),
    refreshToken: encryptToken('TEST_OLD_REFRESH', key, identity.account, 'refresh') };
  let calls = 0, writes = 0, tail = Promise.resolve();
  const events = [];
  const table = { findUnique: async () => ({ ...row }), findFirst: async q => {
    assert.equal(q.where.isActive, true); assert.equal(q.where.expiresAt, undefined); return row.isActive ? { ...row } : null;
  } };
  const db = { aliexpressToken: table, $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    const before = tail; let release; tail = new Promise(r => { release = r; }); await before;
    const snapshot = { ...row };
    try {
      let locked = false;
      return await work({ $executeRaw: async () => 0, $queryRaw: async (strings, account) => {
        assert.match(strings.join('?'), /FOR UPDATE/); assert.equal(account, identity.account); locked = true; return [{ id: row.id }];
      }, aliexpressToken: { findUnique: async () => { assert.ok(locked); return { ...row }; },
        update: async q => { writes++; assert.equal(q.data.isActive, undefined); Object.assign(row, q.data); return { id: row.id }; } } });
    } catch (e) { row = snapshot; throw e; } finally { release(); }
  } };
  const exchange = (token, cfg, id, _send, clock) => exchangeRefreshToken(token, cfg, id, async req => {
    calls++; assert.equal(new URL(req.url).search, '');
    assert.equal(new URLSearchParams(req.body).get('refresh_token'), 'TEST_OLD_REFRESH');
    await new Promise(r => setTimeout(r, 10)); return response();
  }, clock);
  const deps = { db, exchange, config: () => config, now: () => new Date(at), log: e => events.push(e) };
  return { manager: createAliExpressTokenManager(deps), deps, row: () => row, calls: () => calls, writes: () => writes, events };
}

test('A valid token does not refresh', async () => {
  const f = fixture(60001); assert.equal(await f.manager.getAliExpressAccessToken(), 'TEST_OLD_ACCESS'); assert.equal(f.calls(), 0);
});
for (const [name, delta] of [['B near expiry', 60000], ['C expired', -1]]) test(name, async () => {
  const f = fixture(delta); assert.equal(await f.manager.getAliExpressAccessToken(identity.account), 'TEST_NEW_ACCESS'); assert.equal(f.calls(), 1);
});
test('D expired refresh rejects repeatedly without network', async () => {
  const f = fixture(-1, 0);
  for (let i = 0; i < 3; i++) await assert.rejects(f.manager.getAliExpressAccessToken(), reason('REFRESH_TOKEN_EXPIRED'));
  assert.equal(f.calls(), 0); assert.equal(f.writes(), 0);
});
test('E rotation encrypts both tokens and subsequent getter uses new access', async () => {
  const f = fixture(); await f.manager.getAliExpressAccessToken();
  const row = f.row(); assert.match(row.accessToken, /^ae1:/); assert.match(row.refreshToken, /^ae1:/);
  assert.equal(decryptToken(row.refreshToken, key, identity.account, 'refresh'), 'TEST_NEW_REFRESH');
  assert.equal(decryptToken(row.accessToken, key, identity.account, 'access'), 'TEST_NEW_ACCESS');
  assert.equal(row.expiresAt.getTime(), at + 3600000); assert.equal(row.refreshExpiresAt.getTime(), at + 7200000);
  assert.equal(await f.manager.getAliExpressAccessToken(), 'TEST_NEW_ACCESS'); assert.equal(f.calls(), 1);
  assert.equal(f.events.at(-1).resultado, 'TOKEN_REFRESH_SUCCESS');
  assert.doesNotMatch(JSON.stringify(f.events), /TEST_SECRET|TEST_NEW|TEST_OLD|ae1:/);
});
test('F rejected refresh preserves credentials and expiration', async () => {
  const f = fixture(-1, 7200000, () => ({ code: 'InvalidRefreshToken', message: 'TEST_PRIVATE' })); const old = { ...f.row() };
  await assert.rejects(f.manager.getAliExpressAccessToken(), reason('TOKEN_REFRESH_FAILED'));
  assert.deepEqual(f.row(), old); assert.equal(f.writes(), 0); assert.equal(f.calls(), 1);
});
test('G incomplete response never writes', async () => {
  for (const field of ['access_token', 'refresh_token', 'expires_in', 'refresh_expires_in']) {
    const f = fixture(-1, 7200000, () => { const r = raw(); delete r[field]; return r; });
    await assert.rejects(f.manager.getAliExpressAccessToken(), reason('OAUTH_CONTRACT_ERROR')); assert.equal(f.writes(), 0);
  }
});
test('H three independent managers serialize through shared DB, one refresh', async () => {
  const f = fixture(); const managers = [f.manager, createAliExpressTokenManager(f.deps), createAliExpressTokenManager(f.deps)];
  assert.deepEqual(await Promise.all(managers.map(m => m.getAliExpressAccessToken())), Array(3).fill('TEST_NEW_ACCESS'));
  assert.equal(f.calls(), 1); assert.equal(f.writes(), 1);
});

test('inactive account never refreshes or reactivates', async () => {
  const f = fixture(); f.row().isActive = false;
  await assert.rejects(f.manager.getAliExpressAccessToken(identity.account), reason('OAUTH_CONFIGURATION_ERROR'));
  assert.equal(f.calls(), 0); assert.equal(f.row().isActive, false);
});
test('signature uses OAuth path and exactly the official parameters', () => {
  const request = buildRefreshRequest(config, 'TEST_á +&=', at);
  assert.equal(request.url, 'https://api-sg.aliexpress.com/rest/auth/token/refresh');
  const p = Object.fromEntries(new URLSearchParams(request.body));
  assert.deepEqual(Object.keys(p).sort(), ['app_key', 'refresh_token', 'sign', 'sign_method', 'timestamp']);
  const canonical = '/auth/token/refreshapp_key547536refresh_tokenTEST_á +&=sign_methodsha256timestamp' + at;
  assert.equal(p.sign, createHmac('sha256', config.appSecret).update(canonical, 'utf8').digest('hex').toUpperCase());
  assert.ok(!request.body.includes(config.appSecret));
});
test('absolute dates must match duration; identity mismatches rejected; zero refresh disables renewal', () => {
  for (const divisor of [1, 1000]) {
    const grant = parseRefreshResponse({ ...raw(), expire_time: (at + 3600000) / divisor,
      refresh_token_valid_time: (at + 7200000) / divisor }, new Date(at), identity);
    assert.equal(grant.expiresAt.getTime(), at + 3600000);
  }
  for (const patch of [{ expire_time: 123 }, { account: 'other' }, { seller_id: 'other' }]) {
    assert.throws(() => parseRefreshResponse({ ...raw(), ...patch }, new Date(at), identity), reason('OAUTH_CONTRACT_ERROR'));
  }
  const grant = parseRefreshResponse({ ...raw(), refresh_expires_in: 0 }, new Date(at), identity);
  assert.equal(grant.refreshExpiresAt.getTime(), at);
});
test('refresh lifetime is not extended by rotation', async () => {
  const f = fixture(-1, 100000); await f.manager.getAliExpressAccessToken();
  assert.equal(f.row().refreshExpiresAt.getTime(), at + 100000);
});
test('timeout/network errors are sanitized: one attempt and no redirects', async t => {
  let calls = 0;
  t.mock.method(axios, 'post', async (url, body, options) => {
    calls++; assert.equal(options.timeout, 15000); assert.equal(options.maxRedirects, 0);
    assert.equal(url, 'https://api-sg.aliexpress.com/rest/auth/token/refresh');
    throw new axios.AxiosError('TEST_PRIVATE', 'ETIMEDOUT');
  });
  await assert.rejects(exchangeRefreshToken('TEST_REFRESH', config, identity), e => {
    assert.equal(e.reason, 'OAUTH_NETWORK_ERROR'); assert.doesNotMatch(JSON.stringify(e), /TEST_PRIVATE/); return true;
  });
  assert.equal(calls, 1);
});
test('storage failure cannot emit success or expose raw error', async () => {
  const f = fixture(); f.deps.db.$transaction = async () => { throw new Error('TEST_PRIVATE'); };
  await assert.rejects(f.manager.getAliExpressAccessToken(), reason('OAUTH_STORAGE_ERROR'));
  assert.equal(f.events.some(e => e.resultado === 'TOKEN_REFRESH_SUCCESS'), false);
});
test('missing config prevents network and OAuth errors retain their category in imports', async () => {
  let calls = 0;
  await assert.rejects(exchangeRefreshToken('TEST_REFRESH', { ...config, appSecret: '' }, identity,
    async () => { calls++; }), reason('OAUTH_CONFIGURATION_ERROR'));
  assert.equal(calls, 0);
  const { sanitizeImportError } = require('../src/services/aliexpress-dropship.service.ts');
  assert.equal(sanitizeImportError(new AliExpressOAuthError('REFRESH_TOKEN_EXPIRED')), 'REFRESH_TOKEN_EXPIRED');
});
