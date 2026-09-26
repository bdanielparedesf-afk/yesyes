import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * Storage de imagenes para Business (logo, portada, galeria, servicios,
 * propiedades y catalogo). Reutiliza @supabase/supabase-js ya presente en
 * dependencies: NO se instala multer/cloudinary ni se guarda binario en PG.
 *
 * Config requerida en backend/.env:
 *   SUPABASE_SERVICE_ROLE_KEY  (obligatoria; bucket server-side)
 *   SUPABASE_URL               (opcional si DATABASE_URL apunta a Supabase: se deriva)
 *   SUPABASE_STORAGE_BUCKET    (opcional; default "business-images", bucket publico)
 */

export const UPLOAD_KINDS = ['logo', 'cover', 'gallery', 'service', 'property', 'product'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB (imagenes)

/**
 * FASE 6 — VIDEO. El limite de imagen (5MB) no sirve para video: un cover de
 * 6 segundos en H.264 ya lo supera. El video tiene su propio tope y su propio
 * bucket, para que un archivo grande nunca compita con las imagenes del sitio.
 */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60MB

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'business-images';
}

/** Bucket de video. Separado del de imagenes: politicas y limites distintos. */
export function videoBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET_VIDEO || 'business-media';
}

/** MIME de video permitidos. Allowlist cerrada (6.11). */
export const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type VideoMime = (typeof VIDEO_MIMES)[number];

export function isUploadKind(kind: string): kind is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(kind);
}

/** Detecta el tipo real por magic bytes (no confia en el Content-Type del cliente). */
export function sniffImageType(buf: Buffer): { ext: string; mime: string } | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (buf.toString('ascii', 0, 4) === 'GIF8') return { ext: 'gif', mime: 'image/gif' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return { ext: 'avif', mime: 'image/avif' };
  }
  return null;
}

/**
 * Detecta el tipo real de un VIDEO por magic bytes (Fase 6).
 *
 * Igual que en imagenes: el `Content-Type` que declara el cliente NO es la
 * fuente de verdad. Un `.mp4` renombrado a `.exe` (o al reves) se rechaza aqui.
 *
 *  - MP4/MOV: caja `ftyp` en el offset 4. La marca distingue el contenedor.
 *  - WebM/Matroska: EBML magic `1A 45 DF A3`.
 */
export function sniffVideoType(buf: Buffer): { ext: string; mime: string } | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // EBML: WebM y Matroska.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    // El docType va dentro del EBML; "webm" es el inicio habitual del bloque DocType.
    const head = buf.toString('latin1', 0, Math.min(buf.length, 256));
    return head.includes('webm')
      ? { ext: 'webm', mime: 'video/webm' }
      : { ext: 'mkv', mime: 'video/webm' };
  }
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('ascii', 8, 12);
  // QuickTime (`qt  `) y las marcas de iOS siguen siendo MOV.
  if (brand === 'qt  ') return { ext: 'mov', mime: 'video/quicktime' };
  if (brand.startsWith('M4V') || brand.startsWith('M4A')) return { ext: 'mp4', mime: 'video/mp4' };
  return { ext: 'mp4', mime: 'video/mp4' };
}

/**
 * Un `businessId` (o cualquier segmento) es seguro para construir una ruta de
 * storage solo si no puede escapar del prefijo. Sin esto, un id con `../`
 * permitiria escribir fuera del directorio del negocio (6.11).
 */
export function isSafeStorageSegment(value: unknown): boolean {
  const id = String(value ?? '').trim();
  if (!id || id.length > 128) return false;
  return !/[/\\]/.test(id) && !id.includes('..') && id !== '.' && !id.startsWith('.');
}

/**
 * Ruta COMPLETA de un objeto dentro del bucket: `{businessId}/{carpeta}/{archivo}`.
 *
 * A diferencia de un segmento, aquí sí hay `/`. Lo que no puede pasar es que la
 * ruta se salga del prefijo del negocio: se exige que empiece por el businessId,
 * que no tenga segmentos vacíos y que ningún segmento sea `.` o `..`.
 */
