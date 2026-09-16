const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { diagnose } = require('../scripts/aliexpress-preflight.cjs');

test('missing or blank credentials block local preflight', () => {
  for (const env of [{}, { ALIEXPRESS_APP_KEY: 'test-key' },
    { ALIEXPRESS_APP_KEY: 'test-key', ALIEXPRESS_APP_SECRET: '   ' }]) {
    const result = diagnose(env);
    assert.equal(result.credentialsConfigured, false);
    assert.equal(result.reason, 'MISSING_CREDENTIALS');
    assert.equal(result.requestAttempted, false);
  }
});

test('presence never implies valid credentials or authorized API', () => {
  const result = diagnose({ ALIEXPRESS_APP_KEY: 'test-key', ALIEXPRESS_APP_SECRET: 'test-only-secret' });
  assert.equal(result.credentialsConfigured, true);
  assert.equal(result.verification, 'NOT_PERFORMED');
  assert.equal(result.status, 'BLOCKED');
  for (const key of ['connected', 'authenticated', 'authorized', 'apiAvailable', 'requestAttempted']) {
    assert.equal(result[key], false);
  }
});

test('diagnostic uses only fixed safe values and never echoes credentials', () => {
  const result = diagnose({ ALIEXPRESS_APP_KEY: 'private-key-marker',
    ALIEXPRESS_APP_SECRET: 'private-secret-marker', ACCESS_TOKEN: 'private-token-marker' });
  assert.ok(!JSON.stringify(result).includes('private-'));
  assert.equal(result.reason, 'OFFICIAL_API_CONTRACT_AND_APP_PERMISSIONS_NOT_VERIFIED');
});

test('backend template declares empty app credentials', () => {
  const template = readFileSync(resolve(__dirname, '../.env.example'), 'utf8');
  assert.match(template, /^ALIEXPRESS_APP_KEY=$/m);
  assert.match(template, /^ALIEXPRESS_APP_SECRET=$/m);
});
