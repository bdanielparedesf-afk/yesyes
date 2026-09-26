/**
 * YESYES BUSINESS — FASE 4.2 · C: PERSISTENCIA DEL MANIFEST V2.
 *
 * Pruebas contra la BASE REAL y el ROUTER REAL (supertest, con la MISMA
 * autenticación de producción). Comprueban el ciclo completo del editor:
 *
 *   C1  una página nueva materializa SiteInstance + Revision
 *   C4  guardar persiste el manifest y abre una revisión
 *   C5  recargar devuelve EXACTAMENTE el mismo manifest
 *   C7  guardar el borrador NO toca la revisión publicada
 *   C8  una página V3 antigua sin instancia se materializa al abrir el editor
 *   §11 el conflicto de revisión responde 409 y no pisa el cambio ajeno
 *
 * Se omite si no hay DATABASE_URL: nunca se falsea un PASS por falta de entorno.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

require('tsx/cjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/lib/prisma.ts');
const { ensureSiteInstance } = require('../src/template-engine/bootstrap.ts');
const { resolveRenderPlan } = require('../src/template-engine/render-plan.ts');
const designRoutes = require('../src/routes/design.routes.ts').default;

const WITH_DB = Boolean(process.env.DATABASE_URL);
const skip = WITH_DB ? false : 'requiere DATABASE_URL';

const suffix = Date.now().toString(36);
let owner = null;
let templateId = null;
let business = null;
let app = null;
let token = null;

/** GET/PUT del router real, autenticados como el owner (JWT real). */
const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
const put = (url) => request(app).put(url).set('Authorization', `Bearer ${token}`);

const crearNegocio = (extra = {}) => prisma.business.create({
  data: {
    ownerId: owner.id,
    name: 'Negocio QA C',
    slug: `qa-fase42-c-${suffix}`,
    category: 'PET',
    templateId,
    status: 'DRAFT',
    description: 'Prueba de persistencia del manifest',
    whatsapp: '+56912345678',
    ...extra,
  },
});

test.before(async () => {
  if (!WITH_DB) return;
  owner = await prisma.user.create({
    data: { email: `fase42-c-${suffix}@qa.test`, password: 'x', name: 'QA', lastName: 'Fase42C', role: 'BUSINESS' },
  });
  const template = await prisma.businessTemplate.findFirst({ where: { active: true, category: 'PET' } });
  if (!template) return;
  templateId = template.id;
  token = jwt.sign({ id: owner.id, email: owner.email }, process.env.JWT_SECRET || 'qa-secret');

  app = express();
  app.use(express.json());
  // El router REAL de diseño, sin bypasear autenticación ni ownership.
  app.use('/api/business', designRoutes);
});

test.after(async () => {
  if (!WITH_DB) return;
  if (owner) {
    await prisma.business.deleteMany({ where: { ownerId: owner.id } });
    await prisma.user.deleteMany({ where: { id: owner.id } });
  }
  await prisma.$disconnect();
});

test('C1: abrir el editor de una página nueva entrega manifest y revisión', { skip }, async () => {
  business = await crearNegocio();
  // El backend materializa la instancia ANTES de responder.
  const response = await get(`/api/business/${business.id}/manifest`);

  assert.strictEqual(response.status, 200);
  assert.ok(response.body.manifest, 'debe devolver un manifest');
  assert.notStrictEqual(response.body.manifest.legacy, true, 'una página nueva no es legacy');
  assert.ok(response.body.manifest.sections.length > 0, 'con secciones reales');
  assert.ok(response.body.updatedAt, 'incluye la marca de la instancia para el control de concurrencia');

  const instance = await prisma.businessSiteInstance.findUnique({ where: { businessId: business.id } });
  assert.ok(instance, 'existe la BusinessSiteInstance');

  const revisions = await prisma.businessSiteRevision.count({ where: { instanceId: instance.id } });
  assert.ok(revisions > 0, 'existe al menos una Revision V2');

  const plan = resolveRenderPlan(instance.manifest);
  assert.strictEqual(plan.legacy, false, 'una página nueva NUNCA cae en la vía legacy');
});


test('C4/C5: guardar persiste el manifest y recargar devuelve el mismo', { skip }, async () => {
  const loaded = await get(`/api/business/${business.id}/manifest`);
  const manifest = loaded.body.manifest;
  manifest.sections[0].blocks[0].config = { ...(manifest.sections[0].blocks[0].config || {}), headline: 'EDITADO EN EL EDITOR' };

  const before = await prisma.businessSiteRevision.count({ where: { instanceId: `site-${business.id}` } });
  const save = await put(`/api/business/${business.id}/manifest`).send({ manifest, baseUpdatedAt: loaded.body.updatedAt, reason: 'test C4' });
  assert.strictEqual(save.status, 200, `el guardado debe ser 200: ${JSON.stringify(save.body)}`);

  const after = await prisma.businessSiteRevision.count({ where: { instanceId: `site-${business.id}` } });
  assert.strictEqual(after, before + 1, 'guardar abre exactamente una revisión');

  // C5: recarga
  const reloaded = await get(`/api/business/${business.id}/manifest`);
  assert.strictEqual(reloaded.status, 200);
  assert.deepStrictEqual(reloaded.body.manifest, manifest, 'recargar devuelve el mismo manifest');
  assert.strictEqual(reloaded.body.manifest.sections[0].blocks[0].config.headline, 'EDITADO EN EL EDITOR');
});