export function isSafeObjectPath(path: unknown, businessId: string): boolean {
  const raw = String(path ?? '').trim();
  if (!raw || raw.length > 512 || raw.includes('\\')) return false;
  const segments = raw.split('/');
  if (segments.length < 2 || segments.length > 4) return false;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  // Sin separadores embebidos, sin query string y sin salto de linea: nada que
  // pueda reinterpretar el backend o el CDN.
  if (/[\x00-\x1f?#]/.test(raw)) return false;
  return segments[0] === businessId;
}

/**
 * Deriva el project ref de una URL de Supabase (no solo del host).
 *
 * Un project ref son 20 caracteres en [a-z0-9]. Puede aparecer en dos sitios:
 *   - el usuario:  postgresql://postgres.<ref>:pass@aws-0-sa-east-1.pooler.supabase.com
 *   - el host:     postgresql://...@db.<ref>.supabase.co  |  @<ref>.pooler.supabase.com
 *
 * Antes solo se leia el host y se tomaba "la primera etiqueta", lo que con un
 * pooler de region producia `https://aws-0-sa-east-1.supabase.co`: un host que
 * no existe, y por lo tanto un error de Storage sin explicacion. El caso real de
 * este proyecto lleva el ref en el usuario, no en el host.
 */
export function projectRefFromUrl(raw: string): string | null {
  if (!raw) return null;
  let host = '';
  let username = '';
  try {
    const u = new URL(String(raw));
    host = u.hostname;
    // decodeURIComponent: el usuario puede venir URL-encoded.
    try { username = decodeURIComponent(u.username || ''); } catch { username = u.username || ''; }
  } catch {
    // No es una URL completa: se intenta como host suelto.
    host = String(raw);
  }

  const REF = /^[a-z0-9]{20}$/;
  // 1) Usuario con prefijo explicito "postgres.<ref>".
  const um = /^postgres\.([a-z0-9]{20})$/i.exec(username);
  if (um?.[1]) return um[1].toLowerCase();

  // 2) El ref es una etiqueta completa del host.
  const labels = host.toLowerCase().split('.');
  for (const label of labels) {
    const m = /^postgres\.([a-z0-9]{20})$/.exec(label);
    if (m?.[1]) return m[1];
  }
  const first = labels[0] ?? '';
  if (first === 'db') {
    const second = labels[1];
    if (second && REF.test(second)) return second;
  }
  if (labels.includes('pooler') && REF.test(first)) return first;

  // 3) Un unico host de 20 chars en [a-z0-9]: es el ref.
  const normalized = host.toLowerCase();
  if (REF.test(normalized)) return normalized;
  return null;
}

function resolveConfig(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_STORAGE_KEY || '';
  if (!key) return null;
  let url = process.env.SUPABASE_URL || '';
  if (!url) {
    // Derivar https://{ref}.supabase.co desde DATABASE_URL para evitar configuracion manual.
    const ref = projectRefFromUrl(String(process.env.DATABASE_URL || ''))
      || projectRefFromUrl(String(process.env.DIRECT_URL || ''));
    if (ref) url = `https://${ref}.supabase.co`;
  }
  if (!url) return null;
  return { url, key };
}

export function storageConfigured(): boolean {
  return resolveConfig() !== null;
}

let client: SupabaseClient | null = null;
/** Cache de "bucket verificado" por nombre: un Map porque hay mas de un bucket. */
const bucketsReady = new Map<string, Promise<void>>();

function getClient(): SupabaseClient {
  const cfg = resolveConfig();
  if (!cfg) {
    const err = new Error('Storage no configurado: define SUPABASE_SERVICE_ROLE_KEY (y SUPABASE_URL si no hay DATABASE_URL de Supabase)');
    (err as any).status = 503;
    throw err;
  }
  if (!client) client = createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Crea el bucket publico si no existe (idempotente, cacheado por nombre). */
async function ensureBucketNamed(name: string): Promise<void> {
  if (!bucketsReady.has(name)) {
    const job = (async () => {
      const sb = getClient();
      const { error: getErr } = await sb.storage.getBucket(name);
      if (!getErr) return;
      const { error: createErr } = await sb.storage.createBucket(name, { public: true });
      if (createErr && !/already exists|duplicate/i.test(createErr.message)) {
        const err = new Error(`No se pudo crear el bucket de storage: ${createErr.message}`);
        (err as any).status = 502;
        throw err;
      }
    })().catch((e) => {
      bucketsReady.delete(name); // reintentar en el proximo upload
      throw e;
    });
    bucketsReady.set(name, job);
  }
  return bucketsReady.get(name)!;
}

async function ensureBucket(): Promise<void> {
  return ensureBucketNamed(storageBucket());
}

export async function uploadBusinessImage(opts: { businessId: string; kind: string; buffer: Buffer }): Promise<string> {
  const { businessId, kind } = opts;
  if (!isUploadKind(kind)) {
    const err = new Error(`Kind de imagen invalido: usa uno de ${UPLOAD_KINDS.join(', ')}`);
    (err as any).status = 400;
    throw err;
  }
  if (!isSafeStorageSegment(businessId)) {
    const err = new Error('Negocio invalido para almacenamiento');
    (err as any).status = 400;
    throw err;
  }
  const buf = opts.buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    const err = new Error('Archivo vacio');
    (err as any).status = 400;
    throw err;
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    const err = new Error('La imagen supera el maximo de 5MB');
    (err as any).status = 413;
    throw err;
  }
  const img = sniffImageType(buf);
  if (!img) {
    const err = new Error('Formato no soportado: usa JPG, PNG, WEBP, GIF o AVIF (max 5MB)');
    (err as any).status = 400;
    throw err;
  }
  await ensureBucket();
  const sb = getClient();
  const path = `${businessId}/${kind}/${randomUUID()}.${img.ext}`;
  const { error } = await sb.storage.from(storageBucket()).upload(path, buf, { contentType: img.mime, upsert: false });
  if (error) {
    const err = new Error(`Error subiendo imagen: ${error.message}`);
    (err as any).status = 502;
    throw err;
  }
  const { data } = sb.storage.from(storageBucket()).getPublicUrl(path);
  return data.publicUrl;
}

/** Resultado de un upload de video: la URL publica y la ruta en el bucket. */
export interface UploadedVideo {
  url: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * FASE 6 — Sube un video real al bucket de media.
 *
 * El nombre del archivo lo genera el servidor (`randomUUID`): jamas se usa el
 * nombre que envio el cliente, asi que un `../../etc/passwd` o un `.php` no
 * tienen por donde entrar. El tipo se decide por magic bytes.
 */
export async function uploadBusinessVideo(opts: { businessId: string; buffer: Buffer }): Promise<UploadedVideo> {
  const { businessId } = opts;
  if (!isSafeStorageSegment(businessId)) {
    const err = new Error('Negocio invalido para almacenamiento');
    (err as any).status = 400;
    throw err;
  }
  const buf = opts.buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    const err = new Error('Archivo vacio');
    (err as any).status = 400;
    throw err;
  }
  if (buf.length > MAX_VIDEO_BYTES) {
    const err = new Error('El video supera el maximo de 60MB');
    (err as any).status = 413;
    throw err;
  }
  const video = sniffVideoType(buf);
  if (!video) {
    const err = new Error('Formato no soportado: usa MP4, WEBM o MOV (max 60MB)');
    (err as any).status = 400;
    throw err;
  }
  const bucket = videoBucket();
  await ensureBucketNamed(bucket);
  const sb = getClient();
  const path = `${businessId}/video/${randomUUID()}.${video.ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, buf, { contentType: video.mime, upsert: false });
  if (error) {
    const err = new Error(`Error subiendo video: ${error.message}`);
    (err as any).status = 502;
    throw err;
  }
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, storagePath: path, mimeType: video.mime, sizeBytes: buf.length };
}

/**
 * Borra UN objeto de storage por su ruta completa.
 *
 * Se usa al reemplazar o al eliminar un medio ya registrado. La ruta se valida
 * de nuevo: aunque venga de la base, no se borra nada fuera del bucket ni con
 * segmentos sospechosos. Un fallo de borrado NO es fatal para la operacion
 * logica (la fila ya se elimino): se reporta, pero no se rompe la API.
 */
export async function removeStoredObject(opts: { businessId: string; storagePath: string | null | undefined; video?: boolean }): Promise<boolean> {
  const path = String(opts.storagePath || '').trim();
  if (!isSafeObjectPath(path, opts.businessId)) return false;
  const bucket = opts.video ? videoBucket() : storageBucket();
  try {
    const sb = getClient();
    const { error } = await sb.storage.from(bucket).remove([path]);
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * API minima de Storage necesaria para la limpieza (inyectable en tests, mismo
 * patron que AliExpressDropshipClient(fetchInjectado)).
 */
export interface StorageFolderApi {
  list(prefix: string, options?: { limit?: number }): Promise<{ data: Array<{ name: string; id?: string | null }> | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
}

const REMOVE_BATCH = 100;

/** Acumula recursivamente las rutas de archivo bajo un prefijo (las carpetas llegan sin id). */
async function collectObjectPaths(api: StorageFolderApi, prefix: string, acc: string[], depth: number): Promise<void> {
  if (depth > 5) return;
  const { data, error } = await api.list(prefix, { limit: 1000 });
  if (error) {
    const err = new Error(`Error listando imagenes del negocio: ${error.message}`);
    (err as any).status = 502;
    throw err;
  }
  for (const entry of data ?? []) {
    if (!entry || !entry.name || entry.name === '.emptyFolderPlaceholder') continue;
    const full = `${prefix}/${entry.name}`;
    if (entry.id) acc.push(full);
    else await collectObjectPaths(api, full, acc, depth + 1);
  }
}

/**
 * Borra todos los objetos del negocio en el bucket (prefijo `{businessId}/`).
 * Devuelve la cantidad de objetos eliminados. Nunca borra fuera del prefijo:
 * las rutas se construyen siempre desde el businessId y se descarta cualquier
 * businessId con separadores.
 */
export async function deleteBusinessImages(businessId: string, store?: StorageFolderApi): Promise<number> {
  const id = String(businessId || '').trim();
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) return 0;
  const api: StorageFolderApi = store ?? (getClient().storage.from(storageBucket()) as unknown as StorageFolderApi);
  const paths: string[] = [];
  await collectObjectPaths(api, id, paths, 0);
  if (paths.length === 0) return 0;
  let removed = 0;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const chunk = paths.slice(i, i + REMOVE_BATCH);
    const { error } = await api.remove(chunk);
    if (error) {
      const err = new Error(`Error eliminando imagenes del negocio: ${error.message}`);
      (err as any).status = 502;
      throw err;
    }
    removed += chunk.length;
  }
  return removed;
}
