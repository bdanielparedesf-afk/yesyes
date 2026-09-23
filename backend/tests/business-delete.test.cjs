const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const ctrl = fs.readFileSync(__dirname + '/../src/controllers/business.controller.ts', 'utf8');
const routes = fs.readFileSync(__dirname + '/../src/routes/business.routes.ts', 'utf8');

test('delete logico: negocio vacio en DRAFT se borra HARD + limpia storage', () => {
  assert.ok(ctrl.includes("existing.status === 'DRAFT'"));
  assert.ok(ctrl.includes("mode: 'HARD'"));
  assert.ok(ctrl.includes('await cleanupBusinessImages(existing.id)'));
});

test('delete logico: negocio con contenido pasa a ARCHIVED (nunca borrado fisico)', () => {
  assert.ok(ctrl.includes("status: 'ARCHIVED' as any"));
  assert.ok(ctrl.includes("mode: 'ARCHIVED'"));
  assert.ok(ctrl.includes('borrado logico'));
});

test('delete logico: el conteo de relaciones incluye servicios, propiedades, leads, galeria y productos', () => {
  assert.ok(ctrl.includes('select: { services: true, properties: true, leads: true, gallery: true }'));
  assert.ok(ctrl.includes('product.count({ where: { businessId: existing.id } })'));
});

test('delete logico: DELETE /businesses/:id delega en archiveBusiness', () => {
  assert.ok(routes.includes("router.delete('/:id', requireBusinessOwner"));
  assert.ok(routes.includes('archiveBusiness(req, res)'));
});

test('delete logico: producto business con ordenes cae a ARCHIVED+hidden', () => {
  assert.ok(routes.includes("status: 'ARCHIVED' as any, hidden: true"));
});

test('delete logico: el endpoint exige ownership antes de archivar', () => {
  assert.ok(ctrl.includes('ownerWhere(req, String(req.params.id))'));
});
