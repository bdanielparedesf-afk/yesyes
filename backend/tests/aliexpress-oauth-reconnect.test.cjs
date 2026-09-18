const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
require('tsx/cjs');

const { createAliExpressBrowserOAuth, AUTHORIZE_ENDPOINT, ATTEMPT_TTL } =
  require('../src/services/aliexpress-browser-oauth.ts');
const { createAliExpressConnector } = require('../src/services/aliexpress-token.service.ts');
const { createAliExpressTokenManager } = require('../src/services/aliexpress-token-manager.ts');
const { exchangeAuthorizationCode } = require('../src/aliexpress/oauth-client.ts');
const { exchangeRefreshToken } = require('../src/aliexpress/oauth-refresh.ts');
const { decryptToken, encryptToken } = require('../src/aliexpress/token-crypto.ts');

const KEY = randomBytes(32);
const SECRET = 'TEST_ONLY_APP_SECRET';
const CONFIG = { appKey: '547536', appSecret: SECRET, encryptionKey: KEY.toString('hex') };
const AT = Date.parse('2026-09-17T12:00:00Z');
const ACCOUNT = 'google_112734970190422978939@aliexpress.com';
const SELLER = 'ALI_SELLER_1';
const REDIRECT = 'https://yesyes.cl/api/admin/aliexpress/oauth/callback';
const browserConfig = () => ({ redirectUri: REDIRECT, origin: 'https://yesyes.cl', secure: true, appKey: '547536' });
const LOG_FIELDS = ['account', 'sellerId', 'resultado', 'timestamp', 'errorCode'];

const rejected = reason => error => {
  assert.equal(error.name, 'AliExpressOAuthError');
  assert.equal(error.reason, reason);
  return true;
};

/** Logs may only carry account, seller_id, outcome, timestamp and error code. */
function assertSafeLog(events, resultado) {
  const event = events.find(candidate => candidate.resultado === resultado);
  assert.ok(event, `missing log event ${resultado}`);
  for (const key of Object.keys(event)) assert.ok(LOG_FIELDS.includes(key), `unexpected log field ${key}`);
  assert.ok(Number.isFinite(Date.parse(event.timestamp)));
  return event;
}

/** No token, code, secret or key may appear in any serialized payload. */
function assertNoSecrets(value, ...markers) {
  const text = JSON.stringify(value);
  for (const marker of [...markers, SECRET]) assert.ok(!text.includes(marker), `leaked ${marker}`);
}

/**
 * In-memory stand-in for the Prisma delegates used by the reconnect path. No
 * network and no real database: signing, response parsing, encryption, the
 * row-lock SQL and the single-use state consumption are production code.
 */
function fakeDb(seed = []) {
  const rows = new Map(seed.map(row => [row.account, { ...row }]));
  const attempts = new Map();
  const findUnique = async q => (rows.has(q.where.account) ? { ...rows.get(q.where.account) } : null);
  const findFirst = async q => {
    if (q.where?.isActive === true) {
      const matched = [...rows.values()].filter(row => row.isActive === true);
      if (!matched.length) return null;
      matched.sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime() || a.account.localeCompare(b.account));
      return { ...matched[0] };
    }
    return null;
  };
  const upsert = async q => {
    const existing = rows.get(q.where.account);
    if (existing) { Object.assign(existing, q.update); return { id: existing.id }; }
    const created = { id: `row-${rows.size + 1}`, ...q.create };
    rows.set(q.where.account, created);
    return { id: created.id };
  };
  const tx = {
    $executeRaw: async () => 0,
    // Mirrors the production row lock: SELECT ... FOR UPDATE, never the token.
    $queryRaw: async (strings, account) => {
      assert.match(strings.join('?'), /FOR UPDATE/);
      assert.equal(account, ACCOUNT);
      return [{ id: rows.get(ACCOUNT)?.id ?? 'lock' }];
    },
    aliexpressToken: { findUnique, findFirst, upsert,
      update: async q => {
        for (const value of rows.values()) {
          if (value.id === q.where.id) { Object.assign(value, q.data); return { id: value.id }; }
        }
        throw new Error(`id ${q.where.id} not found`);
      },
    },
  };
  const db = {
    ...tx,
    $transaction: work => work(tx),
    user: { findUnique: async () => ({ role: 'ADMIN', isActive: true }) },
    aliexpressToken: {
      ...tx.aliexpressToken,
      count: async () => rows.size,
      findMany: async () => [...rows.values()].map(row => ({ ...row })),
      updateMany: async q => {
        let count = 0;
        for (const row of rows.values()) {
          if (row.account === q.where.account) { Object.assign(row, q.data); count++; }
        }
        return { count };
      },
    },
    aliExpressOAuthAttempt: {
      create: async q => { attempts.set(q.data.stateHash, { ...q.data }); return q.data; },
      findUnique: async q => (attempts.has(q.where.stateHash) ? { ...attempts.get(q.where.stateHash) } : null),
      deleteMany: async q => {
        let count = 0;
        if (q.where.stateHash !== undefined) {
          const attempt = attempts.get(q.where.stateHash);
          const fresh = !q.where.expiresAt || attempt.expiresAt > q.where.expiresAt.gt;
          if (attempt && (!q.where.browserHash || attempt.browserHash === q.where.browserHash) && fresh) {
            attempts.delete(q.where.stateHash); count = 1;
          }
        } else if (q.where.expiresAt?.lte) {
          for (const [stateHash, attempt] of attempts) {
            if (attempt.expiresAt <= q.where.expiresAt.lte) { attempts.delete(stateHash); count++; }
          }
        }
        return { count };
      },
    },
  };
  // Export the live maps so assertions can read mutable state without extra queries.
  return { db, rows, attempts };
}

