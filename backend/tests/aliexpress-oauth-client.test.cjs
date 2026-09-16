const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const axios = require('axios');
const { exchangeAuthorizationCode, parseTokenResponse, AliExpressOAuthError } = require('../src/aliexpress/oauth-client.ts');
const config = { appKey: '547536', appSecret: 'TEST_ONLY_SECRET' };
const now = () => new Date('2026-09-16T12:00:00Z');
const fixture = () => ({ code: '0', account: 'test@example.invalid', seller_id: '123',
  access_token: 'TEST_ONLY_ACCESS', refresh_token: 'TEST_ONLY_REFRESH', expires_in: '3600', refresh_expires_in: '7200' });
const safeError = reason => error => {
  assert.ok(error instanceof AliExpressOAuthError);
  assert.equal(error.reason, reason);
  assert.doesNotMatch(String(error) + JSON.stringify(error), /TEST_ONLY|PRIVATE_MARKER/);
  return true;
};

test('one signed request maps documented success and relative expirations', async () => {
  let calls = 0;
  const grant = await exchangeAuthorizationCode('TEST_ONLY_CODE', config, async request => {
    calls++;
    assert.equal(request.method, 'POST');
    assert.equal(request.url, 'https://api-sg.aliexpress.com/rest/auth/token/create');
    const body = new URLSearchParams(request.body);
    assert.equal(body.get('timestamp'), String(now().getTime()));
    assert.equal(body.get('sign_method'), 'sha256');
    assert.equal(body.get('code'), 'TEST_ONLY_CODE');
    assert.match(body.get('sign'), /^[A-F0-9]{64}$/);
    assert.ok(!request.body.includes(config.appSecret));
    return fixture();
  }, now);
  assert.equal(calls, 1);
  assert.equal(grant.accessToken, 'TEST_ONLY_ACCESS');
  assert.equal(grant.refreshToken, 'TEST_ONLY_REFRESH');
  assert.equal(grant.expiresAt.toISOString(), '2026-09-16T13:00:00.000Z');
  assert.equal(grant.refreshExpiresAt.toISOString(), '2026-09-16T14:00:00.000Z');
});

test('numeric durations and zero refresh lifetime are supported without inventing refresh', () => {
  const grant = parseTokenResponse({ ...fixture(), code: 0, expires_in: 10,
    refresh_expires_in: 0, refresh_token: undefined, seller_id: undefined }, now());
  assert.equal(grant.refreshToken, '');
  assert.equal(grant.sellerId, null);
  assert.equal(grant.refreshExpiresAt.getTime(), now().getTime());
});

test('malformed responses and durations fail closed', () => {
  for (const raw of [null, [], {}, '<html>PRIVATE_MARKER</html>',
    { ...fixture(), access_token: '' }, { ...fixture(), expires_in: 0 },
    { ...fixture(), expires_in: -1 }, { ...fixture(), expires_in: 'NaN' },
    { ...fixture(), refresh_expires_in: undefined }, { ...fixture(), refresh_token: undefined }]) {
    assert.throws(() => parseTokenResponse(raw, now()), safeError('CONTRACT'));
  }
  assert.throws(() => parseTokenResponse(fixture(), new Date(NaN)), safeError('CONTRACT'));
});

test('HTTP-200 business rejection never leaks response or retries code', async () => {
  let calls = 0;
  await assert.rejects(exchangeAuthorizationCode('TEST_ONLY_CODE', config, async () => {
    calls++; return { code: 'InvalidCode', message: 'PRIVATE_MARKER', access_token: 'TEST_ONLY_ACCESS' };
  }, now), safeError('REJECTED'));
  assert.equal(calls, 1);
});

test('transport failures and timeouts are single attempt and safe', async () => {
  for (const failure of [new Error('PRIVATE_MARKER'), new AliExpressOAuthError('TIMEOUT')]) {
    let calls = 0;
    await assert.rejects(exchangeAuthorizationCode('TEST_ONLY_CODE', config, async () => {
      calls++; throw failure;
    }, now), safeError(failure instanceof AliExpressOAuthError ? 'TIMEOUT' : 'TRANSPORT'));
    assert.equal(calls, 1);
  }
});

test('missing config prevents transport invocation', async () => {
  for (const cfg of [{ ...config, appSecret: '' }, { ...config, appKey: '0' }]) {
    let calls = 0;
    await assert.rejects(exchangeAuthorizationCode('TEST_ONLY_CODE', cfg, async () => { calls++; }, now), safeError('CONFIGURATION'));
    assert.equal(calls, 0);
  }
});

test('production Axios transport has bounded timeout, no redirects and safe errors', async t => {
  let calls = 0;
  t.mock.method(axios, 'post', async (_url, _body, options) => {
    calls++;
    assert.equal(options.timeout, 15000);
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.maxContentLength, 65536);
    throw new axios.AxiosError('PRIVATE_MARKER', 'ECONNABORTED');
  });
  await assert.rejects(exchangeAuthorizationCode('TEST_ONLY_CODE', config, undefined, now), safeError('TIMEOUT'));
  assert.equal(calls, 1);
});
