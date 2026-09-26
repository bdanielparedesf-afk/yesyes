/**
 * YESYES BUSINESS — IMAGENES DE EJEMPLO Y CHUNKS CAIDOS.
 *
 * 1. QUITAR una imagen no debe hacer reaparecer la foto de ejemplo.
 *    Antes: `business?.cover || assets[0]?.src`. Como `''` es falsy, quitar la
 *    portada devolvia la foto de Unsplash: el usuario no podia quitar las
 *    imagenes del diseño que eligio.
 *
 * 2. Un chunk dinamico caido (deploy) no puede tumbar la app. El sintoma era
 *    "Algo salió mal / Failed to fetch dynamically imported module: ...
 *    IndustryTemplates-<hash>.js", que dejaba al usuario sin poder terminar el
 *    asistente de creacion.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers/mount.cjs');

const assets = mount('business/assets/index.ts', 'ma-assets');
const boundary = mount('components/ErrorBoundary.tsx', 'ma-boundary');
const { heroImage, heroAsset, firstBusinessImage, thematicAssets } = assets;
const { isChunkLoadError } = boundary;

test('quitar la portada NO hace volver la imagen de ejemplo', () => {
  assert.equal(heroImage({ cover: '' }, 'FOOD'), undefined, 'cover vacio = quitada a proposito');
  assert.equal(heroAsset({ cover: '' }, 'FOOD'), undefined);
});

test('una portada elegida por el usuario gana sobre la foto de ejemplo', () => {
  const mia = 'https://ejemplo.cl/mi-foto.jpg';
  assert.equal(heroImage({ cover: mia }, 'FOOD'), mia);
  assert.equal(heroAsset({ cover: mia, name: 'Casa Aurora' }, 'FOOD').alt, 'Imagen principal de Casa Aurora');
});

test('sin portada se muestra la foto de ejemplo del rubro', () => {
  const ejemplo = thematicAssets('FOOD')[0]?.src;
  assert.ok(ejemplo, 'el rubro tiene foto de ejemplo');
  assert.equal(heroImage({ cover: null }, 'FOOD'), ejemplo, 'aun no eligio: se muestra el ejemplo');
  assert.equal(heroImage({}, 'FOOD'), ejemplo);
});

test('un rubro sin assets propios cae al juego generico, sin romper', () => {
  assert.doesNotThrow(() => heroImage({ cover: null }, 'RUBRO_INVENTADO'));
  // `thematicAssets` cae a `BUSINESS_ASSETS.pro` a proposito: es mejor mostrar
  // una foto generica que dejar la portada vacia.
  assert.equal(heroImage({ cover: null }, 'RUBRO_INVENTADO'), thematicAssets('RUBRO_INVENTADO')[0]?.src);
  // Si el usuario quito la portada, tampoco hay foto genica.
  assert.equal(heroImage({ cover: '' }, 'RUBRO_INVENTADO'), undefined);
});

test('firstBusinessImage respeta la portada quitada', () => {
  assert.equal(firstBusinessImage({ cover: '' }), undefined);
  assert.equal(firstBusinessImage({ cover: 'x.jpg' }).src, 'x.jpg');
  assert.equal(firstBusinessImage({}), undefined);
});

test('se detecta un chunk dinamico caido', () => {
  assert.ok(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/assets/IndustryTemplates-BZdoGP9b.js')));
  assert.ok(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 42 failed')));
  assert.ok(isChunkLoadError(new Error('error loading dynamically imported module')));
  assert.ok(isChunkLoadError(new Error('Importing a module script failed')));
});

test('un error normal NO se confunde con un chunk caido', () => {
  assert.equal(isChunkLoadError(new Error('No se pudo crear la página.')), false);
  assert.equal(isChunkLoadError(new TypeError('x is not a function')), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
});