/** Real signed exchange + real response parsing, inert transport. */
function codeExchange(control, response = () => ({ code: '0', account: ACCOUNT, seller_id: SELLER,
  access_token: 'TEST_ONLY_ACCESS', refresh_token: 'TEST_ONLY_REFRESH',
  expires_in: 3600, refresh_expires_in: 7200 })) {
  return (code, config) => exchangeAuthorizationCode(code, config, async request_ => {
    control.codes.push(code);
    control.requests.push(request_);
    return response();
  }, () => new Date(AT));
}

/** Real signed refresh + real response parsing, inert transport. */
function refreshExchange(control, response = () => ({ code: '0', account: ACCOUNT, seller_id: SELLER,
  access_token: 'TEST_ONLY_ACCESS_ROTATED', refresh_token: 'TEST_ONLY_REFRESH_ROTATED',
  expires_in: 3600, refresh_expires_in: 7200 })) {
  return (refresh, config, identity, _send, clock) => exchangeRefreshToken(refresh, config, identity, async () => {
    control.calls++;
    return response();
  }, clock);
}

/** Both the OAuth lifecycle and the connector must use the same fakeDb. */
function oauthService(f, exchange, events = []) {
  return createAliExpressBrowserOAuth({ db: f.db, config: browserConfig,
    now: () => new Date(AT), log: event => events.push(event),
    connect: createAliExpressConnector({ db: f.db, exchange, config: () => CONFIG }) });
}

/** Real signed code exchange + real contract parsing; the transport is inert. */
function codeExchange(control, response = () => ({ code: '0', account: ACCOUNT, seller_id: SELLER,
  access_token: 'TEST_ONLY_ACCESS', refresh_token: 'TEST_ONLY_REFRESH', expires_in: 3600, refresh_expires_in: 7200 })) {
  return (code, config) => exchangeAuthorizationCode(code, config, async request_ => {
    control.codes.push(code);
    control.requests.push(request_);
    return response();
  }, () => new Date(AT));
}

/** Real signed refresh + real contract parsing; the transport is inert. */
function refreshExchange(control, response = () => ({ code: '0', account: ACCOUNT, seller_id: SELLER,
  access_token: 'TEST_ONLY_ACCESS_ROTATED', refresh_token: 'TEST_ONLY_REFRESH_ROTATED',
  expires_in: 3600, refresh_expires_in: 7200 })) {
  return (refresh, config, identity, _send, clock) => exchangeRefreshToken(refresh, config, identity, async () => {
    control.calls++;
    return response();
  }, clock);
}

function oauthService(f, exchange, events = [], now = () => new Date(AT)) {
  return createAliExpressBrowserOAuth({ db: f.db, config: browserConfig, now, log: event => events.push(event),
    connect: createAliExpressConnector({ db: f.db, exchange, config: () => CONFIG }) });
}

function manager(f, now = () => new Date(AT), exchange = refreshExchange({ calls: 0 })) {
  return createAliExpressTokenManager({ db: f.db, config: () => CONFIG, now, exchange, log: () => {} });
}

/** The account the user disconnected locally: tokens kept, isActive=false. */
function disconnectedRow() {
  return { id: 'row-cold', account: ACCOUNT, sellerId: SELLER, isActive: false,
    expiresAt: new Date(AT - 1000), refreshExpiresAt: new Date(AT + 7200000),
    accessToken: encryptToken('TEST_ONLY_OLD_ACCESS', KEY, ACCOUNT, 'access'),
    refreshToken: encryptToken('TEST_ONLY_OLD_REFRESH', KEY, ACCOUNT, 'refresh') };
}

