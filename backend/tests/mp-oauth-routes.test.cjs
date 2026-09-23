const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');

process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY ||=
  '5cd6d7ca3b2b1b325ce590f924ea4a137d4c5ae772a78a6c660015d6ac33a63f';
process.env.MERCADOPAGO_CLIENT_ID ||= 'test_client_id_12345';
process.env.MERCADOPAGO_CLIENT_SECRET ||= 'test_client_secret_123';
process.env.MERCADOPAGO_OAUTH_REDIRECT_URI ||=
  'http://localhost:5173/api/mercadopago/oauth/callback';

const express = require('express');

/**
 * FASE 3 — Regresión de montaje de rutas.
 *
 * El frontend (frontend/src/services/mercadoPago.ts) llama a:
 *   POST/GET/DELETE /api/businesses/:businessId/mercadopago[/connect]
 * y la redirect_uri registrada en Mercado Pago es:
 *   /api/mercadopago/oauth/callback
 *
 * Este test levanta el router real de rutas (src/routes/index.ts) y verifica
 * que esos paths respondan (401/302) y no caigan en 404 de Express.
 * No se llama a Mercado Pago ni se usan credenciales reales: MOCKED E2E.
 */
describe('FASE3 — montaje de rutas OAuth (regresión)', () => {
  let server;
  let base;

  before(async () => {
    const indexRouter = require('../src/routes/index.ts').default;
    const app = express();
    app.use('/api', indexRouter);
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    if (server) server.close();
  });

  test('POST /api/businesses/:businessId/mercadopago/connect existe (401 sin token, no 404)', async () => {
    const res = await fetch(`${base}/api/businesses/biz-1/mercadopago/connect`, {
      method: 'POST',
    });
    assert.equal(res.status, 401);
  });

  test('GET /api/businesses/:businessId/mercadopago existe (401 sin token, no 404)', async () => {
    const res = await fetch(`${base}/api/businesses/biz-1/mercadopago`);
    assert.equal(res.status, 401);
  });

  test('DELETE /api/businesses/:businessId/mercadopago existe (401 sin token, no 404)', async () => {
    const res = await fetch(`${base}/api/businesses/biz-1/mercadopago`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 401);
  });

  test('GET /api/mercadopago/oauth/callback existe y falla seguro sin code/state (redirect mp_error)', async () => {
    const res = await fetch(`${base}/api/mercadopago/oauth/callback`, {
      redirect: 'manual',
    });
    assert.equal(res.status, 302);
    const location = res.headers.get('location') || '';
    assert.ok(
      location.includes('mp_error=credentials_missing'),
      `location inesperada: ${location}`,
    );
  });

  test('el mount viejo /api/mercadopago/oauth/oauth/callback ya no es la ruta canónica', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/index.ts'),
      'utf8',
    );
    assert.ok(
      !src.includes("router.use('/mercadopago/oauth', mpOAuthRoutes)"),
      'el mount duplicaba /oauth y rompía la redirect_uri registrada',
    );
    assert.ok(
      src.includes("router.use('/businesses', mpOAuthRoutes)"),
      'falta mount de rutas MP bajo /businesses',
    );
    assert.ok(
      src.includes("router.use('/mercadopago', mpOAuthRoutes)"),
      'falta mount del callback bajo /mercadopago',
    );
  });
});
