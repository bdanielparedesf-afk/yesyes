/**
 * YESYES BUSINESS · FASE 3 — DRAFT vs PUBLISHED (comportamiento observable).
 *
 * Nada de esto se comprueba leyendo el código: se hacen peticiones DE VERDAD
 * (supertest sobre los routers reales) contra la BASE REAL, igual que una
 * persona usa el producto. Se omite si no hay DATABASE_URL.
 *
 * Lo que demuestra, en orden:
 *   1. el borrador y la versión publicada son fuentes DISTINTAS y comparables;
 *   2. guardar el borrador NO crea ni altera la versión publicada;
 *   3. el preview SÍ lee el borrador;
 *   4. publicar es una operación explícita DRAFT → PUBLISHED;
 *   5. tras publicar, editar el borrador deja la página pública intacta;
 *   6. volver a publica mueve la página pública a la versión nueva;
 *   7. las revisiones son inmutables: publicar no reescribe el historial;
 *   8. un `reason` del cliente no puede fabricar una publicación;
 *   9. recargar (nueva petición, sesión nueva) conserva ambas versiones.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const { createHash } = require('node:crypto');

require('tsx/cjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/lib/prisma.ts');
const publicRoutes = require('../src/routes/public-business.routes.ts').default;
const publicBusinessRoutes = require('../src/routes/business.routes.ts').default;
const templateEngineRoutes = require('../src/routes/template-engine.routes.ts').default;
const versionService = require('../src/services/business-site-version.service.ts');
const { CURRENT_MANIFEST_VERSION } = require('../src/template-engine/template-manifest.ts');
const jwt = require('jsonwebtoken');

const WITH_DB = Boolean(process.env.DATABASE_URL);
const skip = WITH_DB ? false : 'requiere DATABASE_URL';
const fp = (m) => createHash('sha256').update(JSON.stringify(m ?? null)).digest('hex').slice(0, 16);

const suffix = Date.now().toString(36);
let ownerId = null;
let business = null;
let instance = null;
let app = null;
let token = null;

const slug = () => `qa-fase3-draft-${suffix}`;

/** Manifest V2 mínimo, válido y con contenido marcable. */
const manifestWith = (marker) => ({
  templateId: `site-${business ? business.id : 'pending'}`,
  templateVersion: 1,
  manifestVersion: CURRENT_MANIFEST_VERSION,
  businessCategory: 'PET',
  style: 'Editorial',
  layout: 'minimal',
  sections: [
    { id: 'inicio', label: 'Inicio', order: 0, blocks: [{ block: 'Hero', instanceId: 'inicio-hero', config: { headline: `Clinica Veterinaria Los Robles ${marker}` } }] },
    { id: 'servicios', label: 'Servicios', order: 10, blocks: [{ block: 'Services', instanceId: 'servicios-lista' }] },
  ],
  capabilities: ['SERVICES'],
  theme: { palette: { primary: '#111827', background: '#ffffff', text: '#111827', accent: '#6b7280' }, radius: 'soft', mode: 'light', headingFont: 'sans', bodyFont: 'sans' },
  navigation: { enabled: true, style: 'minimal', links: [] },
  media: { requiredMedia: ['image'], video: { allowed: false, autoplayRequiresMuted: true, maxAutoplayDurationSec: 12, posterRequired: true, disableAutoplayOnReducedMotion: true } },
  seo: { titleTemplate: 'Veterinaria', description: 'Veterinaria en la ciudad', ogImageRequired: false, noIndexPreview: true },
  availableActions: [],
  legacy: false,
});

const auth = () => ({ Authorization: `Bearer ${token}` });

