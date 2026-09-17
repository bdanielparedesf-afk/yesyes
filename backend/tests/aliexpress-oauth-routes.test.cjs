const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
require('tsx/cjs');
const { createAliExpressRouter } = require('../src/routes/aliexpress.routes.ts');
const { AliExpressOAuthError } = require('../src/aliexpress/oauth-client.ts');

const SECRETS = ['PRIVATE_APP_SECRET', 'PRIVATE_ACCESS_TOKEN', 'PRIVATE_REFRESH_TOKEN', 'PRIVATE_CODE'];
const PANEL = 'https://panel.yesyes.cl';
const pass = (_req, _res, next) => next();

function app(oauth, overrides = {}) {
  process.env.FRONTEND_URL = PANEL;
  const server = express();
  server.use(express.json());
  server.use('/api/admin/aliexpress', createAliExpressRouter({
    authenticate: pass, requireAdmin: pass, accounts: async () => [], disconnect: async () => {}, oauth, ...overrides,
  }));
  return server;
}

function stubOAuth(overrides = {}) {
  const calls = [];
  const authorizationUrl = 'https://api-sg.aliexpress.com/oauth/authorize?client_id=547536&state=st';
  return {
    calls, authorizationUrl,
    start: async (userId, account) => {
      calls.push(['start', userId, account]);
      return { authorizationUrl, browser: 'browser-nonce', secure: true };
    },
    callback: async (state, browser, code) => {
      calls.push(['callback', state, browser, code]);
      // Mirrors the service contract: no code means no exchange, never an activation.
      if (!code) throw new AliExpressOAuthError('REJECTED');
    },
    ...overrides,
  };
}

function assertNoSecrets(response) {
  const text = `${response.text || ''} ${response.headers.location || ''}`;
  for (const secret of SECRETS) assert.ok(!text.includes(secret), `leaked ${secret}`);
}

test('connect starts the official flow, returns no token and sets an HttpOnly cookie', async () => {
  const oauth = stubOAuth();
  const response = await request(app(oauth)).post('/api/admin/aliexpress/oauth/connect')
    .set('x-yesyes-admin', '1').send({ account: 'vendedor@aliexpress.com' }).expect(200);
  assert.deepEqual(response.body, { authorizationUrl: oauth.authorizationUrl });
  assert.deepEqual(oauth.calls, [['start', undefined, 'vendedor@aliexpress.com']]);
  const cookie = response.headers['set-cookie'].join(';');
  assert.match(cookie, /^yesyes_ae_oauth=browser-nonce/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api\/admin\/aliexpress\/oauth/i);
  assertNoSecrets(response);
});

test('connect requires the administrative CSRF header and a valid account', async () => {
  const oauth = stubOAuth();
  const server = app(oauth);
  await request(server).post('/api/admin/aliexpress/oauth/connect').send({}).expect(403);
  await request(server).post('/api/admin/aliexpress/oauth/connect').set('x-yesyes-admin', '1')
    .set('sec-fetch-site', 'cross-site').send({}).expect(403);
  await request(server).post('/api/admin/aliexpress/oauth/connect').set('x-yesyes-admin', '1')
    .send({ account: '' }).expect(400);
  await request(server).post('/api/admin/aliexpress/oauth/connect').set('x-yesyes-admin', '1')
    .send({ account: 'a', extra: 1 }).expect(400);
  assert.equal(oauth.calls.length, 0);
});

test('connect reports configuration and rejection problems without internal detail', async () => {
  const failing = reason => stubOAuth({ start: async () => { throw new AliExpressOAuthError(reason); } });
  const rejection = await request(app(failing('REJECTED'))).post('/api/admin/aliexpress/oauth/connect')
    .set('x-yesyes-admin', '1').send({ account: 'vendedor@aliexpress.com' }).expect(403);
  assert.equal(rejection.body.code, 'REJECTED');
  const configuration = await request(app(failing('OAUTH_CONFIGURATION_ERROR'))).post('/api/admin/aliexpress/oauth/connect')
    .set('x-yesyes-admin', '1').send({ account: 'vendedor@aliexpress.com' }).expect(503);
  assert.equal(configuration.body.code, 'OAUTH_CONFIGURATION_ERROR');
  assertNoSecrets(rejection);
  assertNoSecrets(configuration);
});

test('callback redeems the code server-side and returns to the panel with a safe result', async () => {
  const oauth = stubOAuth();
  const response = await request(app(oauth)).get('/api/admin/aliexpress/oauth/callback')
    .set('Cookie', 'yesyes_ae_oauth=browser-nonce')
    .query({ code: 'PRIVATE_CODE', state: 'PRIVATE_STATE' }).expect(303);
  assert.equal(response.headers.location, `${PANEL}/admin/aliexpress?aliexpress=connected`);
  assert.deepEqual(oauth.calls, [['callback', 'PRIVATE_STATE', 'browser-nonce', 'PRIVATE_CODE']]);
  assert.match(response.headers['set-cookie'].join(';'), /yesyes_ae_oauth=;/);
  assertNoSecrets(response);
});

test('callback failures return a fixed error code and never activate through the panel', async () => {
  const cases = [
    ['REJECTED', () => { throw new AliExpressOAuthError('REJECTED'); }],
    ['OAUTH_CONTRACT_ERROR', () => { throw new AliExpressOAuthError('CONTRACT'); }],
    ['OAUTH_STORAGE_ERROR', () => { throw new Error('PRIVATE_APP_SECRET'); }],
  ];
  for (const [expected, callback] of cases) {
    const oauth = stubOAuth({ callback: async () => callback() });
    const response = await request(app(oauth)).get('/api/admin/aliexpress/oauth/callback')
      .set('Cookie', 'yesyes_ae_oauth=browser-nonce').query({ code: 'PRIVATE_CODE', state: 'PRIVATE_STATE' }).expect(303);
    assert.match(response.headers.location, new RegExp(`/admin/aliexpress\\?aliexpress=error&code=${expected}$`));
    assertNoSecrets(response);
  }
});

test('provider failures are reduced to a fixed identifier without the raw description', async () => {
  const oauth = stubOAuth();
  const response = await request(app(oauth)).get('/api/admin/aliexpress/oauth/callback')
    .query({ error: 'PRIVATE_APP_SECRET', error_description: 'PRIVATE_REFRESH_TOKEN' }).expect(303);
  assert.match(response.headers.location, /aliexpress=error&code=OAUTH_PROVIDER_ERROR$/);
  assert.equal(oauth.calls.length, 1);
  assert.equal(oauth.calls[0][3], undefined);
  assertNoSecrets(response);
});

test('callback without the browser cookie cannot exchange anything', async () => {
  const oauth = stubOAuth();
  const response = await request(app(oauth)).get('/api/admin/aliexpress/oauth/callback')
    .query({ code: 'PRIVATE_CODE', state: 'PRIVATE_STATE' }).expect(303);
  assert.match(response.headers.location, /aliexpress=error&code=/);
  assert.deepEqual(oauth.calls, [['callback', 'PRIVATE_STATE', '', 'PRIVATE_CODE']]);
  assertNoSecrets(response);
});