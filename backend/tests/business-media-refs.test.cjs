const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');

const {
  encodeMediaRef, parseMediaRef, resolveMediaReference, mediaRefMatches,
  collectMediaReferences, mediaIdsInManifest, detachMediaReferences,
} = require('../src/template-engine/media-ref.ts');
const { mediaPublicDTO, mediaOwnerDTO, mediaInternals, withMediaInternals, normalizeMediaKind } =
  require('../src/services/business-media.service.ts');

const MEDIA = [
  { id: 'img-1', kind: 'IMAGE', url: 'https://cdn.test/a.jpg', alt: 'Portada' },
  { id: 'vid-1', kind: 'VIDEO', url: 'https://cdn.test/a.mp4', posterUrl: 'https://cdn.test/p.jpg' },
];

test('referencia: encode/parse de la forma canonica media:<id>', () => {
  assert.equal(encodeMediaRef('vid-1'), 'media:vid-1');
  assert.deepEqual(parseMediaRef('media:vid-1'), { kind: 'id', mediaId: 'vid-1' });
  assert.deepEqual(parseMediaRef({ mediaId: 'vid-1' }), { kind: 'id', mediaId: 'vid-1' });
  // Backward compatible con la URL plana que guardan los borradores antiguos.
  assert.deepEqual(parseMediaRef('https://cdn.test/a.mp4'), { kind: 'url', url: 'https://cdn.test/a.mp4' });
  // Cualquier otra cosa NO es medio: nunca debe romperse el render por esto.
  assert.deepEqual(parseMediaRef(''), { kind: 'empty' });
  assert.deepEqual(parseMediaRef(null), { kind: 'empty' });
  assert.deepEqual(parseMediaRef('media:'), { kind: 'empty' });
  assert.deepEqual(parseMediaRef(42), { kind: 'empty' });
});

test('referencia: se resuelve por id estable, no por URL', () => {
  assert.equal(resolveMediaReference('media:vid-1', MEDIA, { kind: 'video' })?.id, 'vid-1');
  assert.equal(resolveMediaReference('media:img-1', MEDIA, { kind: 'image' })?.id, 'img-1');
  // El id manda: aunque la URL del medio haya cambiado (reemplazo), resuelve igual.
  const rotado = [{ ...MEDIA[1], url: 'https://cdn.test/nuevo.mp4' }];
  assert.equal(resolveMediaReference('media:vid-1', rotado, { kind: 'video' })?.url, 'https://cdn.test/nuevo.mp4');
  // Un medio que no existe devuelve null, no una URL inventada.
  assert.equal(resolveMediaReference('media:no-existe', MEDIA, { kind: 'video' }), null);
  assert.equal(resolveMediaReference('media:vid-1', [], { kind: 'video' }), null);
  assert.equal(resolveMediaReference('media:vid-1', null, { kind: 'video' }), null);
});

test('referencia: el tipo del medio se respeta (un poster no es un video)', () => {
  // 'media:img-1' pedido como video no devuelve la imagen: busca otro video.
  assert.equal(resolveMediaReference('media:img-1', MEDIA, { kind: 'video' })?.id, 'vid-1');
  // Y un video pedido como poster cae al primer medio de imagen.
  assert.equal(resolveMediaReference('media:vid-1', MEDIA, { kind: 'image' })?.id, 'img-1');
});

test('referencia: mediaRefMatches identifica el medio de un campo', () => {
  assert.equal(mediaRefMatches('media:vid-1', 'vid-1'), true);
  assert.equal(mediaRefMatches('media:img-1', 'vid-1'), false);
  assert.equal(mediaRefMatches('https://cdn.test/a.mp4', 'vid-1'), false);
  assert.equal(mediaRefMatches(null, 'vid-1'), false);
});

const MANIFEST = {
  sections: [
    { id: 'hero', blocks: [{ id: 'HeroVideo', config: { video: 'media:vid-1', poster: 'media:img-1' } }] },
    { id: 'gal', blocks: [{ id: 'ImageGallery', config: { title: 'x' }, items: [{ image: 'media:img-1' }] }] },
    { id: 'empty', blocks: [] },
  ],
};