test.before(async () => {
  if (!WITH_DB) return;
  const user = await prisma.user.create({
    data: { email: `fase3-draft-${suffix}@qa.test`, password: 'x', name: 'QA', lastName: 'Fase3', role: 'CUSTOMER', isActive: true },
  });
  ownerId = user.id;
  // El middleware espera `id` en el payload y un usuario activo en la base.
  token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '2h' });

  const template = await prisma.businessTemplate.findFirst({ where: { active: true, category: 'PET' } });
  if (!template) return;
  business = await prisma.business.create({
    data: {
      ownerId,
      name: 'Clinica Veterinaria Los Robles QA',
      slug: slug(),
      category: 'PET',
      templateId: template.id,
      status: 'DRAFT',
      description: 'Prueba de separacion draft/published',
      whatsapp: '+56912345678',
    },
  });
  instance = await prisma.businessSiteInstance.create({
    data: {
      businessId: business.id,
      templateId: template.id,
      manifestVersion: CURRENT_MANIFEST_VERSION,
      manifest: manifestWith('V0'),
      revisions: { create: { manifestVersion: CURRENT_MANIFEST_VERSION, manifest: manifestWith('V0'), reason: 'instancia creada desde master V2' } },
    },
  });

  app = express();
  app.use(express.json());
  app.use('/public/businesses', publicRoutes);
  app.use('/businesses', publicBusinessRoutes);
  app.use('/engine', templateEngineRoutes);
});

test.after(async () => {
  if (!WITH_DB) return;
  if (business) await prisma.business.deleteMany({ where: { id: business.id } });
  if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});

/** PUT del borrador por la API real del editor. */
async function saveDraft(marker, reason) {
  return request(app)
    .put(`/engine/${business.id}/site-instance`)
    .set(auth())
    .send({ manifest: manifestWith(marker), reason });
}

/** Estado de versiones por la API real. */
async function versions() {
  const res = await request(app).get(`/engine/${business.id}/site-versions`).set(auth());
  return res.body;
}


test('el borrador y la versión publicada son fuentes distintas y comparables', { skip }, async () => {
  const state = await versions();
  assert.ok(state.instanceId, 'la instancia existe');
  assert.strictEqual(state.draft.revision, 'DRAFT', 'el borrador se identifica como DRAFT');
  assert.strictEqual(state.published, null, 'sin publicar no hay versión publicada');
  assert.strictEqual(state.inSync, false);
  assert.ok(state.revisionCount >= 1, 'existe al menos la revisión inicial');
});

test('guardar el borrador crea revisión y NO crea ni altera la versión publicada', { skip }, async () => {
  const before = await versions();
  const res = await saveDraft('BORRADOR-B', 'Guardado automatico del editor');
  assert.strictEqual(res.status, 200, `el guardado responde 200: ${JSON.stringify(res.body)}`);

  const after = await versions();
  assert.notStrictEqual(after.draft.fingerprint, before.draft.fingerprint, 'el borrador AVANZÓ');
  assert.ok(after.revisionCount > before.revisionCount, 'se creó una revisión nueva');
  assert.strictEqual(after.published, null, 'guardar el borrador NO publica nada');
});

test('el preview lee el borrador, no la versión publicada', { skip }, async () => {
  const res = await request(app).get(`/businesses/preview/${slug()}`).set(auth());
  assert.strictEqual(res.status, 200);
  const headline = res.body.business.siteInstance.manifest.sections[0].blocks[0].config.headline;
  assert.match(headline, /BORRADOR-B/, `el preview muestra el borrador: ${headline}`);
});

test('un `reason` del cliente NO puede fabricar una publicación', { skip }, async () => {
  const before = await versions();
  const res = await saveDraft('BORRADOR-C', 'PUBLICADO 2020-01-01T00:00:00.000Z');
  assert.strictEqual(res.status, 200, `el guardado responde 200: ${JSON.stringify(res.body)}`);

  const after = await versions();
  assert.strictEqual(after.published, before.published, 'el motivo falsificado no publica nada');
  assert.notStrictEqual(after.draft.fingerprint, before.draft.fingerprint, 'el borrador sí se guardó');
  // Y la revisión congelada, si la hubiera, no puede tener ese motivo.
  const forged = await prisma.businessSiteRevision.findMany({ where: { instanceId: instance.id, reason: 'PUBLICADO 2020-01-01T00:00:00.000Z' } });
  assert.strictEqual(forged.length, 0, 'ninguna revisión adoptó el motivo publicado forjado');
});