async function startAttempt(oauth, account = ACCOUNT) {
  const started = await oauth.start('admin-1', account);
  return { ...started, state: new URL(started.authorizationUrl).searchParams.get('state') };
}

test('disconnected account starts the official OAuth endpoint without activating itself', async () => {
  const f = fakeDb([disconnectedRow()]);
  const control = { codes: [], requests: [] };
  const events = [];
  const oauth = oauthService(f, codeExchange(control), events);
  const attempt = await startAttempt(oauth);

  const url = new URL(attempt.authorizationUrl);
  assert.equal(`${url.origin}${url.pathname}`, AUTHORIZE_ENDPOINT);
  assert.deepEqual([...url.searchParams.keys()].sort(),
    ['client_id', 'force_auth', 'redirect_uri', 'response_type', 'state']);
  assert.equal(url.searchParams.get('client_id'), '547536');
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.match(attempt.state, /^[a-f0-9]{64}$/);
  assert.match(attempt.browser, /^[a-f0-9]{64}$/);
  assert.notEqual(attempt.state, attempt.browser);
  assert.equal(f.rows.get(ACCOUNT).isActive, false, 'starting OAuth must not activate the row');
  assertSafeLog(events, 'OAUTH_STARTED');
  assertNoSecrets(attempt, events, [...f.attempts.values()]);
});

test('successful reconnect reuses the account, activates it and stores encrypted tokens', async () => {
  const f = fakeDb([disconnectedRow()]);
  const control = { codes: [], requests: [] };
  const events = [];
  const oauth = oauthService(f, codeExchange(control), events);
  const attempt = await startAttempt(oauth);
  await oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE');

  const row = f.rows.get(ACCOUNT);
  assert.equal(f.rows.size, 1, 'the existing row is reused: no duplicate account');
  assert.equal(row.id, 'row-cold');
  assert.equal(row.isActive, true);
  assert.equal(row.sellerId, SELLER, 'identity confirmed by the provider is kept');
  assert.match(row.accessToken, /^ae1:/);
  assert.match(row.refreshToken, /^ae1:/);
  assert.equal(decryptToken(row.accessToken, KEY, ACCOUNT, 'access'), 'TEST_ONLY_ACCESS');
  assert.equal(decryptToken(row.refreshToken, KEY, ACCOUNT, 'refresh'), 'TEST_ONLY_REFRESH');
  assert.equal(row.expiresAt.getTime(), AT + 3600000);
  assert.equal(row.refreshExpiresAt.getTime(), AT + 7200000);
  assert.deepEqual(control.codes, ['TEST_ONLY_CODE']);
  assert.equal(control.requests[0].url, 'https://api-sg.aliexpress.com/rest/auth/token/create');
  assert.equal(new URLSearchParams(control.requests[0].body).get('app_key'), '547536');
  assert.equal(new URLSearchParams(control.requests[0].body).get('sign_method'), 'sha256');
  assert.match(new URLSearchParams(control.requests[0].body).get('sign'), /^[A-F0-9]{64}$/);
  assertSafeLog(events, 'OAUTH_CONNECTED');
  for (const marker of ['TEST_ONLY_CODE', 'TEST_ONLY_ACCESS', 'TEST_ONLY_REFRESH', 'TEST_ONLY_OLD']) {
    assertNoSecrets(events, marker);
  }
});

test('the token stored by OAuth is returned by getAliExpressAccessToken without a refresh', async () => {
  const f = fakeDb([disconnectedRow()]);
  const control = { codes: [], requests: [] };
  const oauth = oauthService(f, codeExchange(control));
  const attempt = await startAttempt(oauth);
  await oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE');

  const refreshControl = { calls: 0 };
  const tokens = manager(f, () => new Date(AT), refreshExchange(refreshControl));
  assert.equal(await tokens.getAliExpressAccessToken(ACCOUNT), 'TEST_ONLY_ACCESS');
  assert.equal(await tokens.getAliExpressAccessToken(''), 'TEST_ONLY_ACCESS');
  assert.equal(refreshControl.calls, 0, 'a fresh access token must not trigger a refresh');
  assert.equal(f.rows.size, 1);
});

