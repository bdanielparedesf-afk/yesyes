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
function cargarServicio(fakePrisma, fakeAudit, fakeCancel) {
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
    cancelSubscription: fakeCancel,
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
  const llamadas = { borrados: [], auditoria: [], canceladas: 0 };
  const fakePrisma = {
    business: {
      findUnique: async () => paginaPrueba,
      delete: async ({ where }) => { llamadas.borrados.push(where.id); return paginaPrueba; },
    },
  };
  const cancelSubscription = async () => { llamadas.canceladas += 1; };
  const servicio = cargarServicio(fakePrisma, async (accion) => { llamadas.auditoria.push(accion); }, cancelSubscription);
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
  assert.match(ADMIN_ROUTES, /force: \(req\.body as any\)\?\.force === true/);
});

/**
 * BORRADO FORZADO (limpieza de páginas de prueba).
 *
 * El admin pidió poder borrar cualquier página. Se puede, pero el forzado tiene
 * una regla que NO es negociable: si hay un cobro vivo de Mercado Pago, se
 * cancela en el proveedor antes de borrar la fila local. Sin eso, el dueño
 * seguiría pagando un plan recurrente por una página que ya no existe.
 */
test('con force borra una página con suscripción, canceling antes el cobro', async () => {
  const { servicio, llamadas } = entorno(pagina({
    status: 'PUBLISHED', publishedAt: new Date('2026-01-01'),
    subscription: { id: 's-1', status: 'ACTIVE', providerSubscriptionId: 'mp-123' },
  }));
  const r = await servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'a-1', force: true });
  assert.equal(r.deleted, true);
  assert.equal(r.forced, true);
  // El cobro se cancela ANTES de borrar, no después.
  assert.equal(llamadas.canceladas, 1);
  assert.deepEqual(llamadas.borrados, ['b-1']);
  assert.deepEqual(llamadas.auditoria, ['BUSINESS_DELETED_FORCED']);
});

test('si el cobro no se puede cancelar, NO se borra la página', async () => {
  // El peor resultado posible: le dices al dueño que ya no existe y le siguen
  // cobrando. Se prefiere fallar y que el admin reintente.
  const llamadas = { borrados: [] };
  const fakePrisma = {
    business: {
      findUnique: async () => pagina({ subscription: { id: 's-1', status: 'ACTIVE', providerSubscriptionId: 'mp-123' } }),
      delete: async ({ where }) => { llamadas.borrados.push(where.id); },
    },
  };
  const cancelSubscription = async () => { throw new Error('Mercado Pago no responde'); };
  const servicio = cargarServicio(fakePrisma, async () => {}, cancelSubscription);
  await assert.rejects(
    () => servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'a-1', force: true }),
    (error) => error.status === 502 && /Mercado Pago/i.test(error.message),
  );
  assert.deepEqual(llamadas.borrados, [], 'la página NO puede quedar borrada con el cobro vivo');
});

test('sin preapproval no hay nada que cancelar en el proveedor', async () => {
  const { servicio, llamadas } = entorno(pagina({ status: 'PUBLISHED', publishedAt: new Date('2026-01-01') }));
  await servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'a-1', force: true });
  assert.equal(llamadas.canceladas, 0);
  assert.deepEqual(llamadas.borrados, ['b-1']);
});

test('el borrado forzado queda en una acción de auditoría propia', async () => {
  // Se audita aparte del borrado normal: es lo que permite revisar después
  // qué se eliminó saltándose la protección.
  const { servicio, llamadas } = entorno(pagina({ status: 'PUBLISHED', publishedAt: new Date('2026-01-01') }));
  await servicio.deleteUnpublishedBusiness({ businessId: 'b-1', adminId: 'a-1', force: true });
  assert.deepEqual(llamadas.auditoria, ['BUSINESS_DELETED_FORCED']);
  assert.match(ADMIN_SERVICE, /BUSINESS_DELETED_FORCED/);
});

test('el servicio se exporta desde las rutas del admin', () => {
  assert.match(ADMIN_ROUTES, /deleteUnpublishedBusiness/);
  assert.match(ADMIN_SERVICE, /export async function deleteUnpublishedBusiness/);
});
