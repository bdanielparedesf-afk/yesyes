const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
require('tsx/cjs');
const { signTokenCreate, buildTokenCreateRequest, OAuthRequestValidationError } = require('../src/aliexpress/oauth-request.ts');

const params = {
  app_key: '547536', code: '3_547536_FICTICIO_ABC123',
  timestamp: '1726500000000', sign_method: 'sha256',
};
const secret = 'FICTICIO_SECRET';
// Independently computed with .NET HMACSHA256; not a provider-issued test vector.
const expected = 'F7229E7FC6C5AEDFE09435DCB5399153E3B62FBDAB7A3066C0285E83E67B4653';
const input = { appKey: params.app_key, code: params.code, timestamp: Number(params.timestamp), appSecret: secret };

test('SHA256 matches the independent fixed vector for the supplied contract', () => {
  assert.equal(signTokenCreate(params, secret), expected);
  assert.match(expected, /^[A-F0-9]{64}$/);
});

test('parameter insertion order does not affect the signature', () => {
  assert.equal(signTokenCreate(Object.fromEntries(Object.entries(params).reverse()), secret), expected);
});

test('code, app key, timestamp and secret affect the signature', () => {
  for (const [key, value] of [['code', 'OTHER_FICTITIOUS_CODE'], ['app_key', '123'], ['timestamp', '1726500000001']]) {
    assert.notEqual(signTokenCreate({ ...params, [key]: value }, secret), expected);
  }
  assert.notEqual(signTokenCreate(params, 'ANOTHER_FICTITIOUS_SECRET'), expected);
});

test('request uses the fixed endpoint and form body without sending the secret', () => {
  const request = buildTokenCreateRequest(input);
  assert.equal(request.url, 'https://api-sg.aliexpress.com/rest/auth/token/create');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(request.body)), { ...params, sign: expected });
  assert.ok(!JSON.stringify(request).includes(secret));
  assert.equal(new URL(request.url).search, '');
});

test('signing precedes URL encoding, preserving Unicode and reserved characters', () => {
  const code = 'FICTICIO_á +&=';
  const request = buildTokenCreateRequest({ ...input, code });
  const body = new URLSearchParams(request.body);
  assert.equal(body.get('code'), code);
  const canonical = '/auth/token/createapp_key547536code' + code + 'sign_methodsha256timestamp1726500000000';
  assert.equal(body.get('sign'), createHmac('sha256', secret).update(canonical, 'utf8').digest('hex').toUpperCase());
});

test('invalid values are rejected with fixed errors, not echoed credentials', () => {
  for (const patch of [{ code: '' }, { code: 'private-marker\n' }, { appKey: '' },
    { appSecret: '' }, { timestamp: NaN }, { timestamp: 1.5 }, { timestamp: 0 },
    { timestamp: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => buildTokenCreateRequest({ ...input, ...patch }), error => {
      assert.ok(error instanceof OAuthRequestValidationError);
      assert.equal(error.message, 'Configuración o parámetros OAuth inválidos.');
      assert.ok(!JSON.stringify(error).includes('private-marker'));
      return true;
    });
  }
});

test('unknown parameters and supplied sign are rejected, not silently signed', () => {
  for (const patch of [{ sign: 'existing' }, { session: 'private-marker' }, { sign_method: 'md5' }]) {
    assert.throws(() => signTokenCreate({ ...params, ...patch }, secret), OAuthRequestValidationError);
  }
});
