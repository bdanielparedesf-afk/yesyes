const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { slugify, isReservedSlug, buildWaLink, cleanDescription } = require('../src/utils/business.ts');
const { isBusinessProduct } = require('../src/utils/business-scopes.ts');

test('slugify normaliza y evita reservados', () => {
  assert.equal(slugify('Peluquería Luna!'), 'peluqueria-luna');
  assert.equal(isReservedSlug('admin'), true);
  assert.equal(isReservedSlug('salon-luna'), false);
});

test('buildWaLink normaliza telefono CL', () => {
  const link = buildWaLink('+56912345678', 'Hola');
  assert.ok(link.startsWith('https://wa.me/56912345678'));
  assert.ok(link.includes('text=Hola'));
});

test('cleanDescription elimina scripts', () => {
  const out = cleanDescription('<p>Hola</p><script>alert(1)</script>');
  assert.ok(!String(out).includes('<script>'));
});

test('separacion tienda vs business por businessId', () => {
  assert.equal(isBusinessProduct({ businessId: null }), false);
  assert.equal(isBusinessProduct({ businessId: 'x' }), true);
});

test('register schema es strict sin role (anti-elevation)', () => {
  const { registerSchema } = require('../src/services/auth.service.ts');
  const r = registerSchema.safeParse({ name: 'A', lastName: 'B', email: 'a@b.cl', password: '123456', confirmPassword: '123456', role: 'BUSINESS' });
  assert.equal(r.success, false);
});

