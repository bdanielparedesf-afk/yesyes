const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const { slugify, isReservedSlug, BUSINESS_RESERVED_SLUGS } = require('../src/utils/business.ts');

test('slug: normaliza acentos, mayusculas y signos', () => {
  assert.equal(slugify('Peluquería Luna!'), 'peluqueria-luna');
  assert.equal(slugify('Pastelería Daniel & Cía.'), 'pasteleria-daniel-cia');
  assert.equal(slugify('  BARBERÍA ÉLITE  '), 'barberia-elite');
});

test('slug: vacio o invalido cae en "negocio"', () => {
  assert.equal(slugify(''), 'negocio');
  assert.equal(slugify('!!!'), 'negocio');
});

test('slug: longitud maxima 80', () => {
  assert.ok(slugify('a'.repeat(300)).length <= 80);
});

test('slug: rutas reservadas bloqueadas', () => {
  for (const r of ['mi-negocio', 'negocio', 'productos', 'checkout', 'admin', 'api', 'login']) {
    assert.ok(BUSINESS_RESERVED_SLUGS.includes(r), `falta reservado ${r}`);
    assert.equal(isReservedSlug(r), true);
  }
  assert.equal(isReservedSlug('salon-belleza-luna'), false);
});

test('slug: unicoBusinessSlugFor usa slugify + reservados + sufijo unico', () => {
  const svc = fs.readFileSync(__dirname + '/../src/services/business.service.ts', 'utf8');
  assert.ok(svc.includes('slugify(base)'));
  assert.ok(svc.includes('isReservedSlug(candidate)'));
  assert.ok(svc.includes('${candidate}-negocio'));
  assert.ok(svc.includes('unique'));
});

test('slug: la ruta publica resuelve por :slug', () => {
  const pub = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');
  assert.ok(pub.includes("router.get('/:slug'"));
  assert.ok(pub.includes('req.params.slug'));
});