test('C7: guardar el borrador no crea ni modifica la revisión publicada', { skip }, async () => {
  const instanceId = `site-${business.id}`;
  const published = await prisma.businessSiteRevision.findFirst({ where: { instanceId, reason: { startsWith: 'PUBLICADO' } } });
  assert.ok(!published, 'partimos de una página sin publicar');

  const loaded = await get(`/api/business/${business.id}/manifest`);
  const manifest = loaded.body.manifest;
  manifest.sections[0].blocks[0].config = { ...(manifest.sections[0].blocks[0].config || {}), headline: 'BORRADOR SIN PUBLICAR' };
  const save = await put(`/api/business/${business.id}/manifest`).send({ manifest, baseUpdatedAt: loaded.body.updatedAt });
  assert.strictEqual(save.status, 200);

  const publishedAfter = await prisma.businessSiteRevision.findFirst({ where: { instanceId, reason: { startsWith: 'PUBLICADO' } } });
  assert.ok(!publishedAfter, 'guardar el borrador NO publica nada');
  const status = await prisma.business.findUnique({ where: { id: business.id }, select: { status: true } });
  assert.notStrictEqual(status.status, 'PUBLISHED', 'la página sigue sin publicar');
});


test('§11: un cambio ajeno produce 409 y NO pisa el manifest del servidor', { skip }, async () => {
  const loaded = await get(`/api/business/${business.id}/manifest`);
  const manifest = loaded.body.manifest;

  // Otra pestaña guarda primero: la instancia cambia de `updatedAt`.
  const otherTab = JSON.parse(JSON.stringify(manifest));
  otherTab.sections[0].blocks[0].config = { ...(otherTab.sections[0].blocks[0].config || {}), headline: 'DE OTRA PESTANA' };
  const first = await put(`/api/business/${business.id}/manifest`).send({ manifest: otherTab, baseUpdatedAt: loaded.body.updatedAt });
  assert.strictEqual(first.status, 200, `la primera pestaña guarda: ${JSON.stringify(first.body)}`);

  // La segunda sigue con el `baseUpdatedAt` viejo: debe recibir 409.
  const mine = JSON.parse(JSON.stringify(manifest));
  mine.sections[0].blocks[0].config = { ...(mine.sections[0].blocks[0].config || {}), headline: 'MIO' };
  const conflict = await put(`/api/business/${business.id}/manifest`).send({ manifest: mine, baseUpdatedAt: loaded.body.updatedAt });
  assert.strictEqual(conflict.status, 409, 'la segunda pestaña recibe conflicto');
  assert.strictEqual(conflict.body.conflict, true);
  assert.ok(conflict.body.manifest, 'el servidor devuelve su manifest para recargar');

  // Y el cambio ajeno sigue intacto: nadie lo pisa en silencio.
  const after = await get(`/api/business/${business.id}/manifest`);
  assert.strictEqual(after.body.manifest.sections[0].blocks[0].config.headline, 'DE OTRA PESTANA');
});

test('el backend rechaza un manifest inválido en vez de guardarlo', { skip }, async () => {
  const loaded = await get(`/api/business/${business.id}/manifest`);
  const broken = { manifestVersion: 1, sections: [{ id: 'x' }] };
  const response = await put(`/api/business/${business.id}/manifest`).send({ manifest: broken, baseUpdatedAt: loaded.body.updatedAt });
  assert.strictEqual(response.status, 422);
  assert.ok(Array.isArray(response.body.errors) && response.body.errors.length > 0, 'explica por qué');
});

test('C8: una página V3 antigua sin instancia se materializa al abrir el editor', { skip }, async () => {
  // La página antigua tiene `visual.sections` (V3) pero NO SiteInstance.
  const legacy = await crearNegocio({ slug: `qa-fase42-legacy-${suffix}`, visual: { sections: [{ id: 'HERO', enabled: true, order: 10 }] } });
  const instanceBefore = await prisma.businessSiteInstance.findUnique({ where: { businessId: legacy.id } });
  assert.ok(!instanceBefore, 'esta página V3 no tiene SiteInstance');

  const response = await get(`/api/business/${legacy.id}/manifest`);
  assert.strictEqual(response.status, 200, 'abrir el editor responde 200');
  assert.ok(response.body.manifest, 'y entrega un manifest');
  assert.ok(response.body.manifest.sections.length > 0, 'con secciones reales');

  const instance = await prisma.businessSiteInstance.findUnique({ where: { businessId: legacy.id } });
  assert.ok(instance, 'la página antigua materializó su SiteInstance');
  assert.notDeepStrictEqual(
    instance.manifest.sections.map((s) => s.id),
    ['HERO'],
    'el manifest NO viene de visual.sections: viene del diseño',
  );
});

test('C8: ensureSiteInstance sigue siendo idempotente al reabrir el editor', { skip }, async () => {
  const first = await get(`/api/business/${business.id}/manifest`);
  const second = await ensureSiteInstance(business.id);
  assert.strictEqual(second.created, false, 'no se recrea la instancia');
  assert.deepStrictEqual(second.instance.manifest, first.body.manifest, 'el manifest no cambia solo');
});
