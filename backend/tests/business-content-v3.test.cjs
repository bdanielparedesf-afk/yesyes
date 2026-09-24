const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const routes = fs.readFileSync(path.join(__dirname, '../src/routes/business.routes.ts'), 'utf8');
const publicRoutes = fs.readFileSync(path.join(__dirname, '../src/routes/public-business.routes.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/dashboard/DesignSection.tsx'), 'utf8');
const registry = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/registry.tsx'), 'utf8');
const seed = fs.readFileSync(path.join(__dirname, '../prisma/seed-business.ts'), 'utf8');

test('contenido Business: CRUD usa allow-list y ownership en rutas', () => {
  for (const section of ['testimonials', 'faqs', 'promotions', 'team']) assert.ok(routes.includes(`content/:${section}`) || routes.includes(`content/:section`) || routes.includes(section));
  assert.ok(routes.includes("requireBusinessOwner"));
  assert.ok(routes.includes("findFirst({ where: { id: itemId, businessId } })"));
  assert.ok(routes.includes("deleteMany({ where: { id: String(req.params.itemId), businessId } })"));
  assert.ok(!routes.includes('prisma.product.*businessTestimonial'));
});

test('reservas: listar, cambiar estado y slots están scoped y protegidos', () => {
  assert.ok(routes.includes("router.get('/:businessId/bookings', requireBusinessOwner"));
  assert.ok(routes.includes('prisma.booking.updateMany({ where: { id: bookingId, businessId }'));
  assert.ok(routes.includes("router.put('/:businessId/booking-slots', requireBusinessOwner"));
  assert.ok(publicRoutes.includes("router.post('/:slug/bookings'"));
  assert.ok(publicRoutes.includes('businessService.findFirst({ where: { id: data.serviceId, businessId: b.id'));
});

test('payload público incluye sólo contenido Business activo y no ownerId', () => {
  assert.ok(publicRoutes.includes("businessId: b.id, active: true"));
  assert.ok(publicRoutes.includes("team: b.teamMembers"));
  assert.ok(!publicRoutes.includes('ownerId: true'));
});

test('editor visual: autosave debounce, retry y confirmación de template', () => {
  assert.ok(dashboard.includes('setTimeout(() => persist(next), 800)'));
  assert.ok(dashboard.includes("status === 'error'"));
  assert.ok(dashboard.includes('Reintentar guardado'));
  assert.ok(dashboard.includes('window.confirm'));
});

test('registry incluye los 25 templates y renderer prioriza templates dedicados', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/BusinessPageRenderer.tsx'), 'utf8');
  assert.ok(seed.includes('25 templates'));
  for (const code of ['FOOD_01','BOUTIQUE_01','PHOTO_01','BEAUTY_01','DETAILING_01','CLEANING_01','MECHANIC_01','TUTORING_01','CONSTRUCTION_01']) {
    assert.ok(seed.includes(`'${code}'`));
    assert.ok(registry.includes(code));
  }
  const dedicatedCall = renderer.indexOf('if (hasDedicatedTemplate(templateCode))');
  const specializedCall = renderer.indexOf('if (isSpecializedCategory(props.business?.category))');
  assert.ok(dedicatedCall >= 0 && specializedCall >= 0 && dedicatedCall < specializedCall);
});
