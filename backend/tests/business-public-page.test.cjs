/**
 * YESYES BUSINESS — PÁGINA PÚBLICA (comportamiento observable).
 *
 * Este archivo reemplaza a una prueba que leía el código como texto y exigía
 * cadenas exactas. Ahora se hace la petition DE VERDAD (supertest sobre el
 * router real y la BASE REAL) y se comprueba lo que recibe un visitante:
 *
 *   request -> response -> status -> payload -> comportamiento
 *
 * Se omite si no hay DATABASE_URL: nunca se falsea un PASS por falta de entorno.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');
const request = require('supertest');

require('tsx/cjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/lib/prisma.ts');
const publicRoutes = require('../src/routes/public-business.routes.ts').default;

const WITH_DB = Boolean(process.env.DATABASE_URL);
const skip = WITH_DB ? false : 'requiere DATABASE_URL';

const suffix = Date.now().toString(36);
let ownerId = null;
let businessId = null;
let app = null;

test.before(async () => {
  if (!WITH_DB) return;
  const user = await prisma.user.create({
    data: { email: `fase42-public-${suffix}@qa.test`, password: 'x', name: 'QA', lastName: 'Fase42', role: 'CUSTOMER' },
  });
  ownerId = user.id;
  const template = await prisma.businessTemplate.findFirst({ where: { active: true, category: 'PET' } });
  if (!template) return;

  const business = await prisma.business.create({
    data: {
      ownerId,
      name: 'Clínica Aurora',
      slug: `qa-fase42-public-${suffix}`,
      category: 'PET',
      templateId: template.id,
      status: 'PUBLISHED',
      description: 'Prueba de la página pública',
      whatsapp: '+56912345678',
    },
  });
  businessId = business.id;

  // Un servicio y un producto: los dos recursos deben viajar en la página.
  await prisma.businessService.create({ data: { businessId, name: 'Consulta general', price: 15000, active: true } });
  await prisma.businessCatalogItem.create({ data: { businessId, slug: 'alimento-premium', name: 'Alimento premium', price: 20000, active: true } });

  app = express();
  app.use(express.json());
  app.use('/public/businesses', publicRoutes);
});

test.after(async () => {
  if (!WITH_DB) return;
  if (businessId) await prisma.business.deleteMany({ where: { id: businessId } });
  if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});

test('la página pública entrega servicios Y productos del mismo negocio', { skip }, async () => {
  const response = await request(app).get(`/public/businesses/qa-fase42-public-${suffix}/page`);
  assert.strictEqual(response.status, 200, 'la página pública responde 200');

  const services = response.body.services || [];
  const products = response.body.products || [];
  assert.ok(services.some((s) => s.name === 'Consulta general'), `servicios visibles: ${JSON.stringify(services.map((s) => s.name))}`);
  assert.ok(products.some((p) => p.name === 'Alimento premium'), `productos visibles: ${JSON.stringify(products.map((p) => p.name))}`);
});

test('la página pública no filtre un negocio en DRAFT', { skip }, async () => {
  const slug = `qa-fase42-draft-${suffix}`;
  const draft = await prisma.business.create({
    data: { ownerId, name: 'Borrador QA', slug, category: 'PET', status: 'DRAFT', description: 'No debe verse' },
  });
  try {
    const response = await request(app).get(`/public/businesses/${slug}/page`);
    assert.strictEqual(response.status, 404, 'un borrador no es público');
  } finally {
    await prisma.business.deleteMany({ where: { id: draft.id } });
  }
});

test('el catálogo global no filtra el catálogo del negocio', { skip }, async () => {
  // El catálogo del negocio es independiente del catálogo de la tienda.
  const global = await request(app).get('/public/businesses/templates');
  assert.strictEqual(global.status, 200);
  const businessProducts = await request(app).get(`/public/businesses/qa-fase42-public-${suffix}/products`);
  assert.ok(businessProducts.body.products.every((p) => typeof p.name === 'string'));
});
