// Tests de Storage (Fase 1). Sin red: solo derivacion de project ref y magic bytes.
// El caso que motivó esto: un pooler de region NO lleva el project ref en la
// primera etiqueta del host. La version anterior tomaba esa etiqueta y producia
// https://aws-0-sa-east-1.supabase.co -> un host inexistente y un error de
// Storage que no explicaba nada.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { projectRefFromUrl, sniffImageType, storageBucket, MAX_UPLOAD_BYTES, UPLOAD_KINDS, isUploadKind } = require('../src/lib/storage.ts');

const REF = 'iavjqxuetbryygivvwfz'; // 20 chars, el de este proyecto

test('project ref: se extrae del USUARIO de un pooler de region (caso real)', () => {
  const url = `postgresql://postgres.${REF}:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
  assert.equal(projectRefFromUrl(url), REF);
});

test('project ref: se extrae de db.<ref>.supabase.co', () => {
  assert.equal(projectRefFromUrl(`postgresql://postgres:secret@db.${REF}.supabase.co:5432/postgres`), REF);
});

test('project ref: se extrae de <ref>.pooler.supabase.com', () => {
  assert.equal(projectRefFromUrl(`postgresql://postgres:secret@${REF}.pooler.supabase.com:5432/postgres`), REF);
});

test('project ref: host suelto de 20 chars es el ref', () => {
  assert.equal(projectRefFromUrl(`${REF}.supabase.co`), null);
  assert.equal(projectRefFromUrl(REF), REF);
});

test('project ref: NUNCA inventa un host a partir de una region (regresion)', () => {
  // Este es exactamente el fallo original: la region no es el project ref.
  const url = `postgresql://postgres:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`;
  const ref = projectRefFromUrl(url);
  assert.notEqual(ref, 'aws-0-sa-east-1');
  assert.equal(ref, null, 'sin ref en el usuario no se debe adivinar un host');
});

test('project ref: entrada vacia o invalida devuelve null sin lanzar', () => {
  assert.equal(projectRefFromUrl(''), null);
  assert.equal(projectRefFromUrl('no-es-una-url'), null);
  assert.equal(projectRefFromUrl('postgresql://postgres:pw@localhost:5432/db'), null);
});

test('project ref: usuario URL-encoded tambien funciona', () => {
  // El punto del prefijo "postgres.<ref>" puede venir como %2E.
  const url = `postgresql://postgres%2E${REF}:pw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`;
  assert.equal(projectRefFromUrl(url), REF);
});

test('magic bytes: detecta el tipo real, no confia en el Content-Type', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
  const gif = Buffer.from('GIF89a......', 'ascii');
  assert.deepEqual(sniffImageType(png), { ext: 'png', mime: 'image/png' });
  assert.deepEqual(sniffImageType(jpg), { ext: 'jpg', mime: 'image/jpeg' });
  assert.deepEqual(sniffImageType(webp), { ext: 'webp', mime: 'image/webp' });
  assert.equal(sniffImageType(gif)?.mime, 'image/gif');
});

test('magic bytes: un archivo que NO es imagen se rechaza', () => {
  const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  const script = Buffer.from('<script>alert(1)</script>', 'utf8');
  assert.equal(sniffImageType(mp4), null, 'un .mp4 renombrado a .png no debe pasar');
  assert.equal(sniffImageType(script), null);
  assert.equal(sniffImageType(Buffer.alloc(4)), null, 'buffer demasiado corto');
});

test('upload: solo los kinds declarados, y limite de 5MB', () => {
  for (const k of UPLOAD_KINDS) assert.equal(isUploadKind(k), true, k);
  assert.equal(isUploadKind('../../etc/passwd'), false);
  assert.equal(isUploadKind('video'), false, 'video no es un kind de imagen: no se finge soporte');
  assert.equal(MAX_UPLOAD_BYTES, 5 * 1024 * 1024);
  assert.equal(storageBucket(), process.env.SUPABASE_STORAGE_BUCKET || 'business-images');
});
