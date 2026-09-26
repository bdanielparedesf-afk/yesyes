/**
 * YESYES BUSINESS — MEDIOS DE EJEMPLO (FOTO Y VIDEO).
 *
 * La pagina se veia basica por una razon concreta: el contenido de ejemplo
 * creaba servicios y productos, pero NINGUN medio. El manifest tiene bloques
 * `media-ref` y todos llegaban vacios, asi que no habia nada que ver ni nada
 * que el dueño pudiera reemplazar.
 *
 * Estos tests fijan el comportamiento que lo hace posible:
 *  - la siembra crea filas REALES en `BusinessMedia` y en la galeria,
 *  - las conecta al manifest con referencias `media:<id>` (nunca URLs),
 *  - la config de un bloque no llega vacia (si no, no hay ranura que llenar),
 *  - y la siembra es idempotente por procedencia, no por URL.
 *
 * Son tests de contrato sobre el codigo, sin base de datos.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../', rel), 'utf8');

const CATALOG = read('src/services/business-example-media.ts');
const SERVICE = read('src/services/business-example-media.service.ts');
const CONTROLLER = read('src/controllers/business.controller.ts');
const ROUTES = read('src/routes/business.routes.ts');
const BLOCKS = read('src/template-engine/block-registry.ts');
const DESIGNS = read('src/template-engine/design-registry.ts');
const ROUTES_PUBLIC = read('src/routes/public-business.routes.ts');


test('el catalogo declara imagenes Y un video por rubro', () => {
  assert.match(CATALOG, /slot: 'video'/, 'debe existir la ranura de video');
  assert.match(CATALOG, /kind: 'VIDEO'/, 'debe existir un medio de tipo VIDEO');
  // Varios rubros, no solo uno: la pagina de cualquier negocio debe verse igual.
  const rubros = [...CATALOG.matchAll(/^  ([A-Z_]+):\s*\[/gm)].map((m) => m[1]);
  assert.ok(rubros.length >= 10, `se esperaban 10+ rubros, hay ${rubros.length}`);
  for (const rubro of ['FOOD', 'CAFE', 'HAIR']) {
    assert.ok(rubros.includes(rubro), `falta el rubro ${rubro}`);
  }
});

test('los medios de ejemplo son de stock libre y con alt obligatorio', () => {
  // Sin `alt` un medio no es publicable; el ejemplo no puede abrir esaexception.
  const medios = [...CATALOG.matchAll(/slot: '(\w+)'[^\n]*/g)];
  assert.ok(medios.length > 0);
  assert.match(CATALOG, /alt:/, 'cada medio debe traer su texto alternativo');
  assert.match(CATALOG, /https:\/\/images\.unsplash\.com/, 'fotos de Unsplash');
  assert.match(CATALOG, /https:\/\/videos\.pexels\.com/, 'videos de Pexels');
});

test('la siembra crea filas reales en BusinessMedia y en la galeria', () => {
  assert.match(SERVICE, /prisma\.businessMedia\.create\(/);
  // La galeria de la pagina NO lee BusinessMedia: sale de BusinessGalleryImage.
  // Sin esta segunda siembra la seccion ImageGallery no mostraba nada.
  assert.match(SERVICE, /prisma\.businessGalleryImage\.createMany\(/);
  assert.match(ROUTES_PUBLIC, /gallery: \{ orderBy: \{ position: 'asc' \} \}/,
    'la pagina lee la galeria de BusinessGalleryImage');
});

test('el manifest guarda media:<id> y nunca una URL', () => {
  assert.match(SERVICE, /encodeMediaRef\(/);
  // Solo el CUERPO de la asignacion: el nombre de la funcion aparece tambien
  // en un comentario de cabecera y daria un falso positivo.
  const cuerpo = SERVICE.slice(SERVICE.indexOf('export async function assignExampleMediaToManifest'));
  assert.match(cuerpo, /config\[field\] = encodeMediaRef\(mediaId\)/,
    'la config del bloque se llena con una referencia estable');
  assert.doesNotMatch(cuerpo, /item\.url/,
    'nunca escribir una URL plana en la config del bloque');
});

test('la config de un bloque no llega vacia: hay ranuras que llenar', () => {
  // El bug original: `config: {}` dejaba al bloque sin campo `image`/`video`,
  // asi que no habia donde poner la foto ni que editar en el panel.
  assert.match(BLOCKS, /export function initialBlockConfig/);
  assert.match(DESIGNS, /config: initialBlockConfig\(block\.block\)/,
    'el manifest debe derivar la config del configSchema del bloque');
  assert.doesNotMatch(DESIGNS, /config: \{\},/,
    'ningun bloque puede seguir naciendo con la config vacia');
});

test('la siembra es idempotente por procedencia, no por URL', () => {
  // Reconocer el ejemplo por `metadata.example`: si se reconociera por la URL,
  // editar la foto o borrarla la haria "volver" sola en la proxima siembra.
  assert.match(SERVICE, /example: true/);
  assert.match(SERVICE, /meta\.example === true/);
  // Y al recargar sin `replace` se reutiliza en vez de duplicar.
  assert.match(SERVICE, /alreadySeeded\.length > 0 && !options\.replace/);
});

test('la siembra respeta la eleccion del dueño y nunca la pisa', () => {
  assert.match(SERVICE, /function isReplaceable/);
  assert.match(SERVICE, /if \(!isReplaceable\(config\[field\]\)\) return;/,
    'un medio ya elegido por el usuario no se sobreescribe');
});

test('si el diseño no trae video, se agrega la sección para que se vea', () => {
  assert.match(SERVICE, /hasVideoBlock/);
  assert.match(SERVICE, /block: 'Video'/);
  assert.match(SERVICE, /addedBlocks\.push\('Video'\)/);
});

test('crear la página siembra medios, y si falla no la tumba', () => {
  assert.match(CONTROLLER, /seedExampleMedia/);
  assert.match(CONTROLLER, /assignExampleMediaToManifest/);
  // La creacion ya esta confirmada: una siembra que falle no puede borrarla.
  assert.match(CONTROLLER, /catch \(error\)[\s\S]{0,200}logger\.warn/);
  // Y una pagina ya creada tambien recarga el ejemplo, medios incluidos.
  assert.match(ROUTES, /seedExampleMedia/);
});