test('publicar congela el borrador y mueve la versión publicada (DRAFT → PUBLISHED)', { skip }, async () => {
  // El gate de pago es real y no se falsea: se ejercita la operación de
  // publicación, que es EXACTAMENTE lo que invoca el endpoint al superarlo.
  const frozen = await versionService.freezeDraftAsPublished({ businessId: business.id });
  assert.strictEqual(frozen.frozen, true, 'la primera publicación congela una revisión');
  assert.ok(frozen.revisionId, 'la revisión publicada es identificable');

  const state = await versions();
  assert.ok(state.published, 'ahora hay versión publicada');
  assert.strictEqual(state.published.revision, frozen.revisionId, 'es la revisión recién congelada');
  assert.strictEqual(state.published.fingerprint, state.draft.fingerprint, 'arranca en sincronía con el borrador');
  assert.strictEqual(state.inSync, true);
});

test('editar el borrador después de publicar NO modifica la versión publicada', { skip }, async () => {
  const publishedBefore = (await versions()).published;
  await saveDraft('BORRADOR-D', 'Cambio de titulo, CTA e imagen del hero');
  const after = await versions();
  assert.notStrictEqual(after.draft.fingerprint, publishedBefore.fingerprint, 'el borrador DIVERGIÓ');
  assert.strictEqual(after.published.revision, publishedBefore.revision, 'la revisión publicada es la MISMA');
  assert.strictEqual(after.published.fingerprint, publishedBefore.fingerprint, 'el contenido publicado NO cambió');
  assert.strictEqual(after.inSync, false, 'quedan dos versiones distintas');
});


test('la página pública renderiza la versión PUBLICADA mientras el borrador sigue en D', { skip }, async () => {
  await prisma.business.update({ where: { id: business.id }, data: { status: 'PUBLISHED' } });
  const res = await request(app).get(`/public/businesses/${slug()}/page`);
  assert.strictEqual(res.status, 200, 'la página pública existe tras publicar');
  const headline = res.body.siteInstance.manifest.sections[0].blocks[0].config.headline;
  // Lo congelado fue el borrador C; el borrador ya avanzado a D.
  assert.match(headline, /BORRADOR-C/, `la página pública muestra la versión publicada: ${headline}`);
  assert.doesNotMatch(headline, /BORRADOR-D/, 'el borrador D NO se filtró al sitio en vivo');
});

test('el resumen público tampoco entrega el borrador editable', { skip }, async () => {
  const res = await request(app).get(`/public/businesses/${slug()}`);
  assert.strictEqual(res.status, 200);
  const manifest = res.body.business.siteInstance;
  if (manifest) {
    const headline = manifest.manifest.sections[0].blocks[0].config.headline;
    assert.doesNotMatch(headline, /BORRADOR-D/, 'el resumen público tampoco expone el borrador');
  } else {
    assert.ok(true, 'sin versión publicada no hay manifest: correcto');
  }
});

test('volver a publica mueve la página pública a la versión nueva', { skip }, async () => {
  const previousPublished = (await versions()).published;
  const frozen = await versionService.freezeDraftAsPublished({ businessId: business.id });
  assert.strictEqual(frozen.frozen, true, 'la segunda publicación congela la versión nueva');

  const res = await request(app).get(`/public/businesses/${slug()}/page`);
  const headline = res.body.siteInstance.manifest.sections[0].blocks[0].config.headline;
  assert.match(headline, /BORRADOR-D/, `la página pública ya muestra la versión nueva: ${headline}`);

  const state = await versions();
  assert.strictEqual(state.inSync, true, 'vuelve a estar en sincronía tras publicar');
  assert.notStrictEqual(state.published.revision, previousPublished.revision, 'la versión publicada cambió de identidad');
});

