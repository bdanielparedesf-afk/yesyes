const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { sniffImageType, isUploadKind, UPLOAD_KINDS, MAX_UPLOAD_BYTES } = require('../src/lib/storage.ts');

test('upload kinds validos y rechazo de kind desconocido', () => {
  assert.deepEqual([...UPLOAD_KINDS], ['logo', 'cover', 'gallery', 'service', 'property', 'product']);
  assert.equal(isUploadKind('logo'), true);
  assert.equal(isUploadKind('avatar'), false);
  assert.equal(isUploadKind('../../etc/passwd'), false);
});

test('limite de upload es 5MB', () => {
  assert.equal(MAX_UPLOAD_BYTES, 5 * 1024 * 1024);
});

test('sniffImageType detecta por magic bytes', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  assert.deepEqual(sniffImageType(jpeg), { ext: 'jpg', mime: 'image/jpeg' });

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  assert.deepEqual(sniffImageType(png), { ext: 'png', mime: 'image/png' });

  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(8)]);
  assert.deepEqual(sniffImageType(gif), { ext: 'gif', mime: 'image/gif' });

  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);
  assert.deepEqual(sniffImageType(webp), { ext: 'webp', mime: 'image/webp' });

  const avif = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif'), Buffer.alloc(4)]);
  assert.deepEqual(sniffImageType(avif), { ext: 'avif', mime: 'image/avif' });
});

test('sniffImageType rechaza HTML/JS/binarios desconocidos y buffers cortos', () => {
  assert.equal(sniffImageType(Buffer.from('<script>alert(1)</script>XXXXXXXXXX')), null);
  assert.equal(sniffImageType(Buffer.from('MZ\x90\x00')), null); // ejecutable
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8])), null); // jpeg truncado
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
});
