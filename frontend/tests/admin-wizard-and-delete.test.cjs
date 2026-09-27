const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WIZARD = fs.readFileSync(path.resolve(__dirname, '../src/pages/BusinessWizard.tsx'), 'utf8');
const ADMIN = fs.readFileSync(path.resolve(__dirname, '../src/pages/AdminBusinesses.tsx'), 'utf8');

/**
 * ADMIN Y HOME COMPARTEN EL MISMO ASISTENTE.
 *
 * Antes el admin tenía un formulario propio de 3 pasos: se elegía un diseño
 * sin verlo, sin vista previa y sin preguntar descripción ni WhatsApp. El
 * admin terminaba reconstruyendo la página a mano, y el cliente se quedaba
 * con algo distinto de lo que había probado. Estos tests fijan que el botón
 * del admin abre el MISMO asistente, en modo admin.
 */
test('el botón de crear del admin abre el asistente unificado en modo admin', () => {
  assert.match(ADMIN, /navigate\('\/negocio\/nuevo\?admin=1'\)/);
  // Si el admin vuelve a su propio modal, esta aserción falla.
  assert.doesNotMatch(ADMIN, /wizardOpen/);
});

test('el modo admin se activa solo con el query param explícito', () => {
  assert.match(WIZARD, /params\.get\('admin'\) === '1'/);
});

test('el paso de propietario solo existe en modo admin y va primero', () => {
  const build = WIZARD.match(/function buildSteps[\s\S]*?\n}/)?.[0] || '';
  // Primero: define para quién se crea. Decidirlo al final tira el trabajo.
  assert.match(build, /'Propietario', \.\.\.STEPS_BASE/);
  // El cliente no lo ve: no tiene sentido ni legal para un usuario normal.
  assert.match(build, /return modoAdmin \?/);
});

