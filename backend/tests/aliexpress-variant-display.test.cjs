const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const V = require('../src/utils/aliexpress-variants.ts');

function pv(id, attrs, extra) {
  return Object.assign({ id, sku: 'AE-' + id, price: 10000, stock: 10 }, extra || {}, { _json: { attributes: attrs } });
}

// A: 3 variantes con diferentes precios -> cada una conserva el suyo.
test('A: precio individual por variante (no minimo comun)', () => {
  const vs = [
    pv('a', [{ name: 'Modelo', value: 'iPad 7' }], { price: 13300 }),
    pv('b', [{ name: 'Modelo', value: 'iPad Air 3' }], { price: 17100 }),
    pv('c', [{ name: 'Modelo', value: 'iPad Pro 11' }], { price: 22800 }),
  ].map(V.normalizeVariant);
  assert.deepEqual(vs.map((v) => v.price), [13300, 17100, 22800]);
});

// B: 3 variantes con diferente envio -> se preserva por variante.
test('B: envio individual por variante', () => {
  const vs = [
    pv('a', [{ name: 'Color', value: 'Negro' }], { supplierShippingUsd: 2 }),
    pv('b', [{ name: 'Color', value: 'Verde' }], { supplierShippingUsd: 3 }),
    pv('c', [{ name: 'Color', value: 'Rosa' }], { supplierShippingUsd: 4 }),
  ].map(V.normalizeVariant);
  assert.deepEqual(vs.map((v) => v.supplierShipping), [2, 3, 4]);
});

// C: 2 atributos Modelo + Color agrupados (4 modelos x 3 colores, sin duplicar SKU).
test('C: agrupacion Modelo x Color', () => {
  const models = ['iPad 7', 'iPad Air 3', 'iPad Mini 4', 'iPad Pro 11'];
  const colors = ['Negro', 'Verde', 'Rosa'];
  const vs = [];
  models.forEach((m) => colors.forEach((c) => vs.push(pv(m + c, [{ name: 'Modelo', value: m }, { name: 'Color', value: c }]))));
  const n = vs.map(V.normalizeVariant);
  const g = V.groupAttributes(n);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0], { name: 'Modelo', options: models });
  assert.deepEqual(g[1], { name: 'Color', options: colors });
});

// D: combinacion inexistente -> undefined (no se inventa).
test('D: combinacion inexistente no se crea', () => {
  const n = [
    pv('a', [{ name: 'Modelo', value: 'Air' }, { name: 'Color', value: 'Negro' }]),
    pv('b', [{ name: 'Modelo', value: 'Air' }, { name: 'Color', value: 'Verde' }]),
  ].map(V.normalizeVariant);
  assert.equal(V.findVariantForSelection(n, { Modelo: 'Air', Color: 'Lila' }), undefined);
  assert.equal(V.isOptionAvailable(n, 'Color', 'Lila', { Modelo: 'Air' }), false);
});

// E: variante sin stock -> opcion deshabilitada.
test('E: sin stock deshabilita la opcion', () => {
  const n = [
    pv('a', [{ name: 'Color', value: 'Negro' }], { stock: 10 }),
    pv('b', [{ name: 'Color', value: 'Verde' }], { stock: 0 }),
  ].map(V.normalizeVariant);
  assert.equal(V.isOptionAvailable(n, 'Color', 'Verde', {}), false);
  assert.equal(V.isOptionAvailable(n, 'Color', 'Negro', {}), true);
  const m = V.findVariantForSelection(n, { Color: 'Verde' });
  assert.equal(m && m.stock, 0);
});

// F: producto sin variantes -> sin selector.
test('F: sin variantes no hay selector', () => {
  assert.equal(V.hasRealVariants([]), false);
  assert.equal(V.hasRealVariants([V.normalizeVariant(pv('a', [{ name: 'Color', value: 'Negro' }]))]), false);
  const one = V.normalizeVariant({ id: 'x', sku: 'x', price: 5, stock: 1, _json: { skuAttr: '' } });
  assert.equal(V.hasRealVariants([one, one]), false);
});

// G: limpieza del SKU tecnico del enunciado + presentacion de modelos.
test('G: 5:1394#...;14:193#for iPad black -> Modelo + Negro', () => {
  const attrs = V.extractAttributes({ skuAttr: '5:1394#iPad 7 8 9th 10.2in;14:193#for iPad black' });
  assert.deepEqual(attrs, [
    { name: 'Modelo', value: 'iPad 7 / 8 / 9 — 10.2"' },
    { name: 'Color', value: 'Negro' },
  ]);
  const joined = attrs.map((a) => a.name + '=' + a.value).join('|');
  assert.ok(!/5:1394|14:193|for iPad|supplierVariantId/i.test(joined));
  const attrs2 = V.extractAttributes({ skuAttr: '5:202098882#iPad Pro 11 2022;14:175#for iPad green' });
  assert.deepEqual(attrs2, [
    { name: 'Modelo', value: 'iPad Pro 11 — 2022' },
    { name: 'Color', value: 'Verde' },
  ]);
  assert.ok(!/202098882|14:175|for iPad/i.test(attrs2.map((a) => a.value).join('|')));
});

