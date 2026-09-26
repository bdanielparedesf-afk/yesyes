const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../src/routes/public-business.routes.ts', 'utf8');

test('public: solo negocios PUBLISHED son visibles', () => {
  assert.ok(src.includes("status: 'PUBLISHED'"), 'debe filtrar por PUBLISHED');
  for (const st of ['DRAFT', 'PAUSED', 'ARCHIVED']) {
    assert.ok(!src.includes(`'${st}'`), `la ruta publica no debe mencionar ${st}`);
  }
});

test('public: PUBLIC_SELECT no expone datos internos', () => {
  const start = src.indexOf('const PUBLIC_SELECT = {');
  // El bloque termina en el primer `};` en beginning de linea. No se busca
  // `} as const;` porque Prisma no acepta `orderBy` en readonly y el objeto
  // ya no lleva `as const`: el test debe depender del bloque, no de su forma.
  const end = src.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start, 'PUBLIC_SELECT no encontrado');
  const block = src.slice(start, end);
  for (const forbidden of ['ownerId', 'password', 'token', 'settings', 'leads', 'orders', 'payments', 'mpUserId', 'accessToken']) {
    assert.ok(!block.includes(forbidden), `PUBLIC_SELECT expone ${forbidden}`);
  }
  // FASE 6: los medios salen por el DTO publico, no como filas crudas.
  assert.ok(block.includes('media:'), 'PUBLIC_SELECT debe incluir media para el renderer');
  assert.ok(!block.includes('metadata'), 'PUBLIC_SELECT no debe pedir metadata cruda de medios');
});

test('public: leads validados con Zod, rate limit y antispam', () => {
  assert.ok(src.includes('leadLimiter'), 'sin rate limit en leads/track');
  assert.ok(src.includes('leadSchema.safeParse'), 'sin validacion Zod en leads');
  assert.ok(src.includes('checkSpam'), 'sin antispam en leads');
  assert.ok(src.includes('15 * 60 * 1000'), 'ventana de rate limit');
});

test('public: leads solo se crean en negocios publicados (publishedBySlug)', () => {
  const leadSection = src.slice(src.indexOf("router.post('/:slug/leads'"));
  assert.ok(leadSection.includes('publishedBySlug'), 'leads no pasa por publishedBySlug');
});

test('public: eventos de analytics allow-list', () => {
  for (const ev of ['PAGE_VIEW', 'WHATSAPP_CLICK', 'PHONE_CLICK', 'EMAIL_CLICK', 'LEAD_CREATED', 'PRODUCT_VIEW', 'PROPERTY_VIEW', 'CONTACT_CLICK']) {
    assert.ok(src.includes(ev), `falta evento ${ev}`);
  }
  assert.ok(src.includes('if (!field)'), 'sin allow-list de eventos');
});

test('public: propiedades exige published y available', () => {
  assert.ok(src.includes('published: true, available: true'));
});
