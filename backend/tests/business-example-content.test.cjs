/**
 * YESYES BUSINESS — CONTENIDO DE EJEMPLO PERSISTIDO.
 *
 * "Arranca con un ejemplo y editalo" exige que el ejemplo sea REAL: filas en
 * las tablas del negocio, no una maqueta temporal de la galería de diseños.
 * Antes la página creada quedaba con 0 servicios y `cover: null`, y lo único
 * editable eran datos que el usuario tenía que escribir de cero.
 *
 * Estos tests son de contrato sobre el código, sin base de datos: verifican
 * que la siembra exista, sea opt-in, use filas normales y no borre contenido
 * propio cuando se recarga.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SERVICE = fs.readFileSync(
  path.resolve(__dirname, '../src/services/business-example-content.service.ts'),
  'utf8',
);
const CONTROLLER = fs.readFileSync(
  path.resolve(__dirname, '../src/controllers/business.controller.ts'),
  'utf8',
);
const ROUTES = fs.readFileSync(
  path.resolve(__dirname, '../src/routes/business.routes.ts'),
  'utf8',
);
const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '../src/utils/business.ts'),
  'utf8',
);

test('existe un servicio que siembra contenido de ejemplo', () => {
  assert.ok(
    /export async function seedExampleContent/.test(SERVICE),
    'seedExampleContent debe existir',
  );
});

test('la siembra es opt-in: la creación solo la llama si la piden', () => {
  assert.ok(
    /withExampleContent/.test(SCHEMA),
    'el esquema de creación debe aceptar withExampleContent',
  );
  assert.ok(
    /if \(parsed\.data\.withExampleContent\)/.test(CONTROLLER),
    'solo se siembra cuando el cliente lo pide explícitamente',
  );
});

test('crear la página nunca se cae si la siembra falla', () => {
  const bloque = CONTROLLER.slice(CONTROLLER.indexOf('exampleSeeded = false'));
  assert.ok(/try\s*\{/.test(bloque), 'la siembra va en un try/catch');
  assert.ok(
    /logger\.warn/.test(bloque),
    'un fallo de la siembra se registra en vez de romper la creación',
  );
  assert.ok(
    /res\.status\(201\)/.test(bloque),
    'la creación responde 201 aunque la siembra falle',
  );
});

test('la siembra escribe filas normales, no un tipo de dato aparte', () => {
  for (const modelo of [
    'businessService.createMany',
    'businessCatalogItem.createMany',
    'businessTestimonial.createMany',
    'businessFaq.createMany',
    'businessTeamMember.createMany',
  ]) {
    assert.ok(SERVICE.includes(modelo), `debe sembrar ${modelo}`);
  }
  assert.ok(
    !/metadata:\s*\{\s*example/.test(SERVICE),
    'el ejemplo son filas comunes, no filas marcadas como ejemplo',
  );
});

test('recargar el ejemplo no borra lo que el usuario escribió a mano', () => {
  const bloque = SERVICE.slice(SERVICE.indexOf('if (options.replace)'));
  assert.ok(
    /options\.replace/.test(bloque),
    'el borrado previo solo ocurre con replace',
  );
  assert.ok(
    /description:\s*SERVICE_DESCRIPTION/.test(bloque),
    'borra por el texto literal del ejemplo, no todo el negocio',
  );
  assert.ok(
    /shortDescription:\s*PRODUCT_DESCRIPTION/.test(bloque),
    'los productos de ejemplo se reconocen por su texto',
  );
});

test('las propiedades usan los enums reales del esquema', () => {
  assert.ok(
    /operation:\s*'VENTA'/.test(SERVICE) && /type:\s*'CASA'/.test(SERVICE),
    'PropertyOperation y PropertyType son VENTA/CASA, no SALE/HOUSE',
  );
});

test('solo se siembran productos y propiedades en rubros que los muestran', () => {
  assert.ok(
    /WITH_PRODUCTS/.test(SERVICE) && /WITH_PROPERTIES/.test(SERVICE),
    'el contenido depende de la composición del rubro',
  );
  assert.ok(
    /WITH_PROPERTIES\.has\(category\)/.test(SERVICE),
    'las propiedades solo se siembran cuando el rubro las soporta',
  );
});

test('una página ya creada también puede cargar el ejemplo', () => {
  assert.ok(
    /router\.post\('\/:id\/example-content', requireBusinessOwner/.test(ROUTES),
    'debe existir la ruta protegida para sembrar una página existente',
  );
  assert.ok(
    /ownerWhere\(req/.test(ROUTES.slice(ROUTES.indexOf("/:id/example-content"))),
    'la ruta comprueba que el negocio es del solicitante',
  );
});
