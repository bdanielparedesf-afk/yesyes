const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');

const {
  sniffVideoType, isSafeStorageSegment, isSafeObjectPath,
  MAX_VIDEO_BYTES, VIDEO_MIMES, videoBucket, storageBucket,
} = require('../src/lib/storage.ts');

/** Bytes minimos de un MP4 real: caja `ftyp` con marca `isom`. */
function mp4(brand = 'isom') {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftyp'),
    Buffer.from(brand),
    Buffer.alloc(8),
  ]);
}

/** Cabecera EBML con docType webm. */
function webm() {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from([0x9f]),
    Buffer.from('webm'),
    Buffer.alloc(6),
  ]);
}

test('video: el limite es 60MB y la allowlist de MIME es cerrada', () => {
  assert.equal(MAX_VIDEO_BYTES, 60 * 1024 * 1024);
  assert.deepEqual([...VIDEO_MIMES], ['video/mp4', 'video/webm', 'video/quicktime']);
  // Un bucket aparte: un video pesado nunca compite con las imagenes del sitio.
  assert.equal(videoBucket(), 'business-media');
  assert.equal(storageBucket(), 'business-images');
});

test('video: sniffVideoType detecta MP4, MOV y WEBM por magic bytes', () => {
  assert.deepEqual(sniffVideoType(mp4('isom')), { ext: 'mp4', mime: 'video/mp4' });
  assert.deepEqual(sniffVideoType(mp4('M4V ')), { ext: 'mp4', mime: 'video/mp4' });
  // QuickTime se reconoce por su marca `qt  `, no por la extension.
  assert.deepEqual(sniffVideoType(mp4('qt  ')), { ext: 'mov', mime: 'video/quicktime' });
  assert.deepEqual(sniffVideoType(webm()), { ext: 'webm', mime: 'video/webm' });
});

test('video: sniffVideoType rechaza lo que NO es video (MIME falso)', () => {
  // Un HTML renombrado a .mp4: se rechaza por bytes, no por nombre.
  assert.equal(sniffVideoType(Buffer.from('<html><body>hola</body></html>')), null);
  // Una imagen renombrada a .mp4: tampoco pasa.
  assert.equal(sniffVideoType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])), null);
  // Un ejecutable de Windows.
  assert.equal(sniffVideoType(Buffer.from('MZ\x90\x00\x03\x00\x00\x00')), null);
  // Un ZIP (docx renombrado).
  assert.equal(sniffVideoType(Buffer.from('PK\x03\x04\x14\x00\x00\x00')), null);
  // Buffer vacio o demasiado corto.
  assert.equal(sniffVideoType(Buffer.alloc(0)), null);
  assert.equal(sniffVideoType(Buffer.alloc(4)), null);
});

test('video: un MP4 valido no se confunde con un AVI (RIFF)', () => {
  const avi = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('AVI '), Buffer.alloc(4)]);
  assert.equal(sniffVideoType(avi), null);
});

test('seguridad: isSafeStorageSegment rechaza traversal y separadores', () => {
  assert.equal(isSafeStorageSegment('abc-123'), true);
  assert.equal(isSafeStorageSegment(''), false);
  assert.equal(isSafeStorageSegment('..'), false);
  assert.equal(isSafeStorageSegment('a/b'), false);
  assert.equal(isSafeStorageSegment('a\\b'), false);
  assert.equal(isSafeStorageSegment('../../etc/passwd'), false);
  assert.equal(isSafeStorageSegment('.hidden'), false);
  assert.equal(isSafeStorageSegment('x'.repeat(129)), false);
});

test('seguridad: isSafeObjectPath solo admite rutas dentro del negocio', () => {
  assert.equal(isSafeObjectPath('biz-1/video/abc.mp4', 'biz-1'), true);
  assert.equal(isSafeObjectPath('biz-1/gallery/abc.png', 'biz-1'), true);
  // Se sale del prefijo del negocio: se rechaza.
  assert.equal(isSafeObjectPath('otro-negocio/video/abc.mp4', 'biz-1'), false);
  assert.equal(isSafeObjectPath('../biz-2/video/abc.mp4', 'biz-1'), false);
  assert.equal(isSafeObjectPath('biz-1/../biz-2/video/abc.mp4', 'biz-1'), false);
  // Segmentos vacios, query string y saltos de linea.
  assert.equal(isSafeObjectPath('biz-1//video/abc.mp4', 'biz-1'), false);
  assert.equal(isSafeObjectPath('biz-1/video/abc.mp4?x=1', 'biz-1'), false);
  assert.equal(isSafeObjectPath('biz-1/video/a\nb.mp4', 'biz-1'), false);
  // Sin prefijo de negocio o con demasiados niveles.
  assert.equal(isSafeObjectPath('video/abc.mp4', 'biz-1'), false);
  assert.equal(isSafeObjectPath('biz-1/a/b/c/d.mp4', 'biz-1'), false);
});
