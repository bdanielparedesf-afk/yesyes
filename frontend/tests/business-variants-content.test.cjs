/**
 * YESYES BUSINESS — FASE A · A4: LA VARIANTE NO PIERDE CONTENIDO.
 *
 * Cambiar de diseño o de variante es una decisión de FORMA. El contenido vive
 * en la base y no puede desaparecer porque se haya elegido "Editorial": si
 * "Tarjetas" muestra 3 precios y "Editorial" muestra 2, es un bug de perdidas
 * de datos disfrazado de diseño.
 *
 * Este test recorre TODAS las variantes de TODOS los bloques y verifica que el
 * contenido del negocio sigue presente.
 *
 * MATRIZ DE OMITIR: hay ausencias INTENCIONALES, propias del diseño de cada
 * variante, que no son una perdida de datos:
 *
 *   - `minimal`       -> la variante ES "lo mínimo": no muestra descripciones.
 *   - `Booking/cta`   -> la variante ES "solo la acción": no lista horarios,
 *                        porque la reserva se coordina por conversacion.
 *
 * Todo lo demas debe estar SIEMPRE.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderBlock, VARIANT_DEFINITIONS } = require('./helpers/variants-harness.cjs');

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** Datos que el negocio tiene y que NINGUNA variante puede borrar. */
const SIEMPRE = {
  Services: ['Consulta General', 'Vacunación', 'Cirugía', CLP.format(25000), CLP.format(18000)],
  Products: ['Alimento Premium', 'Juguete interactivo', 'Cama ortopédica', CLP.format(32000), CLP.format(8900)],
  Properties: ['Casa en Las Condes', 'Depto en Providencia', CLP.format(320000000), CLP.format(450000)],
  Testimonials: ['María González', 'Juan Pérez', 'Ana López', 'Mi perro volvió como nuevo.'],
  Team: ['Dra. Camila Rojas', 'Dr. Sebastián Soto', 'Médica veterinaria'],
  FAQ: ['¿Atienden a domicilio?', 'Sí, en todo Santiago centro.', '¿Qué medios de pago aceptan?'],
  Promotions: ['2x1 en vacunas', 'Examen gratis', '50% OFF'],
  Booking: ['Lunes', 'Miércoles', '09:00 - 13:00', '10:00 - 14:00'],
};

/**
 * Descripciones y bios. La regla real NO es "siempre salir", sino "NUNCA menos
 * que la variante por defecto": si el bloque base ya no mostraba la
 * descripcion, ninguna variante puede empezar a mostrarla ni a perderla.
 * El test compara contra la variante por defecto, que es el contrato.
 */
const DESCRIPCION_Y_BIO = {
  Services: ['Revisión completa', 'Vacunas y desparasitación'],
  Products: ['12 kg de comida', 'Para perros activos'],
  Team: ['10 años de experiencia', 'Especialista en traumatología'],
};

/** El HTML escapado por React (`&`, `"`, tildes) se normaliza para comparar. */
const normalize = (html) => html
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/&nbsp;| /g, ' ')
  .replace(/&mdash;/g, '—')
  .replace(/&middot;/g, '·')
  .replace(/&aacute;/g, 'á')
  .replace(/&eacute;/g, 'é')
  .replace(/&iacute;/g, 'í')
  .replace(/&oacute;/g, 'ó')
  .replace(/&uacute;/g, 'ú');

test('A4: cambiar de variante conserva todo el contenido del negocio', () => {
  const perdidas = [];
  for (const entry of VARIANT_DEFINITIONS) {
    const exigido = SIEMPRE[entry.block] || [];
    for (const variant of entry.variants) {
      // Booking/cta es "solo accion": no lista horarios por diseño.
      const omiteHorarios = entry.block === 'Booking' && variant.id === 'cta';
      const html = normalize(renderBlock(entry.block, { presentation: variant.config.presentation }));
      for (const dato of exigido) {
        if (omiteHorarios && (/^\d\d:\d\d/.test(dato) || dato === 'Lunes' || dato === 'Miércoles')) continue;
        if (!html.includes(dato)) perdidas.push(`${entry.block}/${variant.id} perdió «${dato}»`);
      }
    }
  }
  assert.deepEqual(perdidas, [], 'una variante no puede borrar contenido del negocio');
});

test('A4b: ninguna variante muestra MENOS informacion que la variante por defecto', () => {
  // Este es el contrato de "no perder contenido": la variante por defecto es la
  // linea base. Se exonera SOLO a `minimal`, cuya propuesta de valor es
  // justamente ser mas sobria ("Solo nombre y precio, sin imagenes"): aun asi
  // debe conservar nombre y precio, y eso lo verifica A4c.
  const perdidas = [];
  for (const entry of VARIANT_DEFINITIONS) {
    const base = normalize(renderBlock(entry.block, { presentation: entry.defaultVariant }));
    for (const variant of entry.variants) {
      if (variant.id === entry.defaultVariant || variant.id === 'minimal') continue;
      const html = normalize(renderBlock(entry.block, { presentation: variant.config.presentation }));
      for (const [bloque, datos] of Object.entries(DESCRIPCION_Y_BIO)) {
        if (bloque !== entry.block) continue;
        for (const dato of datos) {
          if (base.includes(dato) && !html.includes(dato)) {
            perdidas.push(`${entry.block}/${variant.id} perdió «${dato}», que la variante por defecto sí mostraba`);
          }
        }
      }
    }
  }
  assert.deepEqual(perdidas, [], 'una variante no puede mostrar menos que la variante por defecto');
});

test('A4c: "minimal" oculta la descripcion a proposito, no por error', () => {
  const minimal = normalize(renderBlock('Services', { presentation: 'minimal' }));
  const cards = normalize(renderBlock('Services', { presentation: 'cards' }));
  assert.ok(!minimal.includes('Revisión completa'), 'minimal omite descripciones por diseño');
  assert.ok(cards.includes('Revisión completa'), 'la variante por defecto sí las muestra');
  assert.ok(minimal.includes('Consulta General'), 'pero NUNCA pierde el nombre del servicio');
  assert.ok(minimal.includes(CLP.format(25000)), 'ni el precio');
});

test('A4d: Booking/cta oculta los horarios a proposito, no por error', () => {
  const cta = normalize(renderBlock('Booking', { presentation: 'cta' }));
  const cards = normalize(renderBlock('Booking', { presentation: 'cards' }));
  assert.ok(!cta.includes('09:00 - 13:00'), 'cta no lista horarios por diseño');
  assert.ok(cards.includes('09:00 - 13:00'), 'la variante cards sí los lista');
  assert.ok(cta.includes('Reservar ahora'), 'pero mantiene la acción de reservar');
});

test('A4e: Products y Services siguen pudiendo mostrarse a la vez', () => {
  // La eleccion de una variante en un bloque no puede arrastrar al otro.
  const products = renderBlock('Products', { presentation: 'magazine' });
  const services = renderBlock('Services', { presentation: 'editorial' });
  assert.ok(products.includes('Alimento Premium'));
  assert.ok(services.includes('Consulta General'));
});
