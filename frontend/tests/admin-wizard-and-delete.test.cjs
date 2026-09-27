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
test('el botón Eliminar aparece solo en páginas nunca publicadas', () => {
  assert.match(ADMIN, /const sePuedeEliminar = \(business: any\) => !business\.publishedAt/);
  assert.match(ADMIN, /sePuedeEliminar\(business\) \? <button/);
  // El icono va antes del texto en el mismo botón.
  assert.match(ADMIN, /<Trash2 className="h-3\.5 w-3\.5" \/>Eliminar/);
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
  assert.match(ADMIN, /api\.delete\(`\/admin\/business-pages\/\$\{objetivo\.id\}`\)/);
});