test('el cliente NO ve el paso de propietario', () => {
  // El bloque va guardado por `modoAdmin`; sin eso, un usuario normal podría
  // asignar su página a otra cuenta.
  assert.match(WIZARD, /\{step === 0 && modoAdmin && \(/);
});

test('en modo admin se puede crear para un cliente o como proyecto propio', () => {
  assert.match(WIZARD, /admin\/businesses'.*ownerId/s);
  assert.match(WIZARD, /ownerMode === 'propio' \|\| Boolean\(ownerId\)/);
});

test('no se puede avanzar en el paso de propietario sin decidir dueño', () => {
  // Sin esta guarda se creaban páginas huérfanas que después nadie sabe a
  // quién devolverle el acceso.
  assert.match(WIZARD, /ownerMode === 'propio' \|\| Boolean\(ownerId\)/);
  assert.match(WIZARD, /disabled=\{!canContinue\}/);
});

test('los pasos del asistente no dependen de índices fijos', () => {
  // Los índices fijos (`step === 1`) son el error clásico al insertar un paso:
  // rompen uno de los dos caminos. Todos los bloques deben usar constantes.
  assert.doesNotMatch(WIZARD, /\{step === [1-4] &&/);
  assert.match(WIZARD, /stepIndex\(modoAdmin,/);
});

/**
 * ELIMINAR SOLO LO QUE NUNCA SE PUBLICÓ.
 */
test('el botón Eliminar pide confirmación en cualquier página', () => {
  // El botón ya no se esconde: la barrera es el backend preguntando, no la UI
  // ocultando el control. Un admin que limpia 50 páginas de prueba no debería
  // tener que filtrar para encontrar el botón.
  assert.match(ADMIN, /data-testid="delete-business"/);
  assert.match(ADMIN, /data-testid="confirm-delete-business"/);
  assert.match(ADMIN, /¿Eliminar/);
});

test('eliminar pide confirmación y nombra la página', () => {
  // Un borrado en cascada no tiene vuelta atrás: sin confirmación, un clic
  // equivocado borra el trabajo del dueño.
  assert.match(ADMIN, /confirmDelete && \(/);
  assert.match(ADMIN, /¿Eliminar “\{confirmDelete\.name\}”\?/);
  assert.match(ADMIN, /data-testid="confirm-delete-business"/);
});

test('el botón de eliminar va al endpoint de borrado, no al de estado', () => {
  // Confundir los dos dejaría la página pausada creyéndola eliminada.
  assert.match(ADMIN, /api\.delete\(`\/admin\/business-pages\/\$\{objetivo\.id\}`/);
});

/**
 * ELIMINAR CUALQUIER PÁGINA (limpieza de prueba), en dos pasos.
 */
test('el botón Eliminar aparece en cualquier página, no solo en las no publicadas', () => {
  // La barrera real es el backend y pide confirmación, no esconder el botón:
  // un admin que limpia 50 páginas de prueba no debería tener que filtrar.
  assert.doesNotMatch(ADMIN, /sePuedeEliminar/);
  assert.match(ADMIN, /data-testid="delete-business"/);
});

test('el primer intento no fuerza: si el backend lo rechaza, se pide confirmación', () => {
  assert.match(ADMIN, /data: \{ force: forceDelete \}/);
  // El 409 no es un error: es la pregunta "¿igual borras?".
  assert.match(ADMIN, /status === 409/);
  assert.match(ADMIN, /setForceDelete\(true\)/);
  assert.match(ADMIN, /eliminar de todos modos/);
});

/**
 * BIBLIOTECA DE EJEMPLARES REUTILIZABLES.
 *
 * Lo que se fija acá es la garantía que hace que la biblioteca sirva: un
 * ejemplo es una COPIA, sobrevive al borrado de la página de la que salió, y
 * reutilizarlo crea una página nueva sin tocar ninguna existente.
 */
const SERVICE = fs.readFileSync(path.resolve(__dirname, '../../backend/src/services/business-page-library.service.ts'), 'utf8');
const ROUTES = fs.readFileSync(path.resolve(__dirname, '../../backend/src/routes/admin.routes.ts'), 'utf8');
const SCHEMA = fs.readFileSync(path.resolve(__dirname, '../../backend/prisma/schema.prisma'), 'utf8');
const LIBRARY_PAGE = fs.readFileSync(path.resolve(__dirname, '../src/pages/AdminPageLibrary.tsx'), 'utf8');
const MIGRATION = fs.readFileSync(path.resolve(__dirname, '../../backend/prisma/migrations/20260927120000_business_page_library/migration.sql'), 'utf8');

test('la biblioteca es una tabla propia, no un campo en businesses', () => {
  // Si fuera un business más, la limpieza de páginas de prueba se llevaría
  // por delante los mejores ejemplos.
  assert.match(SCHEMA, /model BusinessPageLibrary/);
  assert.match(SCHEMA, /@@map\("business_page_library"\)/);
});

test('el ejemplo NO tiene relación con la página de origen: sobrevive al borrado', () => {
  // `sourceBusinessId` es un id suelto, sin @relation ni cascade. Si alguna vez
  // se le pone relación, la limpieza de negocios borra los ejemplos.
  const inicio = SCHEMA.indexOf('model BusinessPageLibrary');
  // Se corta en la llave de cierre del modelo, no con un ancho fijo: si el
  // modelo crece, un slice por caracteres se mete en el siguiente y el test
  // miente sobre lo que está afirmando.
  const modelo = SCHEMA.slice(inicio, SCHEMA.indexOf('\n}', inicio));
  assert.match(modelo, /sourceBusinessId\s+String\?/);
  assert.doesNotMatch(modelo, /sourceBusiness\s+Business/);
  assert.doesNotMatch(modelo, /onDelete: Cascade/);
});

test('el contenido guardado es un snapshot, no una referencia', () => {
  assert.match(SERVICE, /snapshot:\s*snapshot as any/);
  // Si guardara ids, el ejemplo arrastraría datos del dueño original.
  const snapshot = SERVICE.slice(SERVICE.indexOf('const snapshot = {'), SERVICE.indexOf('const row = await prisma.businessPageLibrary.create'));
  assert.doesNotMatch(snapshot, /\b(id|businessId):\s*s\./);
});

test('reutilizar crea una página NUEVA en borrador y no toca la original', () => {
  assert.match(SERVICE, /status:\s*'DRAFT'/);
  assert.match(SERVICE, /uniqueBusinessSlugFor\(nombre\)/);
  // La página de la que salió el ejemplo solo se lee, nunca se actualiza.
  assert.doesNotMatch(SERVICE, /businessPageLibrary\.update\(\{ where: \{ id: business\.id/);
});

test('reutilizar copia el contenido a la página nueva', () => {
  for (const modelo of ['businessService', 'businessCatalogItem', 'businessGalleryImage', 'businessTestimonial', 'businessFaq', 'businessPromotion', 'businessTeamMember']) {
    assert.match(SERVICE, new RegExp(`prisma\\.${modelo}\\.create`), `falta copiar ${modelo}`);
  }
});

test('apartar un ejemplo es distinto de borrarlo', () => {
  // Apartar es para dejar de usarlo sin perderlo; borrar es definitivo.
  assert.match(SERVICE, /export async function setLibraryArchived/);
  assert.match(SERVICE, /export async function deleteLibraryEntry/);
});

test('un ejemplo apartado no se puede reutilizar', () => {
  assert.match(SERVICE, /if \(entry\.archived\)[\s\S]*?status: 409/);
});

test('se cuenta cuántas veces se reutilizó cada ejemplo', () => {
  // Es el dato que dice si un ejemplo sirve de base o solo ocupa espacio.
  assert.match(SERVICE, /timesUsed: \{ increment: 1 \}/);
  assert.match(SCHEMA, /timesUsed\s+Int\s+@default\(0\)/);
});

test('la biblioteca es solo de admin: las rutas cuelgan del router con requireAdmin', () => {
  assert.match(ROUTES, /router\.use\(authenticate, requireAdmin\)/);
  assert.match(ROUTES, /router\.get\('\/page-library'/);
  assert.match(ROUTES, /router\.post\('\/page-library\/:\w+\/reuse'/);
  // Un cliente no tiene ruta para esto en ningún lado.
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, '../../backend/src/routes/business.routes.ts'), 'utf8'), /page-library/);
});

test('la migración es aditiva e idempotente', () => {
  assert.match(MIGRATION, /CREATE TABLE IF NOT EXISTS/);
  // No debe tocar lo que ya existe.
  assert.doesNotMatch(MIGRATION, /DROP\s+(TABLE|COLUMN)/i);
  assert.doesNotMatch(MIGRATION, /DELETE\s+FROM/i);
});

test('el admin puede guardar una página como ejemplo y reutilizarla', () => {
  assert.match(LIBRARY_PAGE, /Usar este ejemplo/);
  assert.match(LIBRARY_PAGE, /data-testid="library-reuse"/);
  // Reutilizar pide nombre y cliente: sin dueño la página quedaría huérfana.
  assert.match(LIBRARY_PAGE, /disabled=\{!newName\.trim\(\) \|\| !newOwner/);
});

test('borrar un ejemplo pide confirmación', () => {
  assert.match(LIBRARY_PAGE, /data-testid="library-delete-dialog"/);
  assert.match(LIBRARY_PAGE, /¿Eliminar el ejemplo/);
});

