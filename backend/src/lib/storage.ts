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

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'business-images';
}

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

function resolveConfig(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_STORAGE_KEY || '';
  if (!key) return null;
  let url = process.env.SUPABASE_URL || '';
  if (!url) {
    // Derivar https://{ref}.supabase.co desde DATABASE_URL (db.{ref}.supabase.co
    // o {ref}.pooler.supabase.com) para reducir configuracion manual.
    try {
      const host = new URL(String(process.env.DATABASE_URL || '')).hostname;
      const labels = host.split('.');
      if (labels[0] === 'db' && labels[1]) url = `https://${labels[1]}.supabase.co`;
      else if (host.includes('pooler') && labels[0]) url = `https://${labels[0]}.supabase.co`;
    } catch {
      /* DATABASE_URL invalida -> sin derivacion */
    }
  }
  if (!url) return null;
  return { url, key };
}

export function storageConfigured(): boolean {
  return resolveConfig() !== null;
}

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

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

/** Crea el bucket publico si no existe (idempotente, se cachea por proceso). */
async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const sb = getClient();
      const { error: getErr } = await sb.storage.getBucket(storageBucket());
      if (!getErr) return;
      const { error: createErr } = await sb.storage.createBucket(storageBucket(), { public: true });
      if (createErr && !/already exists|duplicate/i.test(createErr.message)) {
        const err = new Error(`No se pudo crear el bucket de storage: ${createErr.message}`);
        (err as any).status = 502;
        throw err;
      }
    })().catch(e => {
      bucketReady = null; // reintentar en el proximo upload
      throw e;
    });
  }
  return bucketReady;
}

export async function uploadBusinessImage(opts: { businessId: string; kind: string; buffer: Buffer }): Promise<string> {
  const { businessId, kind } = opts;
  if (!isUploadKind(kind)) {
    const err = new Error(`Kind de imagen invalido: usa uno de ${UPLOAD_KINDS.join(', ')}`);
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
