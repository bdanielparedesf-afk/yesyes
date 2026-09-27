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

test('el primer intento ya fuerza: el admin borra sin que el sistema le pregunte', () => {
  // Se pidió explícitamente poder borrar "sin cuestionamiento". La única
  // protección que queda no es una duda: es la cancelación del cobro en
  // Mercado Pago, que hace el backend y no se puede saltar.
  assert.match(ADMIN, /data: \{ force: true \}/);
  assert.doesNotMatch(ADMIN, /forceDelete/);
  assert.doesNotMatch(ADMIN, /status === 409/);
  assert.doesNotMatch(ADMIN, /eliminar de todos modos/);
});

test('también se puede eliminar desde el panel de Páginas en línea', () => {
  // El botón estaba solo en la lista de Negocios, y el panel de páginas es
  // donde el admin realmente va a limpiar: por eso no podía borrar nada.
  const PAGES = fs.readFileSync(path.resolve(__dirname, '../src/pages/AdminBusinessPages.tsx'), 'utf8');
  assert.match(PAGES, /data-testid="delete-page"/);
  assert.match(PAGES, /data: \{ force: true \}/);
  assert.match(PAGES, /onEliminar=\{eliminar\}/);
});

/**
 * SELECCIÓN Y BORRADO EN LOTE.
 */
test('cada página tiene su propio checkbox', () => {
  assert.match(ADMIN, /data-testid="select-business"/);
  assert.match(ADMIN, /onChange=\{\(\) => alternarUna\(business\.id\)\}/);
});

test('hay un "seleccionar todo" y refleja cuando están todas marcadas', () => {
  assert.match(ADMIN, /data-testid="select-all"/);
  assert.match(ADMIN, /el\.indeterminate = algunaSeleccionada && !todasSeleccionadas/);
});

test('"seleccionar todo" actúa sobre lo que se ve, no sobre todo el catálogo', () => {
  // Si el admin filtra por "Borrador" y marca todo, espera borrar los
  // borradores. Llevarse también las publicadas sería otro borrado.
  assert.match(ADMIN, /const visibles = filtered\.map\(\(business\) => business\.id\)/);
  assert.match(ADMIN, /visibles\.forEach\(\(id\) => next\.add\(id\)\)/);
});

test('la barra del lote dice cuántas hay y ofrece quitarlas sin borrar', () => {
  assert.match(ADMIN, /data-testid="bulk-count"/);
  assert.match(ADMIN, /data-testid="bulk-clear"/);
  assert.match(ADMIN, /data-testid="bulk-bar"/);
});

test('el lote pide confirmación y avisa del máximo antes de enviarlo', () => {
  assert.match(ADMIN, /data-testid="bulk-confirm-dialog"/);
  assert.match(ADMIN, /ids\.length > MAX_LOTE/);
});

test('el lote va al endpoint de borrado masivo con force', () => {
  assert.match(ADMIN, /api\.post\('\/admin\/business-pages\/bulk-delete', \{ ids, force: true \}\)/);
});

test('un lote parcial se informa, no se esconde como error genérico', () => {
  // Si 40 de 49 se borran, el admin tiene que saber cuáles quedaron y por
  // qué; "no se pudo eliminar" no le sirve de nada.
  assert.match(ADMIN, /fallidas\.length/);
  assert.match(ADMIN, /f\.name\} \(\$\{f\.reason\}/);
});

test('el backend procesa el lote página por página y devuelve el detalle', () => {
  const SERVICE = fs.readFileSync(path.resolve(__dirname, '../../backend/src/services/admin-business-pages.service.ts'), 'utf8');
  const R = fs.readFileSync(path.resolve(__dirname, '../../backend/src/routes/admin.routes.ts'), 'utf8');
  assert.match(SERVICE, /export async function deleteManyBusinesses/);
  assert.match(SERVICE, /for \(const id of ids\)/);
  assert.match(SERVICE, /failed\.push\(\{ id, name: nombre, reason:/);
  // El límite de tamaño no es un adorno: el lote llama al proveedor por página.
  assert.match(SERVICE, /ids\.length > 49/);
  // La ruta del lote va antes que la de un id, o Express lee "bulk" como id.
  assert.ok(R.indexOf("business-pages/bulk-delete") < R.indexOf("router.delete('/business-pages/:id'"));
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

