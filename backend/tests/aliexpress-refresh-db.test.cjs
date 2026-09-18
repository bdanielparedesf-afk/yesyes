const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
require('tsx/cjs');

// Explicit opt-in: three real PG clients, synthetic row, mocked OAuth, cleanup.
// No real credentials are exchanged and no business API can be called.
test('PostgreSQL: three instances use one refresh, encrypted rotation, subsequent getter and cleanup', {
  skip: process.env.ALIEXPRESS_REFRESH_DB_TEST !== '1', timeout: 90000,
}, async () => {
  const env = require('dotenv').parse(require('node:fs').readFileSync(resolve(__dirname, '../.env')));
  const { PrismaClient } = require('@prisma/client');
  const { createAliExpressTokenManager } = require('../src/services/aliexpress-token-manager.ts');
  const { exchangeRefreshToken } = require('../src/aliexpress/oauth-refresh.ts');
  const { encryptToken, decryptToken } = require('../src/aliexpress/token-crypto.ts');
  const url = new URL(env.DATABASE_URL);
  url.searchParams.set('pgbouncer', 'true'); url.searchParams.set('connection_limit', '1');
  const clients = Array.from({ length: 3 }, () => new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] }));
  const account = `refresh-test-${randomUUID()}@example.invalid`;
  const id = randomUUID(), key = randomBytes(32), at = Date.now();
  let created = false, calls = 0;
  try {
    await clients[0].aliexpressToken.create({ data: { id, account, sellerId: 'test', isActive: true,
      accessToken: encryptToken('TEST_OLD_ACCESS', key, account, 'access'),
      refreshToken: encryptToken('TEST_OLD_REFRESH', key, account, 'refresh'),
      expiresAt: new Date(at - 1000), refreshExpiresAt: new Date(at + 7200000) } });
    created = true;
    const exchange = (refresh, config, identity, _send, clock) => exchangeRefreshToken(refresh, config, identity, async () => {
      calls++; await new Promise(r => setTimeout(r, 250));
      return { code: '0', account, seller_id: 'test', access_token: 'TEST_NEW_ACCESS', refresh_token: 'TEST_NEW_REFRESH',
        expires_in: 3600, refresh_expires_in: 7200 };
    }, clock);
    const managers = clients.map(db => createAliExpressTokenManager({ db, exchange, log: () => {},
      config: () => ({ appKey: '547536', appSecret: 'TEST_SECRET', encryptionKey: key.toString('hex') }) }));
    const results = await Promise.all(managers.map(m => m.getAliExpressAccessToken(account)));
    assert.deepEqual(results, Array(3).fill('TEST_NEW_ACCESS')); assert.equal(calls, 1);
    const row = await clients[0].aliexpressToken.findUnique({ where: { id } });
    assert.match(row.accessToken, /^ae1:/); assert.match(row.refreshToken, /^ae1:/);
    assert.equal(decryptToken(row.refreshToken, key, account, 'refresh'), 'TEST_NEW_REFRESH');
    assert.ok(row.expiresAt.getTime() > at + 3500000);
    assert.equal(row.refreshExpiresAt.getTime(), at + 7200000);
    assert.equal(await managers[2].getAliExpressAccessToken(account), 'TEST_NEW_ACCESS'); assert.equal(calls, 1);
  } catch {
    // A Prisma exception may contain connection details: never report raw failure.
    assert.fail('REFRESH_POSTGRES_INTEGRATION_FAILED');
  } finally {
    try {
      if (created) {
        await clients[0].aliexpressToken.deleteMany({ where: { id, account } });
        assert.equal(await clients[0].aliexpressToken.count({ where: { id, account } }), 0);
      }
    } finally { await Promise.all(clients.map(c => c.$disconnect())); }
  }
});