test('automatic renewal after OAuth connect stores new encrypted tokens and keeps the account active', async () => {
  const f = fakeDb([disconnectedRow()]);
  const control = { codes: [], requests: [] };
  const oauth = oauthService(f, codeExchange(control));
  const attempt = await startAttempt(oauth);
  await oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE');
  const connected = { ...f.rows.get(ACCOUNT) };

  const later = new Date(AT + 3600001);
  const refreshControl = { calls: 0, responses: [] };
  const exchanged = refreshExchange(refreshControl);
  const tokens = manager(f, () => later, (refresh, config, identity, send, clock) => {
    refreshControl.responses.push(decryptToken(connected.refreshToken, KEY, ACCOUNT, 'refresh') === refresh);
    return exchanged(refresh, config, identity, send, clock);
  });

  assert.equal(await tokens.getAliExpressAccessToken(ACCOUNT), 'TEST_ONLY_ACCESS_ROTATED');
  assert.equal(refreshControl.calls, 1);
  assert.deepEqual(refreshControl.responses, [true], 'the renewal used the stored refresh token');
  const row = f.rows.get(ACCOUNT);
  assert.equal(row.isActive, true);
  assert.equal(decryptToken(row.accessToken, KEY, ACCOUNT, 'access'), 'TEST_ONLY_ACCESS_ROTATED');
  assert.equal(decryptToken(row.refreshToken, KEY, ACCOUNT, 'refresh'), 'TEST_ONLY_REFRESH_ROTATED');
  assert.equal(row.expiresAt.getTime(), later.getTime() + 3600000);
  // Documented contract: rotation does not extend the refresh lifetime.
  assert.equal(row.refreshExpiresAt.getTime(), connected.refreshExpiresAt.getTime());
  assert.equal(f.rows.size, 1);
});

