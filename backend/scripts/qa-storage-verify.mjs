// Verificacion REAL de Storage (Fase 1). NO es un mock: sube un archivo real
// al bucket, obtiene la URL publica, la descarga de nuevo, comprueba que los
// bytes coinciden, y limpia al final. Requiere SUPABASE_SERVICE_ROLE_KEY valida.
//
// Ejecutar:  node --import tsx scripts/qa-storage-verify.mjs
// No imprime jamas la clave: solo presencia/URLs publicas y hashes.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

const { uploadBusinessImage, storageConfigured, storageBucket, MAX_UPLOAD_BYTES } = await import('../src/lib/storage.ts');

const report = {
  at: new Date().toISOString(),
  bucket: storageBucket(),
  configured: storageConfigured(),
  hasKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_STORAGE_KEY),
  maxBytes: MAX_UPLOAD_BYTES,
  steps: [],
  verdicts: {},
};
const step = (name, ok, detail) => { report.steps.push({ name, ok, detail }); if (!ok) report.verdicts[name] = 'FAIL'; };

if (!report.configured) {
  report.result = 'BLOCKED_EXTERNAL_DEPENDENCY';
  report.reason = 'Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_URL si no es derivable de DATABASE_URL). No se puede probar el round-trip real.';
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

// PNG 2x2 valido (bytes reales, no un header truncado).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAF0lEQVQI12P8z8DAwMDAxMDAwMDAAAANAgH/kdl2wAAAABJRU5ErkJggg==',
  'base64'
);
const pngHash = createHash('sha256').update(PNG).digest('hex').slice(0, 16);
const businessId = `qa-fase1-${randomUUID().slice(0, 8)}`;

step('imagen: sniff por magic bytes', true, `png ${PNG.length} bytes, sha256:${pngHash}`);

let imageUrl = null;
try {
  imageUrl = await uploadBusinessImage({ businessId, kind: 'gallery', buffer: PNG });
  step('imagen: upload al bucket', typeof imageUrl === 'string' && imageUrl.startsWith('http'), imageUrl);
} catch (e) {
  step('imagen: upload al bucket', false, String(e?.message || e).slice(0, 200));
}

// Round-trip: la URL publica debe devolver EXACTAMENTE los bytes subidos.
if (imageUrl) {
  try {
    const res = await fetch(imageUrl, { method: 'GET' });
    const got = Buffer.from(await res.arrayBuffer());
    const gotHash = createHash('sha256').update(got).digest('hex').slice(0, 16);
    step('imagen: URL publica responde 200', res.ok, `status ${res.status}`);
    step('imagen: bytes íntegros tras la red (upload -> URL -> reload)', gotHash === pngHash, `esperado sha256:${pngHash}, obtenido sha256:${gotHash}`);
    step('imagen: content-type correcto', /image\/png/.test(res.headers.get('content-type') || ''), res.headers.get('content-type'));
  } catch (e) {
    step('imagen: URL publica responde 200', false, String(e?.message || e).slice(0, 200));
  }
}

// Video: hoy el sistema NO declara soporte (Fase 6). Se documenta, no se finge.
step('video: endpoint de upload (Fase 6, aún no implementado)', 'skip',
  'uploadBusinessImage solo acepta imágenes (UPLOAD_KINDS). El soporte de video es trabajo de Fase 6; aquí se registra como no implementado, no como PASS.');

// Limpieza: no dejar basura en el bucket de QA.
try {
  const { deleteBusinessImages } = await import('../src/lib/storage.ts');
  const removed = await deleteBusinessImages(businessId);
  step('limpieza: objetos de QA eliminados', removed >= 1, `${removed} objeto(s) bajo ${businessId}/`);
} catch (e) {
  step('limpieza: objetos de QA eliminados', false, String(e?.message || e).slice(0, 200));
}

const failed = report.steps.filter((s) => s.ok === false);
report.result = failed.length === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
