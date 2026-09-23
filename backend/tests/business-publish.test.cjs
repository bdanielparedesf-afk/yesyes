const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const ctrl = fs.readFileSync(__dirname + '/../src/controllers/business.controller.ts', 'utf8');

test('publish: allow-list de estados exacta (DRAFT/PUBLISHED/PAUSED/ARCHIVED)', () => {
  assert.ok(ctrl.includes("const allowed = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'];"));
  assert.ok(!/allowed = \[[^\]]*(?:'CANCELLED'|'DELETED')/.test(ctrl), 'estados inesperados en allow-list');
});

test('publish: publicar exige negocio completo (nombre, categoria, slug, descripcion, contacto)', () => {
  assert.ok(ctrl.includes('if (nextStatus === \'PUBLISHED\')'), 'validacion de publicacion ausente');
  assert.ok(ctrl.includes('al menos un contacto'), 'falta requisito de contacto');
  for (const v of ['nameOk', 'categoryOk', 'slugOk', 'descOk', 'contactOk']) {
    assert.ok(ctrl.includes(v), `falta validacion ${v}`);
  }
});

test('publish: publicar pasa siempre por ownerWhere (nunca solo por id del body)', () => {
  assert.ok(ctrl.includes('ownerWhere(req, String(req.params.id))'));
});

test('publish: status se separa del schema strict antes de validar', () => {
  assert.ok(ctrl.includes('delete body.status;'), 'status debe extraerse antes de Zod strict');
});

test('publish: publicar actualiza publishedAt', () => {
  assert.ok(ctrl.includes("nextStatus === 'PUBLISHED' ? { publishedAt: new Date() }"));
});

test('completitud: businessCalcula pct y faltantes', () => {
  const { businessCompleteness } = require('../src/services/business.service.ts');
  const full = businessCompleteness({
    name: 'X', description: 'd', whatsapp: '5691', address: 'Av. 1', logo: 'https://x/l.png', cover: 'https://x/c.png',
  });
  assert.equal(full.pct, 100);
  assert.deepEqual(full.missing, []);
  const empty = businessCompleteness({});
  assert.equal(empty.pct, 0);
  assert.ok(empty.missing.includes('Nombre'));
});
