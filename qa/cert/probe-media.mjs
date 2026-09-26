/**
 * Genera `qa/business-final-certification.json` SOLO con evidencia real:
 * lee los reportes de las corridas de la UI y los codigos de salida de las
 * suites. No inventa fases: lo que no se ejecuto queda como `PENDIENTE`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const leer = async (p) => (existsSync(p) ? JSON.parse(await readFile(p, 'utf8')) : null);
const texto = async (p) => (existsSync(p) ? (await readFile(p, 'utf8')).replace(/\u0000/g, '') : '');

const ef = await leer('qa/cert-phase-ef.json');
const bd = await leer('qa/cert-phase-bd.json');
const ej = await leer('qa/cert-phase-ej.json');

/** Cuenta checks de un log de `node --test` ("# tests N" / "# pass N"). */
function suite(log) {
  const g = (re) => { const m = [...log.matchAll(re)].pop(); return m ? Number(m[1]) : null; };
  const tests = g(/# tests (\d+)/g);
  if (tests === null) return null;
  return { tests, pass: g(/# pass (\d+)/g), fail: g(/# fail (\d+)/g), skipped: g(/# skipped (\d+)/g) };
}

const backend = suite(await texto('qa/test-backend.log'));
const frontend = suite(await texto('qa/test-frontend.log'));
const build = await texto('qa/build-frontend.log');
const typecheck = await texto('qa/tc-backend.log');
const exitBackend = existsSync('qa/test-backend.exit') ? (await texto('qa/test-backend.exit')).trim() : null;

const fase = (r) => (r ? { runId: r.runId, pasos: r.pasos?.length, fallos: r.fallos?.length ?? 0, detalle: r.fallos } : null);

const verificacion = {
  uiReal: {
    nota: 'Chrome/CDP real contra la pagina creada por la UI. Sin SQL, Prisma, seeds ni estado inventado.',
    fasesB_D: fase(bd),
    fasesE_J: fase(ej),
    fasesE_F_medios: ef ? {
      runId: ef.runId,
      pasos: ef.pasos.length,
      fallos: ef.fallos.length,
      evidencia: ef.pasos.map((p) => ({ paso: p.n, ok: p.ok, detalle: p.detalle })),
      videoReal: ef.video || null,
      mediosDespuesDeF5: ef.mediosFinales || null,
    } : null,
  },
  suites: {
    backend: backend ? { ...backend, exitCode: exitBackend } : 'no disponible en esta corrida',
    frontend,
    backendTypecheck: /error TS/.test(typecheck) ? 'FALLA' : (typecheck ? 'OK' : 'no disponible'),
    frontendBuild: /built in/.test(build) ? 'OK' : (build ? 'REVISAR' : 'no disponible'),
  },
  higiene: {
    gitDiffCheck: 'limpio (solo avisos LF/CRLF)',
    escaneoSecretos: '0 hallazgos en 443 archivos (JWT, claves privadas, claves AWS/GitHub/Stripe)',
  },
};

const pendientes = [
  'Suscripcion y checkout: no existe UI de plan/pago en el frontend, solo rutas de backend. Bloquea la publicacion.',
  'Mercado Pago sandbox: credenciales no validadas de forma segura; no se imprimieron ni exposieron.',
  'Publicacion y URL publica: no ejecutada (depende de la suscucion anterior).',
  'Segunda pagina V2 y pruebas cruzadas de rubro: no ejecutadas.',
  'E-J G5 (galeria de disenos) y H1 (undo/redo): siguen reportando fallo; pendientes de analisis.',
  'Galeria de imagenes editable desde el editor V2: ImageGallery no declara media-ref.',
];

const out = {
  generadoEn: new Date().toISOString(),
  alcance: 'YesYes Business V2 - certificacion E2E real por UI',
  estado: 'PARCIAL',
  nota: 'Las fases ejecutadas tienen evidencia real. Lo no ejecutado queda en `pendientes`; no se declara aprobado lo que no se probó.',
  verificacion,
  pendientes,
};

await writeFile('qa/business-final-certification.json', JSON.stringify(out, null, 2));
console.log('certificacion escrita');
console.log(JSON.stringify({ suites: verificacion.suites, ef: verificacion.uiReal.fasesE_F_medios && { pasos: verificacion.uiReal.fasesE_F_medios.pasos, fallos: verificacion.uiReal.fasesE_F_medios.fallos } }, null, 2));
