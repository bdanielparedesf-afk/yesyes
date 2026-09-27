/**
 * YESYES BUSINESS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â VIDA DE LA PÃƒÆ’Ã‚ÂGINA SEGÃƒÆ’Ã…Â¡N EL PAGO.
 *
 * Estos tests fijan la polÃƒÆ’Ã‚Â­tica acordada: la pÃƒÆ’Ã‚Â¡gina vive con el plan al dÃƒÆ’Ã‚Â­a,
 * sobrevive los 5 dÃƒÆ’Ã‚Â­as de gracia, y a los 5 dÃƒÆ’Ã‚Â­as se da de baja. Y fijan lo mÃƒÆ’Ã‚Â¡s
 * importante: DAR DE BAJA NUNCA BORRA CONTENIDO, para que reactivar sea un clic.
 *
 * El bug que motivÃƒÆ’Ã‚Â³ esto: la ruta pÃƒÆ’Ã‚Âºblica filtraba solo por `status: PUBLISHED`
 * y nunca miraba la suscripciÃƒÆ’Ã‚Â³n, asÃƒÆ’Ã‚Â­ que una pÃƒÆ’Ã‚Â¡gina vencida servÃƒÆ’Ã‚Â­a para siempre
 * (verificado: 3 negocios publicados, 2 sin plan, todos respondiendo 200).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../', rel), 'utf8');
const STATE = read('src/services/business-subscription-state.ts');
const PUBLIC_ROUTES = read('src/routes/public-business.routes.ts');
const ADMIN_SERVICE = read('src/services/admin-business-pages.service.ts');
const ADMIN_ROUTES = read('src/routes/admin.routes.ts');

const HOY = new Date('2026-09-26T12:00:00Z');
const enDias = (n) => new Date(HOY.getTime() + n * 86400000);

let cache;
async function cargarPublicidad() {
  if (cache) return cache;
  const os = require('node:os');
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-'));
  const out = path.join(dir, 'out');
  execFileSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    path.resolve(__dirname, '../src/services/business-subscription-state.ts'),
    '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
  ], { stdio: 'ignore' });
  cache = require(path.join(out, 'business-subscription-state.js')).publicAvailability;
  return cache;
}

test('con el plan al dÃƒÆ’Ã‚Â­a la pÃƒÆ’Ã‚Â¡gina estÃƒÆ’Ã‚Â¡ en lÃƒÆ’Ã‚Â­nea', async () => {
  const publicAvailability = await cargarPublicidad();
  const r = publicAvailability({ businessStatus: 'PUBLISHED', subscription: { status: 'ACTIVE' }, now: HOY });
  assert.equal(r.live, true);
  assert.equal(r.reason, 'OK');
});

test('dentro de los 5 dÃƒÆ’Ã‚Â­as de gracia la pÃƒÆ’Ã‚Â¡gina sigue en lÃƒÆ’Ã‚Â­nea', async () => {
  const publicAvailability = await cargarPublicidad();
  const r = publicAvailability({
    businessStatus: 'PUBLISHED',
    subscription: { status: 'PAST_DUE', graceUntil: enDias(3) },
    now: HOY,
  });
  assert.equal(r.live, true, 'con gracia vigente NO se puede bajar la pÃƒÆ’Ã‚Â¡gina');
  assert.equal(r.reason, 'GRACE_ACTIVE');
  assert.equal(r.graceDaysLeft, 3);
});

test('al vencer la gracia la pÃƒÆ’Ã‚Â¡gina se da de baja', async () => {
  const publicAvailability = await cargarPublicidad();
  const r = publicAvailability({
    businessStatus: 'PUBLISHED',
    subscription: { status: 'PAST_DUE', graceUntil: enDias(-1) },
    now: HOY,
  });
  assert.equal(r.live, false, 'vencida la gracia la pÃƒÆ’Ã‚Â¡gina tiene que caer');
  assert.equal(r.reason, 'EXPIRED');
});

test('PAST_DUE sin fecha de gracia no regala un plazo infinito', async () => {
  const publicAvailability = await cargarPublicidad();
  const r = publicAvailability({
    businessStatus: 'PUBLISHED',
    subscription: { status: 'PAST_DUE', graceUntil: null },
    now: HOY,
  });
  assert.equal(r.live, false, 'un dato ausente no puede dar gracia eterna');
});

test('un negocio publicado SIN plan no esta en linea', async () => {
  const publicAvailability = await cargarPublicidad();
  const r = publicAvailability({ businessStatus: 'PUBLISHED', subscription: null, now: HOY });
  assert.equal(r.live, false);
  assert.equal(r.reason, 'NO_SUBSCRIPTION');
});

test('suscripciÃƒÆ’Ã‚Â³n cancelada, expirada y NONE tampoco dan lÃƒÆ’Ã‚Â­nea', async () => {
  const publicAvailability = await cargarPublicidad();
  for (const status of ['CANCELLED', 'EXPIRED', 'NONE']) {
    const r = publicAvailability({ businessStatus: 'PUBLISHED', subscription: { status }, now: HOY });
    assert.equal(r.live, false, `${status} no puede tener la pÃƒÆ’Ã‚Â¡gina en lÃƒÆ’Ã‚Â­nea`);
  }
});

test('una pÃƒÆ’Ã‚Â¡gina en borrador nunca estÃƒÆ’Ã‚Â¡ en lÃƒÆ’Ã‚Â­nea', async () => {
  const publicAvailability = await cargarPublicidad();
  const r = publicAvailability({ businessStatus: 'DRAFT', subscription: { status: 'ACTIVE' }, now: HOY });
  assert.equal(r.live, false, 'con plan pagado pero sin publicar tampoco hay pÃƒÆ’Ã‚Â¡gina');
});

test('la ruta pÃƒÆ’Ã‚Âºblica consulta la suscripciÃƒÆ’Ã‚Â³n, no solo el status', () => {
  // El filtro por status solo era la fuga. La suscripciÃƒÆ’Ã‚Â³n tiene que estar.
  assert.match(PUBLIC_ROUTES, /LIVE_WHERE/);
  assert.match(PUBLIC_ROUTES, /subscription: \{ is: \{ status: \{ in: \['ACTIVE', 'PENDING', 'PAST_DUE'\] \} \} \}/);
  // Y NINGUNA ruta puede volver a filtrar solo por status.
  const filtrados = [...PUBLIC_ROUTES.matchAll(/status: 'PUBLISHED'/g)];
  assert.equal(filtrados.length, 1, 'solo LIVE_WHERE puede filtrar por PUBLISHED');
});

test('AMBAS rutas pÃƒÆ’Ã‚Âºblicas aplican la polÃƒÆ’Ã‚Â­tica, incluida /page', () => {
  // Se verificÃƒÆ’Ã‚Â³ que `/page` seguÃƒÆ’Ã‚Â­a sirviendo con la gracia vencida: devolvÃƒÆ’Ã‚Â­a 200
  // con 9.805 bytes mientras `/` daba 404. Por eso las dos llaman a la funciÃƒÆ’Ã‚Â³n.
  const llamadas = [...PUBLIC_ROUTES.matchAll(/publicAvailability\(/g)];
  assert.ok(llamadas.length >= 2, 'publishedBySlug y /page deben aplicar la polÃƒÆ’Ã‚Â­tica');
});

test('la suscripciÃƒÆ’Ã‚Â³n no se filtra al pÃƒÆ’Ã‚Âºblico en ninguna respuesta', () => {
  // Si `subscription` saliera en el JSON, se filtran estado y fechas de pago.
  assert.match(PUBLIC_ROUTES, /siteInstance, media: mediaRows, subscription, \.\.\.data/);
  assert.doesNotMatch(PUBLIC_ROUTES, /const \{ subscription, \.\.\.publicBusiness \}[^\n]*\n[^\n]*res\.json/);
});

test('dar de baja NO borra contenido: pausa, nunca elimina', () => {
  // La reassurance para el dueÃƒÆ’Ã‚Â±o: si no regulariza y vuelve, recupera todo.
  assert.match(ADMIN_SERVICE, /data: \{ status: 'PAUSED' \}/);
  assert.doesNotMatch(ADMIN_SERVICE, /businessMedia\.deleteMany|businessService\.deleteMany|businessGalleryImage\.deleteMany/);
  assert.doesNotMatch(ADMIN_SERVICE, /prisma\.business\.delete/);
});

test('restablecer vuelve a publicar sin cobrar de nuevo', () => {
  assert.match(ADMIN_SERVICE, /data: \{ status: 'PUBLISHED', publishedAt: new Date\(\) \}/);
  // No revalida el checklist: es una acciÃƒÆ’Ã‚Â³n de soporte, el admin ya verificÃƒÆ’Ã‚Â³.
  assert.doesNotMatch(ADMIN_SERVICE, /publishBusiness\(/);
});

test('restablecer sin plan se rechaza en vez de fingir que funcionÃƒÆ’Ã‚Â³', () => {
  // Publicar sin suscripciÃƒÆ’Ã‚Â³n dejarÃƒÆ’Ã‚Â­a la pÃƒÆ’Ã‚Â¡gina visible solo por el status:
  // exactamente la fuga que se cerrÃƒÆ’Ã‚Â³. Tiene que dar error.
  assert.match(ADMIN_SERVICE, /if \(!business\.subscription\) \{/);
  assert.match(ADMIN_SERVICE, /Activa el cobro antes de publicarlo/);
});

test('el panel filtra por estado de VIDA, no solo por status del negocio', () => {
  for (const filtro of ['EN_LINEA', 'BAJA', 'GRACIA', 'SIN_PLAN']) {
    assert.match(ADMIN_SERVICE, new RegExp(`'${filtro}'`), `falta el filtro ${filtro}`);
  }
  // "Dadas de baja" son las publicadas que NO viven: por eso mira `status` Y `live`.
  assert.match(ADMIN_SERVICE, /r\.status === 'PUBLISHED' && !r\.live/);
});

test('las tres acciones de soporte existen y el router exige admin', () => {
  for (const verb of ['take-down', 'restore', 'subscription']) {
    assert.match(ADMIN_ROUTES, new RegExp(`business-pages/:id/${verb}`), `falta la acciÃƒÆ’Ã‚Â³n ${verb}`);
  }
  assert.match(ADMIN_ROUTES, /router\.use\(authenticate, requireAdmin\)/);
});

test('el ajuste manual de plan queda auditado', () => {
  assert.match(ADMIN_SERVICE, /BUSINESS_PAYMENT_MANUAL_ACTIVATION/);
  assert.match(ADMIN_SERVICE, /BUSINESS_PAUSED/);
  assert.match(ADMIN_SERVICE, /BUSINESS_RESTORED/);
});

test('la polÃƒÆ’Ã‚Â­tica vive en UN solo archivo', () => {
  // Si alguien reimplementa la regla en la ruta, la polÃƒÆ’Ã‚Â­tica se desincroniza.
  assert.match(STATE, /export function publicAvailability/);
  assert.match(STATE, /GRACE_DAYS_DEFAULT = 5/, 'la gracia son 5 dÃƒÆ’Ã‚Â­as');
});