test('referencias: se detectan TODOS los usos de un medio (6.12)', () => {
  const hits = collectMediaReferences(MANIFEST, 'img-1');
  // El mismo medio en el poster del hero, en un bloque y dentro de `items`.
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => `${h.sectionId}.${h.field}`).sort(), ['gal.image#0', 'hero.poster']);
  const videoHits = collectMediaReferences(MANIFEST, 'vid-1');
  assert.equal(videoHits.length, 1);
  assert.equal(videoHits[0].blockId, 'HeroVideo');
  // Un medio que nadie usa no da falsos positivos.
  assert.deepEqual(collectMediaReferences(MANIFEST, 'otro'), []);
  // Un manifest roto no revienta: se devuelve lista vacia.
  assert.deepEqual(collectMediaReferences(null, 'img-1'), []);
  assert.deepEqual(collectMediaReferences({ sections: 'no-array' }, 'img-1'), []);
});

test('referencias: ids usados en todo el manifest', () => {
  const ids = mediaIdsInManifest(MANIFEST);
  assert.deepEqual([...ids].sort(), ['img-1', 'vid-1']);
});

test('referencias: detach quita los usos y NO muta el manifest original', () => {
  const next = detachMediaReferences(MANIFEST, 'img-1');
  assert.equal(collectMediaReferences(next, 'img-1').length, 0);
  // El original sigue intacto: es lo que garantiza que el Undo pueda volver.
  assert.equal(collectMediaReferences(MANIFEST, 'img-1').length, 2);
  // El otro medio no se toca.
  assert.equal(collectMediaReferences(next, 'vid-1').length, 1);
  // El contenido que no es medio sobrevive al detach.
  assert.equal(next.sections[1].blocks[0].config.title, 'x');
  assert.equal(next.sections[0].blocks[0].config.video, 'media:vid-1');
});

const ROW = {
  id: 'vid-1', businessId: 'biz-1', kind: 'VIDEO', url: 'https://cdn.test/a.mp4',
  posterUrl: null, mimeType: 'video/mp4', width: null, height: null, durationSec: 12,
  alt: 'Presentacion', title: 'Presentacion', position: 0,
  metadata: { storagePath: 'biz-1/video/x.mp4', sizeBytes: 2048 },
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
};

test('dto: el dueño recibe la ruta interna y el público NUNCA (6.11)', () => {
  const owner = mediaOwnerDTO(ROW);
  assert.equal(owner.storagePath, 'biz-1/video/x.mp4');
  assert.equal(owner.sizeBytes, 2048);

  const publicDto = mediaPublicDTO(ROW);
  assert.equal(publicDto.storagePath, undefined);
  assert.equal(publicDto.sizeBytes, undefined);
  assert.equal(publicDto.businessId, undefined);
  assert.equal(publicDto.metadata, undefined);
  // Lo que el renderer necesita si o si.
  assert.equal(publicDto.id, 'vid-1');
  assert.equal(publicDto.url, 'https://cdn.test/a.mp4');
  assert.equal(publicDto.kind, 'VIDEO');
  assert.equal(JSON.stringify(publicDto).includes('storagePath'), false);
});

test('dto: internals de storage sobreviven a un merge de metadata', () => {
  assert.deepEqual(mediaInternals({ metadata: { storagePath: 'p', sizeBytes: 5 } }), { storagePath: 'p', sizeBytes: 5 });
  // Metadata que no es objeto, o vacio, no rompen la lectura.
  assert.deepEqual(mediaInternals({ metadata: null }), { storagePath: null, sizeBytes: null });
  assert.deepEqual(mediaInternals({ metadata: ['a'] }), { storagePath: null, sizeBytes: null });
  assert.deepEqual(mediaInternals({}), { storagePath: null, sizeBytes: null });
  // Un merge conserva lo que ya habia y cambia solo lo indicado.
  const merged = withMediaInternals({ storagePath: 'viejo', sizeBytes: 1, codec: 'h264' }, { storagePath: 'nuevo' });
  assert.equal(merged.storagePath, 'nuevo');
  assert.equal(merged.codec, 'h264');
  assert.equal(merged.sizeBytes, 1);
});

test('dto: el tipo de medio se normaliza a IMAGE/VIDEO', () => {
  assert.equal(normalizeMediaKind('video'), 'VIDEO');
  assert.equal(normalizeMediaKind('VIDEO'), 'VIDEO');
  assert.equal(normalizeMediaKind('image'), 'IMAGE');
  // Cualquier valor raro cae en IMAGE, que es el caso seguro: un archivo de
  // imagen que se TOMABA por video era el bug que se evita.
  assert.equal(normalizeMediaKind('otro'), 'IMAGE');
  assert.equal(normalizeMediaKind(null), 'IMAGE');
});

