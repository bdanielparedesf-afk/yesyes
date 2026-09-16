const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
require('tsx/cjs');

// Explicit opt-in: writes only inside a transaction that is always rolled back.
test('Supabase: OAuth fixture persists encrypted, RLS blocks browser roles, rollback leaves no row', {
  skip: process.env.ALIEXPRESS_DB_TEST !== '1', timeout: 30000,
}, async () => {
  require('dotenv').config();
  const { prisma } = require('../src/lib/prisma.ts');
  const { exchangeAuthorizationCode } = require('../src/aliexpress/oauth-client.ts');
  const { saveAliExpressGrant } = require('../src/services/aliexpress-token.service.ts');
  const { decryptToken } = require('../src/aliexpress/token-crypto.ts');
  const account = `rollback-${randomUUID()}@example.invalid`;
  const key = randomBytes(32);
  const rollback = new Error('INTENTIONAL_TEST_ROLLBACK');
  try {
    const security = await prisma.$queryRawUnsafe("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid=to_regclass('public.aliexpress_tokens')");
    assert.equal(security[0].relrowsecurity, true);
    assert.equal(security[0].relforcerowsecurity, true);
    const roles = await prisma.$queryRawUnsafe("SELECT rolname, has_table_privilege(rolname, 'public.aliexpress_tokens', 'SELECT') AS can_select, has_table_privilege(rolname, 'public.aliexpress_tokens', 'INSERT') AS can_insert FROM pg_roles WHERE rolname IN ('anon','authenticated')");
    assert.equal(roles.length, 2);
    for (const role of roles) { assert.equal(role.can_select, false); assert.equal(role.can_insert, false); }
    const grant = await exchangeAuthorizationCode('TEST_ONLY_CODE', { appKey: '547536', appSecret: 'TEST_ONLY_SECRET' }, async () => ({
      code: '0', account, seller_id: 'test', access_token: 'TEST_ONLY_ACCESS', refresh_token: 'TEST_ONLY_REFRESH', expires_in: 3600, refresh_expires_in: 7200,
    }));
    await assert.rejects(prisma.$transaction(async tx => {
      await saveAliExpressGrant(grant, key, tx);
      const row = await tx.aliexpressToken.findUnique({ where: { account } });
      assert.ok(row);
      assert.notEqual(row.accessToken, grant.accessToken);
      assert.notEqual(row.refreshToken, grant.refreshToken);
      assert.equal(decryptToken(row.accessToken, key, account, 'access'), grant.accessToken);
      assert.equal(decryptToken(row.refreshToken, key, account, 'refresh'), grant.refreshToken);
      const updated = { ...grant, accessToken: 'TEST_ONLY_ACCESS_UPDATED' };
      await saveAliExpressGrant(updated, key, tx);
      assert.equal(await tx.aliexpressToken.count({ where: { account } }), 1);
      assert.equal(decryptToken((await tx.aliexpressToken.findUnique({ where: { account } })).accessToken, key, account, 'access'), updated.accessToken);
      throw rollback;
    }, { timeout: 15000 }), error => error === rollback);
    assert.equal(await prisma.aliexpressToken.count({ where: { account } }), 0);
  } finally { await prisma.$disconnect(); }
});
