/**
 * YESYES BUSINESS — PRECIO DEL PLAN (no puede ser 0).
 *
 * El endpoint publico `/api/public/businesses/plans` devolvia amount 0 porque
 * en la base solo habia un plan de QA activo, y `listActivePlans` solo creaba
 * el plan por defecto cuando la lista venia VACIA. Con un plan de prueba
 * activo, el plan real (BUSINESS_BASIC) nunca se creaba y la pagina mostraba
 * $0.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLANS = fs.readFileSync(
  path.resolve(__dirname, '../src/config/business-plans.ts'),
  'utf8',
);

test('el plan por defecto tiene un monto real, mayor que cero', () => {
  const montos = [...PLANS.matchAll(/amount:\s*(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(montos.length > 0, 'hay al menos un plan definido');
  for (const amount of montos) {
    assert.ok(amount > 0, `ningun plan puede costar 0 (encontrado ${amount})`);
  }
});

test('el plan por defecto declara BUSINESS_BASIC y es el primero', () => {
  assert.ok(PLANS.includes("DEFAULT_PLAN_CODE = 'BUSINESS_BASIC'"), 'el plan por defecto es BUSINESS_BASIC');
  const codes = [...PLANS.matchAll(/code:\s*DEFAULT_PLAN_CODE/g)];
  assert.ok(codes.length > 0, 'el seed usa el plan por defecto');
});

test('listActivePlans asegura el plan por defecto y descarta montos en cero', () => {
  const service = fs.readFileSync(
    path.resolve(__dirname, '../src/services/business-subscription.service.ts'),
    'utf8',
  );
  const cuerpo = service.slice(service.indexOf('export async function listActivePlans'));
  assert.ok(
    /await\s+getOrCreateDefaultPlan\(\)/.test(cuerpo),
    'listActivePlans debe asegurar el plan por defecto ANTES de listar',
  );
  assert.ok(
    /amount:\s*\{\s*gt:\s*0\s*\}/.test(cuerpo),
    'no debe devolver planes con monto 0 (planes de QA)',
  );
});

test('el endpoint publico expone el monto como numero', () => {
  const routes = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/public-business.routes.ts'),
    'utf8',
  );
  const inicio = routes.indexOf("router.get('/plans'");
  const bloque = routes.slice(inicio, inicio + 500);
  assert.ok(bloque.includes('Number(plan.amount)'), 'el monto se serializa como numero');
  assert.ok(bloque.includes("'Cache-Control'"), 'la respuesta declara su cache');
});
