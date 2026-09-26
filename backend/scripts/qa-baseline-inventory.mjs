// QA baseline inventory (Fase 0). Solo lectura: no escribe, no borra, no migra.
// Usa el cliente Prisma generado y el DATABASE_URL de backend/.env.
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const db = new PrismaClient();

const tables = [
  'business', 'businessTemplate', 'businessTemplateVersion', 'businessSiteInstance',
  'businessSiteRevision', 'businessMedia', 'businessService', 'businessCatalogItem',
  'businessGalleryImage', 'businessTestimonial', 'businessFaq', 'businessLead',
  'businessCategory', 'businessPlan', 'businessCapability', 'businessPromotion',
];

const out = { at: new Date().toISOString(), counts: {}, errors: [] };

for (const t of tables) {
  try {
    out.counts[t] = await db[t].count();
  } catch (e) {
    out.errors.push({ table: t, error: String(e.message || e).slice(0, 200) });
  }
}

try {
  out.instances = (await db.businessSiteInstance.findMany({
    select: {
      id: true, businessId: true, templateId: true, manifestVersion: true,
      legacyCompatibility: true, updatedAt: true,
      business: { select: { name: true, slug: true, category: true } },
      _count: { select: { revisions: true } },
    },
    take: 25,
  })).map((i) => ({ ...i, updatedAt: i.updatedAt?.toISOString?.() ?? null }));
} catch (e) { out.errors.push({ table: 'instances', error: String(e.message || e).slice(0, 300) }); }

try {
  out.templates = (await db.businessTemplate.findMany({
    select: { id: true, code: true, name: true, active: true, legacy: true, style: true, category: true },
    orderBy: { code: 'asc' },
  }));
  out.templateSummary = out.templates.reduce((acc, t) => {
    acc.total += 1;
    acc[t.legacy ? 'legacy' : 'v2'] += 1;
    if (t.active) acc.active += 1;
    return acc;
  }, { total: 0, legacy: 0, v2: 0, active: 0 });
  out.templateCodes = out.templates.map((t) => t.code);
} catch (e) { out.errors.push({ table: 'templates', error: String(e.message || e).slice(0, 300) }); }

await db.$disconnect();

// ---- FASE 1: Storage + UTF-8 (solo lectura / probe, no persiste nada) ----
const { storageConfigured, storageBucket, MAX_UPLOAD_BYTES, sniffImageType, projectRefFromUrl } = await import('../src/lib/storage.ts').catch(async () => {
  return await import('tsx/esm/api').then(() => import('../src/lib/storage.ts'));
});

const storage = {
  hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_STORAGE_KEY),
  hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
  databaseUrlHost: (() => { try { return new URL(String(process.env.DATABASE_URL || '')).hostname; } catch { return null; } })(),
  bucket: storageBucket(),
  configured: storageConfigured(),
  maxUploadBytes: MAX_UPLOAD_BYTES,
  note: 'No se imprime ninguna clave ni token: solo presencia y longitudes.',
};

// Magic bytes: confirma que el detector de tipo real funciona sin backend.
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0]);
const mp4Header = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
storage.sniff = {
  png: sniffImageType(pngHeader),
  jpg: sniffImageType(jpgHeader),
  videoMp4Accepted: sniffImageType(mp4Header),
};
storage.derivedProjectRef = projectRefFromUrl(String(process.env.DATABASE_URL || ''))
  || projectRefFromUrl(String(process.env.DIRECT_URL || ''));
storage.derivedUrl = storage.derivedProjectRef ? `https://${storage.derivedProjectRef}.supabase.co` : null;

out.storage = storage;

const iconv = (await import('iconv-lite')).default;

// ---- FASE 1b: UTF-8 ----
// Scanner de mojibake + reparador. Regla de la Fase 1: no se reemplaza a ciegas.
// Solo se re-codifica cuando el round-trip es SIN perdida (sin U+FFFD) y el
// resultado difiere: asi un texto legitino en latin-1 ("ñ" "ó") nunca se toca.
const { readdirSync, readFileSync, statSync, writeFileSync } = await import('node:fs');
const { join, extname, resolve } = await import('node:path');

/**
 * Rango de caracteres que aparece cuando un texto UTF-8 se decodifica como
 * Latin-1 (o doble). No basta con U+0080-U+00FF: un byte 0x89 leido como
 * Windows-1252 produce U+2030 (‰), 0x8C produce U+201C ("), y los bytes de
 * dos cifras producen letras de Latin Extended-A (U+0161 š, U+0101 ā...).
 * Sin esos rangos, el round-trip se declaraba "irreparable" y se dejaban
 * textos corruptos en pantalla.
 */
const MOJI_CHUNK_RE = /[\u0080-\u00FF\u0100-\u017F\u02C6-\u02DC\u2013-\u201E\u2020-\u2022\u2030\u2039-\u203A\u20AC]/;
const MOJI_CHUNK = new RegExp(MOJI_CHUNK_RE.source, 'g');

/**
 * Intenta deshacer una codificacion erronea de UNA subcadena.
 *
 * Guarda critica: solo se acepta el resultado si NO le quedan rastros de
 * mojibake. Sin esta guarda, una decodificacion PARCIAL empeora el texto
 * ("mÃ‚NICA" -> "mÂNICA"): se pierde un nivel de basura y se gana otro,
 * dejando un archivo peor que antes. Ante la duda, no se toca la linea.
 */