// H/I/J: seleccion cambia precio, stock e imagen.
test('H/I/J: seleccionar variante cambia precio, stock e imagen', () => {
  const n = [
    pv('a', [{ name: 'Modelo', value: 'A' }], { price: 13300, stock: 10, supplierImage: 'http://img/a.jpg' }),
    pv('b', [{ name: 'Modelo', value: 'B' }], { price: 22800, stock: 3, supplierImage: 'http://img/b.jpg' }),
  ].map(V.normalizeVariant);
  const sa = V.findVariantForSelection(n, { Modelo: 'A' });
  const sb = V.findVariantForSelection(n, { Modelo: 'B' });
  assert.equal(sa && sa.price, 13300);
  assert.equal(sb && sb.price, 22800);
  assert.equal(sa && sa.stock, 10);
  assert.equal(sb && sb.stock, 3);
  assert.equal(sb && sb.image, 'http://img/b.jpg');
  // Sin imagen especifica -> undefined (frontend mantiene la principal).
  const n2 = [V.normalizeVariant(pv('c', [{ name: 'Modelo', value: 'C' }], { price: 5, stock: 1 }))][0];
  assert.equal(n2.image, undefined);
});

// Traducciones pedidas (FASE 3) + modelos presentados (FASE 4).
test('colores ES-CL y modelos presentados', () => {
  assert.equal(V.translateColorValue('black'), 'Negro');
  assert.equal(V.translateColorValue('pink'), 'Rosa');
  assert.equal(V.translateColorValue('rose'), 'Rosa');
  assert.equal(V.translateColorValue('orange'), 'Naranja');
  assert.equal(V.translateColorValue('brown'), 'Café');
  assert.equal(V.translateColorValue('dark blue'), 'Azul oscuro');
  assert.equal(V.translateColorValue('sky blue'), 'Celeste');
  assert.equal(V.commercialValue('iPad Pro 11 2022', 'Modelo'), 'iPad Pro 11 — 2022');
});

// FASE 4: presentacion segura de modelos.
test('presentModelValue: ejemplos del enunciado', () => {
  assert.equal(V.presentModelValue('iPad 7 8 9th 10.2in'), 'iPad 7 / 8 / 9 — 10.2"');
  assert.equal(V.presentModelValue('iPad Air3 Pro 10.5in'), 'iPad Air 3 / Pro — 10.5"');
  assert.equal(V.presentModelValue('iPad Mini 4 5 7.9in'), 'iPad Mini 4 / 5 — 7.9"');
  assert.equal(V.presentModelValue('iPad Air4 Air5 10.9'), 'iPad Air 4 / 5 — 10.9"');
  assert.equal(V.presentModelValue('iPad Pro 11 2022'), 'iPad Pro 11 — 2022');
  assert.equal(V.presentModelValue('iPad Air11 2024 2025'), 'iPad Air 11 — 2024 / 2025');
});

// FASE 4: si no es seguro, no inventa; y es idempotente.
test('presentModelValue: casos inseguros quedan intactos + idempotencia', () => {
  assert.equal(V.presentModelValue('iPad Pro'), 'iPad Pro');
  assert.equal(V.presentModelValue('Funda Giratoria 360'), 'Funda Giratoria 360');
  assert.equal(V.presentModelValue('Universal Case 2024'), 'Universal Case 2024');
  const presented = V.presentModelValue('iPad 7 / 8 / 9 — 10.2"');
  assert.equal(V.presentModelValue(presented), presented);
});

// FASE 2/3: presentAttributeValue no destruye raw del motor (sku/id intactos).
test('presentAttributeValue: colores y modelos, idempotente', () => {
  assert.equal(V.presentAttributeValue('Color', 'for iPad black'), 'Negro');
  assert.equal(V.presentAttributeValue('Color', 'Negro'), 'Negro');
  assert.equal(V.presentAttributeValue('Modelo', 'iPad 7 8 9th 10.2in'), 'iPad 7 / 8 / 9 — 10.2"');
  assert.equal(V.presentAttributeValue('Capacidad', '128GB'), '128GB');
});

// SKU tecnico AliExpress nunca se muestra (FASE 11).
test('sanitizeSkuForDisplay oculta SKUs tecnicos', () => {
  const P = require('../../frontend/src/utils/productPresentation.ts');
  assert.equal(P.sanitizeSkuForDisplay('5:1394;14:193'), null);
  assert.equal(P.sanitizeSkuForDisplay('14:193#for iPad x'), null);
  assert.equal(P.sanitizeSkuForDisplay('AE-5-1394-14-193'), null);
  assert.equal(P.sanitizeSkuForDisplay('CASA'), 'CASA');
  assert.equal(P.sanitizeSkuForDisplay(''), null);
});

// Variante presentada conserva precio/stock/imagen y resuelve por atributo presentado.
test('variante con skuAttr tecnico: presentacion limpia y resolucion correcta', () => {
  const raw = {
    id: 'v1', sku: 'AE-5-1394-14-193', supplierVariantId: '5:1394;14:193',
    price: 13300, stock: 7, supplierImage: 'http://img/v1.jpg',
    _json: { skuAttr: '5:1394#iPad 7 8 9th 10.2in;14:193#for iPad black' },
  };
  const n = V.normalizeVariant(raw);
  assert.equal(n.sku, 'AE-5-1394-14-193');
  assert.equal(n.supplierVariantId, '5:1394;14:193'); // raw interno intacto
  assert.deepEqual(n.attributes.map((a) => a.value), ['iPad 7 / 8 / 9 — 10.2"', 'Negro']);
  assert.equal(V.findVariantForSelection([n], { Modelo: 'iPad 7 / 8 / 9 — 10.2"', Color: 'Negro' })?.price, 13300);
  assert.equal(V.isOptionAvailable([n], 'Color', 'Verde', {}), false);
});
