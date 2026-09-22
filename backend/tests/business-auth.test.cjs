const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { ownerWhere } = require('../src/middlewares/businessAuth.ts');

function reqAs(role, id) { return { user: { role, id }, params: { id: 'biz-1' } }; }

test('ADMIN bypasea owner check', () => {
  assert.deepEqual(ownerWhere(reqAs('ADMIN', 'a'), 'biz-1'), { id: 'biz-1' });
});

test('BUSINESS queda scopado a ownerId', () => {
  assert.deepEqual(ownerWhere(reqAs('BUSINESS', 'u1'), 'biz-1'), { id: 'biz-1', ownerId: 'u1' });
});

test('public select nunca expone ownerId', async () => {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');
  assert.ok(!src.includes('ownerId'), 'public route no debe mencionar ownerId');
});

