const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const script = resolve(__dirname, '../scripts/aliexchange-oauth.cjs');

test('legacy OAuth probe is disabled and contains no executable network or credential logic', () => {
  const source = readFileSync(script, 'utf8');
  assert.doesNotMatch(source, /require\s*\(|import\s*\(|fetch\s*\(|https?\.request|app_secret\s*=|const\s+code\s*=/);
  assert.doesNotMatch(source, /console\.log|process\.env/);
});

test('disabled OAuth probe exits closed and never echoes environment secrets', () => {
  const marker = 'test-only-sensitive-marker';
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, ALIEXPRESS_APP_SECRET: marker,
      ALIEXPRESS_ACCESS_TOKEN: marker, ALIEXPRESS_REFRESH_TOKEN: marker },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /OAuth bloqueado/);
  assert.match(result.stderr, /No se realizo ninguna solicitud/);
  assert.ok(!result.stderr.includes(marker));
});
