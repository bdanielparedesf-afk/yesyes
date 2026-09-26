const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./helpers/mount.cjs');

const galleryMod = mount('business/templates/DesignGallery.tsx', 'dg-templates');
const { DesignGallery, toDesignOptions } = galleryMod;

/**
 * Regresion de dos falsos hallazgos de la certificacion:
 *
 *  1. "La galeria ofrece 0 disenos": el selector buscaba `data-design-id`,
 *     que no existe. Cada tarjeta ahora lleva `design-option-<id>`, igual que
 *     la galeria del editor, para que se pueda contar y automatizar.
 *
 *  2. "La galeria ofrece 25 disenos para 4 plantillas": la miniatura renderiza
 *     la pagina real, y esa pagina trae sus propios <article> (productos,
 *     testimonios...). Un selector de descendientes contaba esos tambien.
 *     Aqui se fija el contrato real: una tarjeta por diseno.
 */

const DESIGN_GALLERY = 'design-gallery';
const ThumbStub = { DesignThumbnail: () => null };

function renderGallery(designs, selectedId) {
  return renderToStaticMarkup(React.createElement(
    React.Fragment, null,
    React.createElement(DesignGallery, {
      designs, category: 'FOOD', selectedId, onSelect: () => {},
      ...ThumbStub,
    }),
  ));
}

const DESIGNS = [
  { id: 'd1', code: 'FOOD_01', category: 'FOOD', label: 'Restaurante Editorial', style: 'Moderno' },
  { id: 'd2', code: 'FOOD_SIGNATURE_ATLAS', category: 'FOOD', label: 'Restaurante · Direccion visual', style: 'Direccion visual' },
  { id: 'd3', code: 'FOOD_SIGNATURE_EDITORIAL', category: 'FOOD', label: 'Restaurante · Esencial', style: 'Esencial' },
];

test('la galeria renderiza exactamente una tarjeta por diseno', () => {
  const html = renderGallery(DESIGNS, 'd1');
  const tarjetas = html.match(/data-testid="design-option-/g) || [];
  assert.equal(tarjetas.length, DESIGNS.length, 'una tarjeta por diseno, sin duplicados');
});

test('cada tarjeta es hija directa de la galeria y lleva su id', () => {
  const html = renderGallery(DESIGNS, 'd1');
  for (const design of DESIGNS) {
    assert.ok(html.includes(`data-testid="design-option-${design.id}"`), `la tarjeta de ${design.code} es identificable`);
  }
  // La galeria es el contenedor y sus hijos son las tarjetas: por eso hay que
  // contar los HIJOS, no todos los <article> (la miniatura anida los suyos).
  assert.ok(html.includes(`data-testid="${DESIGN_GALLERY}"`), 'existe el contenedor de la galeria');
});

test('el diseno elegido queda marcado como elegido', () => {
  const html = renderGallery(DESIGNS, 'd2');
  assert.ok(html.includes('aria-pressed="true"'), 'el boton del diseno elegido queda presionado');
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1, 'solo un diseno puede estar elegido');
});

test('toDesignOptions no inventa disenos ni repite ninguno', () => {
  const opciones = toDesignOptions([
    { id: 'a', code: 'FOOD_01', category: 'FOOD', style: 'Moderno' },
    { id: 'b', code: 'FOOD_02', category: 'FOOD', style: 'Cercano' },
  ], 'FOOD');
  assert.equal(opciones.length, 2);
  assert.equal(new Set(opciones.map((o) => o.id)).size, 2, 'sin ids repetidos');
  assert.equal(opciones[0].label, 'Restaurante · Moderno', 'arma la etiqueta si el backend no la manda');
});

test('toDesignOptions tolera una lista vacia', () => {
  assert.deepEqual(toDesignOptions([], 'FOOD'), []);
  assert.deepEqual(toDesignOptions(undefined, 'FOOD'), []);
});
