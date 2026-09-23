const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');

// Rutas que NO llevan :businessId y validan ownership internamente.
const ALLOW_NO_MIDDLEWARE = new Set(['/', '/templates', '/preview/:slug', '/admin/all']);

test('IDOR: toda ruta con :businessId o :id lleva requireBusinessOwner', () => {
  const re = /router\.(get|post|put|delete)\(\s*'([^']+)'/g;
  let m;
  let checked = 0;
  while ((m = re.exec(routes))) {
    const method = m[1];
    const path = m[2];
    if (ALLOW_NO_MIDDLEWARE.has(path)) continue;
    const after = routes.slice(m.index, m.index + m[0].length + 160);
    assert.ok(
      after.includes('requireBusinessOwner'),
      `${method.toUpperCase()} ${path} no exige requireBusinessOwner`,
    );
    checked += 1;
  }
  assert.ok(checked >= 15, `esperaba >=15 rutas protegidas, habia ${checked}`);
});

test('IDOR: GET / lista solo los negocios del usuario (no admin)', () => {
  assert.ok(routes.includes("req.user!.role === 'ADMIN' ? {} : { ownerId: req.user!.id }"));
});

test('IDOR: los handlers re-filtran con ownerWhere antes de leer/escribir', () => {
  const uses = (routes.match(/ownerWhere\(req,/g) || []).length;
  assert.ok(uses >= 12, `ownerWhere deberia usarse en todos los handlers, solo ${uses}`);
});

test('IDOR: preview exige ownership por slug (ADMIN o owner)', () => {
  assert.ok(routes.includes("req.user!.role === 'ADMIN' ? { slug } : { slug, ownerId: req.user!.id }"));
});

test('IDOR: requireBusinessOwner compara contra el usuario autenticado, no el body', () => {
  const auth = fs.readFileSync(__dirname + '/../src/middlewares/businessAuth.ts', 'utf8');
  assert.ok(auth.includes('business.ownerId !== req.user.id'));
  assert.ok(!auth.includes('req.body'));
});
