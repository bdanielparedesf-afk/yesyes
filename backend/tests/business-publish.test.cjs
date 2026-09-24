const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('tsx/cjs');

const admin = fs.readFileSync(__dirname + '/../src/routes/admin.routes.ts', 'utf8');
const dashboard = fs.readFileSync(__dirname + '/../../frontend/src/pages/BusinessDashboard.tsx', 'utf8');

test('error handling: 5xx no expone mensajes internos en produccion', () => {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/middlewares/errorHandler.ts', 'utf8');
  assert.ok(src.includes('statusCode >= 400 && statusCode < 500'));
  assert.ok(src.includes("'Internal Server Error'"));
});

test('estado admin: publicar pasa por el gate de suscripcion, no actualiza status directamente', () => {
  const route = admin.slice(admin.indexOf("router.put('/businesses/:id/status'"));
  assert.ok(route.includes('publishBusiness'));
  assert.ok(!route.includes("prisma.business.update"));
});

test('dashboard owner: publica y pausa mediante endpoints protegidos', () => {
  assert.ok(dashboard.includes('`/businesses/${id}/${action}`'));
  assert.ok(!dashboard.includes('updateBusiness(id, { status }'));
});

test('publish service: aplica gate de suscripcion y checklist antes de actualizar', () => {
  const service = fs.readFileSync(__dirname + '/../src/services/business-publish.service.ts', 'utf8');
  const fn = service.slice(service.indexOf('export async function publishBusiness'), service.indexOf('export async function pauseBusiness'));
  assert.ok(fn.indexOf('publishGate') < fn.indexOf('prisma.business.update'));
});
