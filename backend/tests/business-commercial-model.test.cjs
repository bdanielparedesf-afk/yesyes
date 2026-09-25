const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require('tsx/cjs');

const { businessPublishChecklist } = require('../src/services/business-publish.service.ts');
const { BUSINESS_PLAN_SEEDS, DEFAULT_PLAN_CODE } = require('../src/config/business-plans.ts');
const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/business.controller.ts'), 'utf8');
const subscription = fs.readFileSync(path.join(__dirname, '../src/services/business-subscription.service.ts'), 'utf8');
const publish = fs.readFileSync(path.join(__dirname, '../src/services/business-publish.service.ts'), 'utf8');
const adminRoute = fs.readFileSync(path.join(__dirname, '../src/routes/admin.routes.ts'), 'utf8');
const ownerRoute = fs.readFileSync(path.join(__dirname, '../src/routes/business.routes.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/BusinessDashboard.tsx'), 'utf8');

test('cada página normal crea una suscripción pendiente asociada a su business', () => {
  assert.match(controller, /ensureBusinessSubscription\(business\.id\)/);
  assert.match(controller, /req\.user!\.role !== 'ADMIN'/);
  assert.match(subscription, /where: \{ businessId \}/);
  assert.match(subscription, /status: 'PENDING'/);
  assert.match(subscription, /amount: Number\(plan\.amount\)/);
});

test('el plan oficial sigue siendo 11.990 CLP mensuales en una configuración central', () => {
  const plan = BUSINESS_PLAN_SEEDS.find((item) => item.code === DEFAULT_PLAN_CODE);
  assert.ok(plan);
  assert.equal(plan.amount, 11990);
  assert.equal(plan.currency, 'CLP');
  assert.equal(plan.frequency, 1);
  assert.equal(plan.frequencyType, 'MONTH');
});

test('el gate de publicación permite ADMIN sin suscripción y exige pago al cliente', () => {
  const base = { business: { name: 'Negocio', category: 'HAIR', description: 'Texto', whatsapp: '+56911111111', cta: 'Contactar', templateId: 'template' }, template: { code: 'HAIR_01' }, counts: { services: 1, products: 0, properties: 0, gallery: 0 } };
  const customer = businessPublishChecklist({ ...base, subscription: null });
  const admin = businessPublishChecklist({ ...base, subscription: null, isAdmin: true });
  assert.ok(customer.missingRequired.includes('subscription'));
  assert.ok(!admin.missingRequired.includes('subscription'));
  assert.equal(admin.ready, true);
});

test('el bypass ADMIN se aplica en backend y no se decide desde frontend', () => {
  assert.match(publish, /isAdmin\?: boolean/);
  assert.match(publish, /Boolean\(input\.isAdmin\) \|\| subscriptionAllowsPublishing/);
  assert.match(adminRoute, /isAdmin: true/);
  assert.match(ownerRoute, /isAdmin: req\.user!\.role === 'ADMIN'/);
  assert.doesNotMatch(dashboard, /11990|11\.990/);
});

test('el panel muestra precio recibido por página y permite crear varias páginas', () => {
  assert.match(dashboard, /subscription\?\.amount/);
  assert.match(dashboard, /Crear página web/);
  assert.match(dashboard, /Mis páginas/);
});
