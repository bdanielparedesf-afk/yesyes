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

test('preview: NO existe bypass de preview en la ruta publica', () => {
  assert.ok(!pub.includes('preview'), 'public-business no debe tener preview');
  assert.ok(!pub.includes('DRAFT'), 'publica jamas resuelve borradores');
});

test('preview: el router aplica authenticate a todas las rutas de businesses', () => {
  assert.ok(routes.includes('router.use(authenticate);'));
});

test('preview: frontend usa el endpoint autenticado con ?preview=true', () => {
  const svc = fs.readFileSync(__dirname + '/../../frontend/src/services/business.ts', 'utf8');
  assert.ok(svc.includes('/businesses/preview/'), 'servicio frontend sin llamada a preview');
  const page = fs.readFileSync(__dirname + '/../../frontend/src/pages/MiNegocio.tsx', 'utf8');
  assert.ok(page.includes("getPreviewBusiness"), 'MiNegocio no usa preview autenticado');
  assert.ok(page.includes("searchParams.get('preview') === 'true'"), 'MiNegocio no lee ?preview=true');
});
