/**
 * ADMIN — ELIMINAR UNA PÁGINA QUE NUNCA SE PUBLICÓ.
 *
 * Este archivo fija la frontera entre "eliminar" y "dar de baja", que es la
 * decisión irreversible más peligrosa del panel. Dar de baja conserva todo;
 * eliminar borra en cascada servicios, fotos y textos sin vuelta atrás.
 *
 * Lo que se fija acá:
 *  - una página que estuvo en línea NUNCA se borra, aunque hoy esté pausada;
 *  - una suscripción viva impide el borrado (el dueño estaría pagando por
 *    una página que dejó de existir);
 *  - la actividad real (leads, pedidos, pagos) impide el borrado;
 *  - sí se borra la página abandonada, que es el caso que motiva la función.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../', rel), 'utf8');
const ADMIN_SERVICE = read('src/services/admin-business-pages.service.ts');
const ADMIN_ROUTES = read('src/routes/admin.routes.ts');

/**
 * Carga la función con un prisma falso. Se ejercita la lógica real (las
 * consultas y los `if` de seguridad) sin tocar la base: el borrado en cascada
 * no se puede probar de verdad contra la base de desarrollo.
 */
function cargarServicio(fakePrisma, fakeAudit) {
  // Solo se quitan los `import`: las referencias a prisma/auditoría se
  // resuelven desde el contexto. Los `export` se dejan para que
  // `transpileModule` genere los `exports` y la función quede alcanzable.
  const source = ADMIN_SERVICE.replace(/^import .*$/gm, '');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    console,
    globalThis: {},
    prisma: fakePrisma,
    publicAvailability: () => ({ live: false, reason: 'OK', graceDaysLeft: 0, graceUntil: null }),
    availabilityLabel: () => '',
    logBusinessAudit: fakeAudit,
  });
  new vm.Script(compiled, { filename: 'admin-business-pages.service.ts' }).runInContext(context);
  return module.exports;
}

const pagina = (over = {}) => ({
  id: 'b-1',
  name: 'Peluquería Luna',
  category: 'HAIR',
  status: 'DRAFT',
  publishedAt: null,
  subscription: null,
  _count: { leads: 0, orders: 0, payments: 0 },
  ...over,
});

function entorno(paginaPrueba) {
  const llamadas = { borrados: [], auditoria: [] };
  const fakePrisma = {
    business: {
      findUnique: async () => paginaPrueba,
      delete: async ({ where }) => { llamadas.borrados.push(where.id); return paginaPrueba; },
    },
  };
  const servicio = cargarServicio(fakePrisma, async (accion, datos) => { llamadas.auditoria.push(accion); });
  return { servicio, llamadas };
}

test('elimina la página que nunca se publicó y deja rastro en auditoría', async () => {
  const { servicio, llamadas } = entorno(pagina());
  const resultado = await servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'admin-1' });
  assert.equal(resultado.deleted, true);
  assert.deepEqual(llamadas.borrados, ['b-1']);
  // Sin auditoría, un borrado irreversible sería indistinguible de un bug.
  assert.deepEqual(llamadas.auditoria, ['BUSINESS_DELETED_UNPUBLISHED']);
});

test('NO borra una página que estuvo publicada aunque hoy esté pausada', async () => {
  // El caso peligroso: "pausada" se ve igual que "nunca publicada" en la
  // lista del admin, y esa página tiene visitas, enlaces y leads.
  const { servicio, llamadas } = entorno(pagina({ status: 'PAUSED', publishedAt: new Date('2026-01-01') }));
  await assert.rejects(
    () => servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'admin-1' }),
    (error) => error.status === 409 && /dar de baja/i.test(error.message),
  );
  assert.deepEqual(llamadas.borrados, []);
});

test('NO borra una página con suscripción: el dueño estaría pagando por nada', async () => {
  const { servicio, llamadas } = entorno(pagina({ subscription: { id: 's-1', status: 'PENDING' } }));
  await assert.rejects(
    () => servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'admin-1' }),
    (error) => error.status === 409 && /suscripción/i.test(error.message),
  );
  assert.deepEqual(llamadas.borrados, []);
});

test('NO borra una página con actividad: hay contactos y pagos de una persona real', async () => {
  const { servicio, llamadas } = entorno(pagina({ _count: { leads: 3, orders: 0, payments: 0 } }));
  await assert.rejects(
    () => servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'admin-1' }),
    (error) => error.status === 409 && /actividad/i.test(error.message),
  );
  assert.deepEqual(llamadas.borrados, []);
});

test('no encuentra la página devuelve 404 y no borra nada', async () => {
  const { servicio, llamadas } = entorno(null);
  await assert.rejects(
    () => servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'admin-1' }),
    (error) => error.status === 404,
  );
  assert.deepEqual(llamadas.borrados, []);
});

test('la ruta de borrado está registrada y es DELETE, no PUT', () => {
  assert.match(ADMIN_ROUTES, /router\.delete\('\/business-pages\/:id'/);
});

test('el servicio se exporta desde las rutas del admin', () => {
  assert.match(ADMIN_ROUTES, /deleteUnpublishedBusiness/);
  assert.match(ADMIN_SERVICE, /export async function deleteUnpublishedBusiness/);
});
