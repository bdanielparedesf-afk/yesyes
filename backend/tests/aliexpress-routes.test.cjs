const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
require('tsx/cjs');
const { createAliExpressRouter } = require('../src/routes/aliexpress.routes.ts');
const { refreshAliexpressToken } = require('../src/jobs/aliexpress-token-refresh.ts');
const pass = (_req, _res, next) => next();
function app(overrides = {}) {
  const server = express();
  server.use(express.json());
  server.use('/api/admin/aliexpress', createAliExpressRouter({
    authenticate: pass, requireAdmin: pass, accounts: async () => [], disconnect: async () => {}, ...overrides,
  }));
  return server;
}

test('production auth denies anonymous requests before database access', async () => {
  const server = express();
  server.use('/api/admin/aliexpress', createAliExpressRouter());
  await request(server).get('/api/admin/aliexpress/status').expect(401);
  await request(server).post('/api/admin/aliexpress/disconnect').send({ account: 'test' }).expect(401);
});

test('production admin middleware rejects authenticated customers', async () => {
  const { requireAdmin } = require('../src/middlewares/auth.ts');
  const server = app({ authenticate: (req, _res, next) => { req.user = { role: 'CUSTOMER' }; next(); }, requireAdmin });
  await request(server).get('/api/admin/aliexpress/status').expect(403);
});

test('status response explicitly excludes tokens even if a service returns extra fields', async () => {
  const server = app({ accounts: async () => [{ account: 'test', sellerId: '123', isActive: true,
    expiresAt: new Date(), refreshExpiresAt: new Date(), tokenUnexpired: true,
    accessToken: 'PRIVATE_MARKER', refreshToken: 'PRIVATE_MARKER', appSecret: 'PRIVATE_MARKER' }] });
  const response = await request(server).get('/api/admin/aliexpress/status').expect(200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(!response.text.includes('PRIVATE_MARKER'));
  assert.equal(response.body.authenticationVerified, false);
});

test('disconnect requires admin header and validated account, never returns tokens', async () => {
  const calls = [];
  const server = app({ disconnect: async account => { calls.push(account); } });
  await request(server).post('/api/admin/aliexpress/disconnect').send({ account: 'test' }).expect(403);
  await request(server).post('/api/admin/aliexpress/disconnect').set('x-yesyes-admin', '1').send({ account: '' }).expect(400);
  const response = await request(server).post('/api/admin/aliexpress/disconnect').set('x-yesyes-admin', '1').send({ account: 'test' }).expect(200);
  assert.deepEqual(calls, ['test']);
  assert.deepEqual(response.body, { disconnected: true, remoteRevoked: false });
});

test('database errors never leak technical messages to HTTP clients', async () => {
  const server = app({ accounts: async () => { throw new Error('PRIVATE_MARKER'); } });
  const response = await request(server).get('/api/admin/aliexpress/status').expect(503);
  assert.ok(!response.text.includes('PRIVATE_MARKER'));
});

test('rate limit blocks excessive calls', async () => {
  const server = app();
  for (let n = 0; n < 30; n++) await request(server).get('/api/admin/aliexpress/status').expect(200);
  await request(server).get('/api/admin/aliexpress/status').expect(429);
});

test('refresh job exports the same backend-only implementation as token service', () => {
  const service = require('../src/services/aliexpress-token.service.ts');
  assert.equal(refreshAliexpressToken, service.refreshAliexpressToken);
});
