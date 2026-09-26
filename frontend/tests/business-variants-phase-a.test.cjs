/**
 * YESYES BUSINESS — FASE A: LAS VARIANTES SON REALES.
 *
 * El fallo que este test existe para impedir: el `VariantRegistry` declaraba 59
 * variantes (todas con `renderInV2: true`) y el renderer NUNCA leia
 * `config.presentation`. El usuario podia elegir "Editorial" y ver exactamente
 * la misma pagina que con "Tarjetas": funcionalidad falsa.
 *
 * Estos tests EJERCITAN el renderer real (esbuild + react-dom/server).
 * Ver tambien `business-variants-content.test.cjs` (A4).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { mount } = require('./helpers/mount.cjs');
const { renderBlock, CONTENT, VARIANT_DEFINITIONS } = require('./helpers/variants-harness.cjs');

const blocks = mount('business/engine/blocks.tsx', 'a-blocks');
const { BLOCK_RENDERERS, hasRenderer } = blocks;

// ───────────────────────────── A1: paridad ─────────────────────────────

test('A1: toda variante que ofrece el backend tiene un renderer real', () => {
  const faltantes = [];
  for (const entry of VARIANT_DEFINITIONS) {
    assert.ok(hasRenderer(entry.block), `el bloque ${entry.block} no tiene renderer`);
    for (const variant of entry.variants) {
      const html = renderBlock(entry.block, { presentation: variant.config.presentation });
      if (!html || html.length < 40) faltantes.push(`${entry.block}/${variant.id} (no renderiza nada)`);
    }
  }
  assert.deepEqual(faltantes, [], 'variantes que no producen salida visible');
});

test('A1b: los bloques sin variantes declaradas no inventan variantes', () => {
  const conVariantes = new Set(VARIANT_DEFINITIONS.map((e) => e.block));
  for (const block of Object.keys(BLOCK_RENDERERS)) {
    if (conVariantes.has(block)) continue;
    assert.equal(
      renderBlock(block, {}),
      renderBlock(block, { presentation: 'inventada' }),
      `${block} cambia de aspecto sin tener variantes declaradas`,
    );
  }
});

// ────────────────────────── A2: diferencias reales ──────────────────────

test('A2: dentro de un bloque, cada variante produce HTML DISTINTO', () => {
  const repetidas = [];
  for (const entry of VARIANT_DEFINITIONS) {
    const firmas = new Map();
    for (const variant of entry.variants) {
      const html = renderBlock(entry.block, { presentation: variant.config.presentation });
      // Firma estructural: se ignoran los valores de texto y solo importa
      // COMO se compuso la seccion.
      const firma = html.replace(/>[^<]*</g, '><').replace(/\s+/g, ' ').trim();
      if (firmas.has(firma)) {
        repetidas.push(`${entry.block}: "${variant.id}" es idéntica a "${firmas.get(firma)}"`);
      } else {
        firmas.set(firma, variant.id);
      }
    }
  }
  assert.deepEqual(repetidas, [], 'variantes que se ven exactamente igual');
});

test('A2b: el caso concreto que se reporto — Hero editorial vs split vs cinematic', () => {
  const split = renderBlock('Hero', { presentation: 'split' });
  const editorial = renderBlock('Hero', { presentation: 'editorial' });
  const cinematic = renderBlock('Hero', { presentation: 'cinematic' });
  assert.notEqual(split, editorial, 'Hero editorial debe diferir de split');
  assert.notEqual(split, cinematic, 'Hero cinematic debe diferir de split');
  // La diferencia no es solo de clases: cambia la jerarquia tipografica.
  assert.ok(editorial.includes('first-letter'), 'editorial usa capitular: jerarquia distinta');
  assert.ok(!split.includes('first-letter'), 'split no la usa');
});

test('A2c: masonry vs grid cambia la estructura, no solo el color', () => {
  const masonry = renderBlock('ImageGallery', { presentation: 'masonry' });
  const grid = renderBlock('ImageGallery', { presentation: 'grid' });
  assert.notEqual(masonry, grid);
  assert.ok(masonry.includes('columns-'), 'masonry usa columnas CSS de altura variable');
  assert.ok(!grid.includes('columns-'), 'grid no las usa');
});

test('A2d: editorial de servicios no es lo mismo que cards', () => {
  const cards = renderBlock('Services', { presentation: 'cards' });
  const editorial = renderBlock('Services', { presentation: 'editorial' });
  assert.notEqual(cards, editorial);
  // Editorial es una lista indexada; cards es una grilla de tarjetas.
  assert.ok(editorial.includes('<ol'), 'editorial es una lista numerada');
  assert.ok(!cards.includes('<ol'), 'cards no lo es');
});

// ────────────────────── A3: variante desconocida ───────────────────────

test('A3: una variante desconocida cae a la variante por defecto', () => {
  for (const entry of VARIANT_DEFINITIONS) {
    assert.equal(
      renderBlock(entry.block, { presentation: 'no-existe-esta' }),
      renderBlock(entry.block, { presentation: entry.defaultVariant }),
      `${entry.block} no cae a su variante por defecto`,
    );
  }
});

test('A3b: sin configuración el bloque renderiza su variante por defecto', () => {
  for (const entry of VARIANT_DEFINITIONS) {
    assert.ok(renderBlock(entry.block, {}).length > 0, `${entry.block} no renderiza sin configuración`);
  }
});

test('A3c: renderizar es puro: no muta el contenido del negocio', () => {
  const antes = JSON.stringify(CONTENT);
  for (const entry of VARIANT_DEFINITIONS) {
    for (const variant of entry.variants) renderBlock(entry.block, { presentation: variant.config.presentation });
  }
  assert.equal(JSON.stringify(CONTENT), antes, 'el renderer no puede modificar los datos del negocio');
});