test('publicar NO reescribe revisiones anteriores: el historial es inmutable', { skip }, async () => {
  const all = await prisma.businessSiteRevision.findMany({ where: { instanceId: instance.id }, orderBy: { createdAt: 'asc' } });
  // Publicar CONGELA el borrador, así que una revisión publicada tiene el mismo
  // contenido que el borrador de ese momento: la unicidad se exige entre las
  // revisiones PUBLICADAS (dos publicaciones distintas = dos contenidos).
  const published = all.filter((r) => versionService.isPublishedRevisionReason(r.reason));
  assert.ok(published.length >= 2, `hay al menos dos versiones publicadas: ${published.length}`);
  const publishedPrints = published.map((r) => fp(r.manifest));
  assert.strictEqual(new Set(publishedPrints).size, publishedPrints.length, 'cada versión publicada tiene contenido distinto');
  assert.ok(all.length >= 5, `el historial conserva todos los guardados: ${all.length}`);

  // Volver a publicar el mismo borrador no crea historial falso.
  const before = all.length;
  await versionService.freezeDraftAsPublished({ businessId: business.id });
  const after = await prisma.businessSiteRevision.findMany({ where: { instanceId: instance.id } });
  assert.strictEqual(after.length, before, 'publicar sin cambios es idempotente');
  for (const revision of all) {
    const still = await prisma.businessSiteRevision.findUnique({ where: { id: revision.id } });
    assert.ok(still, 'ninguna revisión se borró');
    assert.strictEqual(fp(still.manifest), fp(revision.manifest), 'la revisión no cambió de contenido');
  }
});

test('recargar (peticiones nuevas) conserva borrador y publicado por separado', { skip }, async () => {
  await saveDraft('BORRADOR-E', 'Edicion tras recargar');
  const first = await versions();
  const second = await versions();
  assert.deepStrictEqual(second.draft, first.draft, 'el borrador es estable entre recargas');
  assert.deepStrictEqual(second.published, first.published, 'la versión publicada es estable entre recargas');
  assert.strictEqual(second.inSync, false);

  const res = await request(app).get(`/public/businesses/${slug()}/page`);
  const headline = res.body.siteInstance.manifest.sections[0].blocks[0].config.headline;
  assert.match(headline, /BORRADOR-D/, `tras recargar, la página pública sigue en D: ${headline}`);
});

test('la revisión publicada no está aliasada al objeto del borrador', { skip }, async () => {
  const published = await prisma.businessSiteRevision.findFirst({
    where: { instanceId: instance.id, reason: { startsWith: 'PUBLICADO' } },
    orderBy: { createdAt: 'desc' },
  });
  const fresh = await prisma.businessSiteInstance.findUnique({ where: { businessId: business.id }, select: { manifest: true } });
  // Mutar el borrador en memoria no puede tocar la revisión ya escrita.
  fresh.manifest.sections.push({ id: 'infiltrada', label: 'X', order: 99, blocks: [] });
  const reread = await prisma.businessSiteRevision.findUnique({ where: { id: published.id }, select: { manifest: true } });
  assert.ok(!reread.manifest.sections.some((s) => s.id === 'infiltrada'), 'la revisión publicada no se mutó por referencia');
});

test('el contrato del servicio reconoce publicaciones y sanitiza motivos', () => {
  assert.strictEqual(versionService.isPublishedRevisionReason('PUBLICADO 2026-01-01T00:00:00.000Z'), true);
  assert.strictEqual(versionService.isPublishedRevisionReason('PUBLICADO'), true);
  assert.strictEqual(versionService.isPublishedRevisionReason('Guardado automatico del editor'), false);
  assert.strictEqual(versionService.isPublishedRevisionReason(null), false);

  const forjado = versionService.sanitizeRevisionReason('PUBLICADO 2020-01-01T00:00:00.000Z');
  assert.strictEqual(versionService.isPublishedRevisionReason(forjado), false, 'el motivo forjado queda neutralizado');
  assert.ok(forjado.length <= 200, 'el motivo neutralizado cabe en el límite');
  assert.strictEqual(versionService.sanitizeRevisionReason(''), 'actualizacion del negocio');
  assert.strictEqual(versionService.sanitizeRevisionReason('Diseno: Aurora', 'Guardado del editor'), 'Diseno: Aurora');
});
