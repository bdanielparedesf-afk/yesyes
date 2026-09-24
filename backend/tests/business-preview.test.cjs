const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');
const pub = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');

test('preview: endpoint autenticado GET /businesses/preview/:slug existe', () => {
  assert.ok(routes.includes("router.get('/preview/:slug'"));
});

test('preview: exige ownership (ADMIN ve cualquiera, owner solo el suyo)', () => {
  assert.ok(routes.includes("req.user!.role === 'ADMIN' ? { slug } : { slug, ownerId: req.user!.id }"));
});

test('preview: sin cache (nunca servir borradores cacheados)', () => {
  assert.ok(routes.includes("'no-store'"));
});

test('preview: NO existe bypass de preview=1 en la API publica', () => {
  assert.ok(pub.includes("router.get('/:slug/preview'"), 'debe existir preview solo con token');
  assert.ok(pub.includes('validatePreviewToken'), 'la preview tokenizada debe validar hash/expiracion/revocacion');
  assert.ok(!pub.includes("req.query.preview"), 'un booleano query no debe habilitar preview');
  assert.ok(!pub.includes("'DRAFT'"), 'la API publica normal no resuelve borradores');
});

test('preview: el router aplica authenticate a todas las rutas de businesses', () => {
  assert.ok(routes.includes('router.use(authenticate);'));
});

test('preview: frontend usa preview autenticada con ?preview=true y token con ?preview=<token>', () => {
  const svc = fs.readFileSync(__dirname + '/../../frontend/src/services/business.ts', 'utf8');
  assert.ok(svc.includes('/businesses/preview/'), 'servicio frontend sin llamada autenticada');
  assert.ok(svc.includes('/public/businesses/'), 'servicio frontend sin llamada tokenizada');
  const page = fs.readFileSync(__dirname + '/../../frontend/src/pages/MiNegocio.tsx', 'utf8');
  assert.ok(page.includes('getPreviewBusiness'), 'MiNegocio no usa preview');
  assert.ok(page.includes("searchParams.get('preview')"), 'MiNegocio no lee el parametro preview');
});