const MOJI_LEFTOVER = /[\u00C2\u00C3\u00E2][\u0080-\u00FF\u0100-\u017F\u2013-\u201E\u2020-\u2022\u2030\u2039-\u203A\u20AC]|[\u0081\u008D\u008F\u0090\u009D]/;

function tryUnmangleOnce(chunk) {
  if (!MOJI_CHUNK_RE.test(chunk)) return null;
  let decoded;
  try {
    // Windows-1252: es la codificacion con la que un UTF-8 se convierte en
    // "Ã©" en la practica. latin1 puro dejaria sin salida a U+0080-U+009F.
    // iconv.decode espera un Buffer con los BYTES originales: hay que
    // re-codificar la subcadena a Windows-1252 antes de decodificarla.
    decoded = iconv.decode(iconv.encode(chunk, 'windows-1252'), 'utf8');
  } catch {
    return null;
  }
  if (decoded.includes('\uFFFD')) return null; // habia perdida: no se toca
  if (decoded === chunk) return null; // no cambio
  if (MOJI_LEFTOVER.test(decoded)) return null; // sigue sucio: parcial, no se toca
  // Guarda final: el resultado debe quedar compuesto solo de caracteres
  // imprimibles. Si aparece un caracter de control, un sustituto o un '?'
  // (byte huerfano), la decodificacion perdio informacion y el texto
  // quedaria PEOR que antes (p.ej. "Ã¢â‚¬â€" -> "Ã?"). No se toca la linea.
  for (const ch of decoded) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0x3F) return null; // '?': byte huerfano
    if (c < 0x20 && c !== 0x09) return null; // control
  }
  return decoded;
}

/** Repara una linea completa, round-trip por round-trip (cubre doble y triple). */
function repairLine(line) {
  let current = line;
  for (let pass = 0; pass < 6; pass += 1) {
    // Se toma la secuencia maximal de caracteres del rango corrupto.
    const next = current.replace(MOJI_CHUNK, (chunk) => tryUnmangleOnce(chunk) ?? chunk);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Deteccion ESTRICTA: no debe listar un archivo por tener una tilde correcta
 * (eso daria miles de falsos positivos). Solo marca la firma del fallo: un
 * caracter ASCII pegado a U+0080-U+00FF (el clasico "Ã©"), o los caracteres
 * de Windows-1252 que solo nacen de una decodificacion erronea (U+2030,
 * U+201C, U+0081, ...) igualmente mal formados.
 */
const MOJI = /[\u00C2\u00C3\u00E2][\u0080-\u00FF\u0100-\u017F\u2013-\u201E\u2020-\u2022\u2030\u2039-\u203A\u20AC]|[\u0081\u008D\u008F\u0090\u009D]|\u00EF\u00BF\u00BD|[\u00C2]\u00A0/;
const ROOTS = [
  'src', '../frontend/src', '../frontend/tests', 'tests', 'prisma',
].map((p) => resolve(process.cwd(), p)).filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } });
const EXTS = new Set(['.ts', '.tsx', '.cjs', '.mjs', '.prisma', '.json']);

/** Clasifica si la linea afectada parece comentario o texto visible al usuario. */
function classify(line) {
  const t = line.trim();
  const isComment = t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--');
  return isComment ? 'comment' : 'visible';
}

const APPLY = process.argv.includes('--apply');
const report = { applied: APPLY, files: [], totals: { linesRepaired: 0, bytesReclaimed: 0, irrecoverable: 0 }, before: null, after: null, samples: [] };
const irrecoverable = [];

function scan(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(dir, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { scan(full); continue; }
    if (!EXTS.has(extname(full))) continue;
    const raw = readFileSync(full, 'utf8');
    if (!MOJI.test(raw)) continue;

    const rel = full.replace(process.cwd() + '\\', '');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    let repairedLines = 0;
    const changed = [];
    const outLines = lines.map((line, i) => {
      if (!MOJI.test(line)) return line;
      const kind = classify(line);
      const fixed = repairLine(line);
      if (fixed !== line) {
        repairedLines += 1;
        changed.push({ line: i + 1, kind, before: line.trim().slice(0, 110), after: fixed.trim().slice(0, 110) });
        return fixed;
      }
      // No reparable de forma segura: se reporta, nunca se fuerza.
      if (!changed.some((c) => c.line === i + 1)) irrecoverable.push({ file: rel, line: i + 1, kind, text: line.trim().slice(0, 110) });
      return line;
    });

    report.totals.linesRepaired += repairedLines;
    report.files.push({ file: rel, linesRepaired: repairedLines, changes: changed });

    if (APPLY && repairedLines > 0) {
      const before = Buffer.byteLength(raw, 'utf8');
      const next = outLines.join(eol).replace(/[\s\uFEFF]+$/, '') + eol;
      writeFileSync(full, next, 'utf8');
      report.totals.bytesReclaimed += before - Buffer.byteLength(next, 'utf8');
    }
  }
}
for (const r of ROOTS) scan(r);
report.totals.irrecoverable = irrecoverable.length;
report.irrecoverable = irrecoverable.slice(0, 60);
out.utf8Repair = report;

console.log(JSON.stringify(out, null, 2));
