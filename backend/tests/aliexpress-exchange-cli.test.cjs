const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const script = resolve(__dirname, '../scripts/aliexpress-exchange.cjs');

test('exchange CLI rejects missing config before consuming code, without echoing secrets', () => {
  const result = spawnSync(process.execPath, [script], {
    cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000,
    input: 'PRIVATE_TEST_CODE',
    env: { ...process.env, ALIEXPRESS_APP_KEY: '', ALIEXPRESS_APP_SECRET: '',
      ALIEXPRESS_TOKEN_ENCRYPTION_KEY: '', ALIEXPRESS_ACCESS_TOKEN: 'PRIVATE_TEST_TOKEN' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No se completó el canje/);
  assert.doesNotMatch(result.stderr, /PRIVATE_TEST|access_token|refresh_token/);
});

test('exchange CLI rejects codes passed as command-line arguments', () => {
  const result = spawnSync(process.execPath, [script, 'PRIVATE_TEST_CODE'], {
    cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000, input: '',
    env: { ...process.env, ALIEXPRESS_APP_KEY: '', ALIEXPRESS_APP_SECRET: '', ALIEXPRESS_TOKEN_ENCRYPTION_KEY: '' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stderr, /PRIVATE_TEST/);
});
