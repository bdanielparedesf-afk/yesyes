/**
 * YESYES BUSINESS — ETIQUETAS HUMANAS DE SECCION Y DISEÑO.
 *
 * El defecto que este test existe para impedir:
 * `sectionLabel()` solo resolbia códigos de capacidad (`HERO`, `CATALOG`), pero
 * la galería de diseños del asistente pinta `template.functions`, que el backend
 * ya devuelve TRADUCIDOS ("Productos", "Catalogo", "Mapa y ubicacion"). Todos
 * esos chips caían en el fallback y se leía "Sección" cuatro veces por diseño:
 * la galería no decía qué ofrece la página.
 *
 * Se monta el módulo REAL con esbuild; no se replica la lógica aquí.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers/mount.cjs');

const labels = mount('business/businessLabels.ts', 'cert-business-labels');

// ── 1. Códigos de capacidad (manifest, sidebar del editor) ────────────────────

test('L1: los códigos de capacidad siguen traduciéndose', () => {
  assert.equal(labels.sectionLabel('HERO'), 'Presentación');
  assert.equal(labels.sectionLabel('CATALOG'), 'Catálogo');
  assert.equal(labels.sectionLabel('OPENING_HOURS'), 'Horarios');
  assert.equal(labels.sectionLabel('GALLERY'), 'Galería');
  assert.equal(labels.sectionLabel('BOOKING'), 'Reservas');
});

test('L2: el código en minúsculas también resuelve', () => {
  assert.equal(labels.sectionLabel('hero'), 'Presentación');
  assert.equal(labels.sectionLabel('catalog'), 'Catálogo');
});

// ── 2. Nombres ya traducidos que entrega el backend en `functions` ───────────

test('L3: los nombres de `functions` NO caen en "Sección"', () => {
  // Estos son exactamente los strings que devuelve
  // GET /api/public/businesses/templates?category=FOOD.
  const functions = ['Productos', 'Catalogo', 'Galeria', 'Promociones', 'Horarios', 'Mapa y ubicacion', 'Servicios', 'Portafolio', 'Propiedades'];
  const resolved = functions.map((value) => labels.sectionLabel(value));
  const fell = resolved.filter((value) => value === 'Sección');
  assert.deepEqual(fell, [], `estos nombres de función siguen degradando: ${fell.join(', ')}`);
});

test('L4: un nombre humano se conserva o se normaliza, nunca se pierde', () => {
  // El backend escribe en castellano y a veces sin tilde; el usuario debe ver
  // la etiqueta buena, no el texto crudo ni "Sección".
  assert.equal(labels.sectionLabel('Galeria'), 'Galería');
  assert.equal(labels.sectionLabel('Mapa y ubicacion'), 'Ubicación');
  // Y lo que no corresponde a ninguna sección conocida se conserva literal,
  // para que el texto siga siendo cierto en lugar de desaparecer.
  assert.equal(labels.sectionLabel('Menu del dia'), 'Menu del dia');
  assert.equal(labels.sectionLabel('Carta de vinos'), 'Carta de vinos');
});

// ── 3. Casos degenerados: nunca se rompe el render ───────────────────────────

test('L5: entradas vacías o desconocidas no rompen', () => {
  assert.equal(labels.sectionLabel(''), 'Sección');
  assert.equal(labels.sectionLabel('   '), 'Sección');
  assert.equal(labels.sectionLabel('CODE_DESCONOCIDO_XYZ'), 'Sección');
});

test('L6: acentos y mayúsculas no cambian lo que el usuario ve', () => {
  // "Galeria" (lo que emite el backend) y "GALERIA" deben llevar a la misma
  // etiqueta legible, no a dos textos distintos.
  assert.equal(labels.sectionLabel('GALERIA'), 'Galería');
  assert.equal(labels.sectionLabel('Galería'), 'Galería');
  assert.equal(labels.sectionLabel('PRODUCTOS'), 'Productos');
});
