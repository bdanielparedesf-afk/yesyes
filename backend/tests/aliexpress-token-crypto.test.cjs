const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { tokenEncryptionKey, encryptToken, decryptToken } = require('../src/aliexpress/token-crypto.ts');
const { AliExpressOAuthError } = require('../src/aliexpress/oauth-client.ts');
const key = tokenEncryptionKey('ab'.repeat(32));

test('AES-GCM roundtrip, randomized IV and no plaintext in persisted value', () => {
  const a = encryptToken('TEST_ONLY_TOKEN', key, 'test@example.invalid', 'access');
  const b = encryptToken('TEST_ONLY_TOKEN', key, 'test@example.invalid', 'access');
  assert.notEqual(a, b);
  assert.ok(!a.includes('TEST_ONLY_TOKEN'));
  assert.equal(decryptToken(a, key, 'test@example.invalid', 'access'), 'TEST_ONLY_TOKEN');
});

test('token envelopes reject tampering, wrong key, swapped account or token kind', () => {
  const a = encryptToken('TEST_ONLY_TOKEN', key, 'account', 'access');
  for (const [value, k, account, field] of [
    [a, tokenEncryptionKey('cd'.repeat(32)), 'account', 'access'],
    [a, key, 'other', 'access'], [a, key, 'account', 'refresh'],
    [a.slice(0, -2) + (a.endsWith('00') ? '01' : '00'), key, 'account', 'access'],
    ['LEGACY_PLAINTEXT', key, 'account', 'access']]) {
    assert.throws(() => decryptToken(value, k, account, field), AliExpressOAuthError);
  }
});

test('missing key never falls back to a public default or another credential', () => {
  for (const key of [undefined, '', 'secret', 'ab'.repeat(31)]) {
    assert.throws(() => tokenEncryptionKey(key), AliExpressOAuthError);
  }
});

test('non-refreshable grant can encrypt and decrypt an empty refresh value', () => {
  assert.equal(decryptToken(encryptToken('', key, 'account', 'refresh'), key, 'account', 'refresh'), '');
});
