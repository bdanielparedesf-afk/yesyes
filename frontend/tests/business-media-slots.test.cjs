/**
 * YESYES BUSINESS - CAMPOS DE MEDIO DEL EDITOR (V2).
 *
 * Regresion del defecto que dejaba al inspector SIN campos de imagen ni de
 * video: el manifest serializa cada bloque con la clave `block` (el TIPO,
 * p.ej. "Hero") y `instanceId` (lo unico). El codigo leia `block.id`, que no
 * existe, asi que:
 *
 *   1. `mediaSlotsOfSection` no resolvia ningun `configSchema` -> 0 campos.
 *   2. `setBlockConfigValue` no encontraba el bloque -> el medio se perdia.
 *
 * Estos tests usan la forma REAL del manifest que devuelve el backend.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers/mount.cjs');

const state = mount('business/builder/useBuilderState.ts', 'fm-state');
const types = mount('business/builder/types.ts', 'fm-types');
const { mediaSlotsOfSection, setBlockConfigValue } = state;
const { manifestSectionOfCapability } = types;

/** Esquemas reales del BlockRegistry, tal como los devuelve el backend. */
const SCHEMAS = {
  Hero: [
    { key: 'headline', label: 'Titulo', type: 'text' },
    { key: 'image', label: 'Imagen de portada', type: 'media-ref' },
  ],
  HeroVideo: [
    { key: 'video', label: 'Video', type: 'media-ref', required: true },
    { key: 'poster', label: 'Poster', type: 'media-ref', required: true },
    { key: 'autoplay', label: 'Reproducir solo', type: 'boolean' },
  ],
  Image: [{ key: 'image', label: 'Imagen', type: 'media-ref', required: true }],
  Services: [{ key: 'presentation', label: 'Presentacion', type: 'select' }],
};

function manifestFixture() {
  return {
    manifestVersion: 1,
    legacy: false,
    sections: [
      { id: 'inicio', label: 'Portada', order: 10, hidden: false, blocks: [{ block: 'Hero', instanceId: 'inicio-hero', config: {} }] },
      { id: 'servicios', label: 'Servicios', order: 20, hidden: false, blocks: [{ block: 'Services', instanceId: 'servicios-services', config: {} }] },
      { id: 'video', label: 'Video', order: 30, hidden: false, blocks: [{ block: 'HeroVideo', instanceId: 'video-hero', config: {} }] },
    ],
  };
}

test('un bloque Hero expone su campo de imagen a partir de la clave `block`', () => {
  const slots = mediaSlotsOfSection(manifestFixture(), 'inicio', SCHEMAS);
  assert.equal(slots.length, 1, 'la portada debe exponer un slot de medios');
  assert.equal(slots[0].blockId, 'inicio-hero', 'el slot se identifica por instanceId');
  assert.deepEqual(slots[0].fields.map((f) => f.key), ['image']);
  assert.equal(slots[0].fields[0].kind, 'image');
});

test('una seccion sin bloques de medios no expone slots', () => {
  assert.deepEqual(mediaSlotsOfSection(manifestFixture(), 'servicios', SCHEMAS), []);
});

test('un bloque de video expone video y poster con el tipo correcto', () => {
  const slots = mediaSlotsOfSection(manifestFixture(), 'video', SCHEMAS);
  assert.equal(slots.length, 1);
  const byKey = Object.fromEntries(slots[0].fields.map((f) => [f.key, f]));
  assert.equal(byKey.video.kind, 'video');
  assert.equal(byKey.poster.kind, 'image');
  assert.equal(byKey.video.required, true);
  assert.ok(!('autoplay' in byKey), 'los campos que no son media-ref no se exponen');
});

test('setBlockConfigValue guarda el medio en el bloque correcto', () => {
  const next = setBlockConfigValue(manifestFixture(), {
    sectionId: 'inicio', blockId: 'inicio-hero', field: 'image', value: 'media_abc',
  });
  const hero = next.sections.find((s) => s.id === 'inicio').blocks[0];
  assert.equal(hero.config.image, 'media_abc', 'el valor queda en el config del bloque');
  assert.equal(hero.instanceId, 'inicio-hero', 'y no se pierde la identidad del bloque');
  assert.equal(hero.block, 'Hero', 'ni se altera el tipo');
});

test('setBlockConfigValue no toca los demas bloques de la seccion', () => {
  const manifest = manifestFixture();
  manifest.sections.push({
    id: 'galeria', label: 'Galeria', order: 40, hidden: false,
    blocks: [
      { block: 'Image', instanceId: 'galeria-1', config: {} },
      { block: 'Image', instanceId: 'galeria-2', config: {} },
    ],
  });
  const next = setBlockConfigValue(manifest, {
    sectionId: 'galeria', blockId: 'galeria-2', field: 'image', value: 'media_xyz',
  });
  const bloques = next.sections.find((s) => s.id === 'galeria').blocks;
  assert.equal(bloques[0].config.image, undefined, 'el primer bloque queda intacto');
  assert.equal(bloques[1].config.image, 'media_xyz', 'solo cambia el bloque pedido');
});

test('un manifest sin bloques no rompe', () => {
  assert.deepEqual(mediaSlotsOfSection({ sections: [{ id: 'vacia', blocks: [] }] }, 'vacia', SCHEMAS), []);
  assert.deepEqual(mediaSlotsOfSection({}, 'no-existe', SCHEMAS), []);
});

test('la capability del inspector se traduce a la seccion del manifest', () => {
  // El inspector recibe "HERO", no "inicio". Sin esta traduccion se buscaria
  // una seccion llamada "HERO" y el grupo de medios no se renderizaria nunca.
  const manifest = manifestFixture();
  const section = manifestSectionOfCapability(manifest, 'HERO');
  assert.ok(section, 'la capability HERO resuelve a una seccion real');
  assert.equal(section.id, 'inicio');
  assert.equal(mediaSlotsOfSection(manifest, section.id, SCHEMAS).length, 1);
});

test('un manifest sin la capability pedida no rompe la traduccion', () => {
  assert.equal(manifestSectionOfCapability(manifestFixture(), 'NO_EXISTE'), null);
  assert.equal(manifestSectionOfCapability(null, 'HERO'), null);
});
