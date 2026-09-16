const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '../..');
const examples = ['.env.example', 'backend/.env.example', 'frontend/.env.example'];
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('private environment files are ignored at every supported location', () => {
  for (const dir of ['', 'backend/', 'frontend/', 'nested/']) {
    for (const name of ['.env', '.env.local', '.env.production', '.env.vercel-pull', '.env.vercel', '.env.test']) {
      const path = dir + name;
      assert.equal(git(['check-ignore', '--no-index', '-q', path]).status, 0, path);
    }
  }
});

test('only the three approved environment examples are allowed', () => {
  for (const path of examples) {
    assert.equal(git(['check-ignore', '--no-index', '-q', path]).status, 1, path);
  }
  assert.equal(git(['check-ignore', '--no-index', '-q', 'nested/.env.example']).status, 0);
});

test('examples contain only comments and empty assignments, never values', () => {
  for (const path of examples) {
    for (const line of readFileSync(resolve(root, path), 'utf8').split(/\r?\n/)) {
      const publicGateway = path === 'backend/.env.example' && line === 'ALIEXPRESS_GATEWAY=https://api-sg.aliexpress.com/sync';
      assert.ok(publicGateway || /^\s*(#.*)?$/.test(line) || /^[A-Z][A-Z0-9_]*=$/.test(line), `Unsafe template line in ${path}`);
    }
  }
});

test('server examples include every required configuration key', () => {
  const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'AUTH_SECRET', 'CJ_API_KEY', 'CJ_EMAIL',
    'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_PUBLIC_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'CRON_SECRET',
    'ALIEXPRESS_API_KEY', 'ALIEXPRESS_API_SECRET'];
  for (const path of examples.slice(0, 2)) {
    const lines = readFileSync(resolve(root, path), 'utf8').split(/\r?\n/);
    for (const key of required) assert.ok(lines.includes(`${key}=`), `${path}: missing ${key}`);
  }
  const frontend = readFileSync(resolve(root, examples[2]), 'utf8');
  assert.ok(!/^(?!VITE_)[A-Z][A-Z0-9_]*=/m.test(frontend));
});

test('no private environment files are tracked', () => {
  const result = git(['ls-files', '-z']);
  assert.equal(result.status, 0);
  const tracked = result.stdout.split('\0').filter(Boolean);
  const unsafe = tracked.filter(path => /(^|\/)\.env(?:\.|$)/.test(path) && !examples.includes(path));
  assert.equal(unsafe.length, 0, 'Private environment files must not be tracked');
});