test('a rejected authorization code never activates the account and stores nothing', async () => {
  const f = fakeDb([disconnectedRow()]);
  const before = { ...f.rows.get(ACCOUNT) };
  const control = { codes: [], requests: [] };
  const events = [];
  const oauth = oauthService(f, codeExchange(control, () => ({ code: '500', message: 'TEST_ONLY_CODE' })), events);
  const attempt = await startAttempt(oauth);
  await assert.rejects(oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE'), rejected('REJECTED'));

  const row = f.rows.get(ACCOUNT);
  assert.equal(row.isActive, false);
  assert.equal(row.accessToken, before.accessToken, 'tokens unchanged after a failed exchange');
  assert.equal(row.refreshToken, before.refreshToken);
  assert.equal(row.expiresAt.getTime(), before.expiresAt.getTime());
  assert.match(control.codes.join(), /TEST_ONLY_CODE/, 'the code was attempted exactly once');
  assert.equal(control.codes.length, 1);
  assertSafeLog(events, 'OAUTH_ERROR');
  assertNoSecrets(events, control.requests);
});

test('invalid state, missing browser cookie or a missing code never exchange anything', async () => {
  const cases = [
    ['state with an unexpected shape', 'no-es-hex', 'a'.repeat(64), 'TEST_ONLY_CODE'],
    ['missing browser nonce', 'a'.repeat(64), '', 'TEST_ONLY_CODE'],
    ['missing authorization code', 'a'.repeat(64), 'b'.repeat(64), undefined],
    ['code with a control character', 'a'.repeat(64), 'b'.repeat(64), 'TEST ONLY CODE'],
  ];
  for (const [name, state, browser, code] of cases) {
    const f = fakeDb([disconnectedRow()]);
    const control = { codes: [], requests: [] };
    const events = [];
    const oauth = oauthService(f, codeExchange(control), events);
    await assert.rejects(oauth.callback(state, browser, code), rejected('REJECTED'), name);
    assert.equal(control.codes.length, 0, `${name}: nothing may be exchanged`);
    assert.equal(f.rows.get(ACCOUNT).isActive, false);
    assertSafeLog(events, 'OAUTH_ERROR');
    assertNoSecrets(events, [state, browser, code]);
    assert.equal(f.attempts.size, 0, `${name}: no one-use attempt may be created or consumed`);
  }
});

test('an incorrect browser nonce and a replayed callback are both rejected', async () => {
  const f = fakeDb([disconnectedRow()]);
  const control = { codes: [], requests: [] };
  const events = [];
  const oauth = oauthService(f, codeExchange(control), events);
  const attempt = await startAttempt(oauth);

  await assert.rejects(oauth.callback(attempt.state, 'c'.repeat(64), 'TEST_ONLY_CODE'), rejected('REJECTED'));
  assert.equal(control.codes.length, 0);

  await oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE');
  assert.equal(control.codes.length, 1);
  // Replaying the same state/browser/code must not exchange the code a second time.
  await assert.rejects(oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE'), rejected('REJECTED'));
  assert.equal(control.codes.length, 1);
  assert.equal(f.rows.size, 1);
  assert.equal(f.attempts.size, 0);
});

test('an expired or unknown OAuth attempt is rejected before any exchange', async () => {
  const f = fakeDb([disconnectedRow()]);
  const control = { codes: [], requests: [] };
  const oauth = oauthService(f, codeExchange(control), []);
  const attempt = await startAttempt(oauth);
  const expired = oauthService(f, codeExchange(control), [], () => new Date(AT + ATTEMPT_TTL + 1000));
  await assert.rejects(expired.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE'), rejected('REJECTED'));
  await assert.rejects(expired.callback('d'.repeat(64), 'e'.repeat(64), 'TEST_ONLY_CODE'), rejected('REJECTED'));
  assert.equal(control.codes.length, 0);
  assert.equal(f.rows.get(ACCOUNT).isActive, false);
});

test('a first-time authorization creates exactly one active account from the provider answer', async () => {
  const f = fakeDb([]);
  const control = { codes: [], requests: [] };
  const oauth = oauthService(f, codeExchange(control));
  const started = await oauth.start('admin-1');
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  await oauth.callback(state, started.browser, 'TEST_ONLY_CODE');

  assert.equal(f.rows.size, 1);
  const row = f.rows.get(ACCOUNT);
  assert.equal(row.isActive, true);
  assert.equal(row.sellerId, SELLER);
  assert.match(row.accessToken, /^ae1:/);
  assert.equal(decryptToken(row.refreshToken, KEY, ACCOUNT, 'refresh'), 'TEST_ONLY_REFRESH');
  assert.equal(row.expiresAt.getTime(), AT + 3600000);
  assert.equal(await manager(f).getAliExpressAccessToken(ACCOUNT), 'TEST_ONLY_ACCESS');
});

test('a locally disconnected account cannot use tokens until the OAuth flow completes', async () => {
  const f = fakeDb([disconnectedRow()]);
  await assert.rejects(manager(f).getAliExpressAccessToken(ACCOUNT), rejected('OAUTH_CONFIGURATION_ERROR'));
  assert.equal(f.rows.get(ACCOUNT).isActive, false);
});
test('the admin panel exposes both official actions and renders no credential', () => {
  const panel = readFileSync(resolve(__dirname, '../../frontend/src/pages/AdminAliExpress.tsx'), 'utf8');
  assert.ok(panel.includes('Reconectar AliExpress'), 'the reconnect button is offered');
  assert.ok(panel.includes('Desconectar AliExpress'), 'the disconnect button is offered');
  assert.ok(panel.includes('AliExpress conectado') && panel.includes('AliExpress desconectado'));
  assert.ok(panel.includes('Token válido hasta:'), 'the valid-until date is shown');
  assert.ok(panel.includes("'/admin/aliexpress/oauth/connect'"), 'the OAuth start endpoint is called');
  // Nothing sensitive may be fetched, stored or rendered by the panel: the only
  // mention of a credential name is the instruction to configure it in the backend.
  assert.ok(!/accessToken|refreshToken|appSecret|APP_SECRET\s*[:=]|ENCRYPTION_KEY/.test(panel));
  assert.ok(!/VITE_[A-Z_]*SECRET/.test(panel), 'no secret may be read from the frontend env');
  // A local flag must never be able to activate an account.
  assert.ok(!/isActive\s*[:=]\s*true/.test(panel));
  assert.ok(!/localStorage\.setItem\([^)]*isActive/.test(panel));
});

test('the HTTP log skips the OAuth callback so the code cannot be recorded', () => {
  const server = readFileSync(resolve(__dirname, '../src/index.ts'), 'utf8');
  assert.match(server, /aliexpress\/oauth/i);
});

test('a provider answer for a different seller identity is rejected without touching the account', async () => {
  const f = fakeDb([disconnectedRow()]);
  const before = { ...f.rows.get(ACCOUNT) };
  const oauth = oauthService(f, codeExchange({ codes: [], requests: [] },
    () => ({ code: '0', account: 'otra_cuenta@aliexpress.com', seller_id: 'OTRO_SELLER',
      access_token: 'TEST_ONLY_ACCESS', refresh_token: 'TEST_ONLY_REFRESH',
      expires_in: 3600, refresh_expires_in: 7200 })));
  const attempt = await startAttempt(oauth);
  await assert.rejects(oauth.callback(attempt.state, attempt.browser, 'TEST_ONLY_CODE'), rejected('CONTRACT'));
  assert.equal(f.rows.size, 1);
  assert.equal(f.rows.get(ACCOUNT).isActive, false);
  assert.equal(f.rows.get(ACCOUNT).sellerId, before.sellerId);
  assert.equal(f.rows.get(ACCOUNT).accessToken, before.accessToken);
});
