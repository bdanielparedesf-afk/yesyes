/**
 * YESYES BUSINESS · FASE 6 — SERVICIO DE MEDIOS.
 *
 * `BusinessMedia` es el catálogo real de imagenes y videos de un negocio. Este
 * servicio concentrate las tres cosas que no deben repartirse por las rutas:
 *
 *  1. La FORMA DEL DTO. Al dueño se le dice dónde está el archivo en el bucket
 *     (para poder borrarlo o reemplazarlo); al público NUNCA. En la página
 *     pública no viaja `storagePath` ni ningún dato interno (6.11).
 *  2. LA REFERENCIA. El manifest guarda `media:<id>`; aquí se comprueba, antes
 *     de borrar, que ninguna sección siga usando ese medio (6.12).
 *  3. EL CICLO DE VIDA. Reemplazar un medio conserva su `id`, de modo que las
 *     secciones que ya lo usan se actualizan solas y no hay que re-editar el
 *     manifest ni volver a elegir la imagen.
 *
 * `storagePath` y `sizeBytes` viven en la columna `metadata` (Json) en lugar de
 * columnas nuevas: la tabla ya tiene `metadata` para "datos libres por tipo" y
 * añadir columnas exigiría una migración sobre una base compartida, sin ganar
 * nada. `width`/`height`/`durationSec`/`mimeType` sí tienen columna propia.
 */

import { prisma } from '../lib/prisma';
import { collectMediaReferences, detachMediaReferences } from '../template-engine/media-ref';
import { latestPublishedRevision } from './business-site-version.service';

export const MEDIA_KINDS = ['IMAGE', 'VIDEO'] as const;
export type MediaKindCode = (typeof MEDIA_KINDS)[number];

export function normalizeMediaKind(value: unknown): MediaKindCode {
  return String(value || '').trim().toUpperCase() === 'VIDEO' ? 'VIDEO' : 'IMAGE';
}

interface MediaRow {
  id: string;
  businessId: string;
  kind: string;
  url: string;
  posterUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  alt: string | null;
  title: string | null;
  metadata: unknown;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Lee los datos internos guardados en `metadata`. */
export function mediaInternals(row: { metadata?: unknown }): { storagePath: string | null; sizeBytes: number | null } {
  const meta = (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata))
    ? row.metadata as Record<string, unknown>
    : {};
  const storagePath = typeof meta.storagePath === 'string' ? meta.storagePath : null;
  const sizeBytes = typeof meta.sizeBytes === 'number' && Number.isFinite(meta.sizeBytes) ? meta.sizeBytes : null;
  return { storagePath, sizeBytes };
}


/**
 * DTO para el dueño del negocio: incluye la ruta interna porque la UI la usa
 * solo para pedir su borrado (el servidor decide, no el cliente).
 */
export function mediaOwnerDTO(row: MediaRow) {
  const { storagePath, sizeBytes } = mediaInternals(row);
  return {
    id: row.id,
    businessId: row.businessId,
    kind: normalizeMediaKind(row.kind),
    url: row.url,
    posterUrl: row.posterUrl || null,
    mimeType: row.mimeType || null,
    width: row.width ?? null,
    height: row.height ?? null,
    durationSec: row.durationSec ?? null,
    sizeBytes,
    storagePath,
    alt: row.alt || null,
    title: row.title || null,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * DTO para la página pública. ES LA DIFERENCIA IMPORTANTE: no incluye
 * `storagePath`, ni `businessId`, ni `metadata`. Es lo unico que sale del
 * servidor hacia un visitante anonimo.
 */
export function mediaPublicDTO(row: MediaRow) {
  return {
    id: row.id,
    kind: normalizeMediaKind(row.kind),
    url: row.url,
    posterUrl: row.posterUrl || null,
    alt: row.alt || null,
    title: row.title || null,
    position: row.position,
  };
}

/** `select` de Prisma: el conjunto minimo que el renderer y la UI necesitan. */
export const MEDIA_PUBLIC_SELECT = {
  id: true, businessId: true, kind: true, url: true, posterUrl: true,
  mimeType: true, width: true, height: true, durationSec: true,
  alt: true, title: true, metadata: true, position: true,
  createdAt: true, updatedAt: true,
} as const;

export interface MediaUsage {
  draft: ReturnType<typeof collectMediaReferences>;
  published: ReturnType<typeof collectMediaReferences>;
  hasPublished: boolean;
}

/**
 * Donde se usa un medio: en el BORRADOR y en la REVISION PUBLICADA.
 *
 * Se consultan los dos porque borrarlos por separado seria un fallo de
 * integridad en cualquier dirección: borrar un archivo que la revision
 * publicada usa rompe el sitio en vivo.
 */
export async function mediaUsageOf(businessId: string, mediaId: string): Promise<MediaUsage> {
  const instance = await prisma.businessSiteInstance.findFirst({ where: { businessId }, select: { id: true, manifest: true } });
  const draft = collectMediaReferences(instance?.manifest, mediaId);
  const publishedRow = instance?.id ? await latestPublishedRevision(instance.id) : null;
  const published = collectMediaReferences(publishedRow?.manifest, mediaId);
  return { draft, published, hasPublished: Boolean(publishedRow) };
}

/**
 * Suelta las referencias de un medio en el BORRADOR del negocio.
 *
 * Nunca toca la revision publicada: se exige antes que el medio no se este
 * usando en el sitio en vivo, asi que el cambio queda en el borrador y el
 * administrador decide si publica. Devuelve el manifest resultante o `null` si
 * el negocio no tiene instancia.
 */
export async function detachFromDraft(businessId: string, mediaId: string): Promise<unknown | null> {
  const instance = await prisma.businessSiteInstance.findFirst({ where: { businessId }, select: { id: true, manifest: true } });
  if (!instance) return null;
  const next = detachMediaReferences(instance.manifest, mediaId);
  await prisma.businessSiteInstance.update({ where: { id: instance.id }, data: { manifest: next as any } });
  return next;
}

/** Construye el `metadata` de un medio conservando lo que ya habia. */
export function withMediaInternals(
  previous: unknown,
  internals: { storagePath?: string | null; sizeBytes?: number | null },
): Record<string, unknown> {
  const base = (previous && typeof previous === 'object' && !Array.isArray(previous))
    ? { ...(previous as Record<string, unknown>) }
    : {};
  if (internals.storagePath !== undefined) base.storagePath = internals.storagePath;
  if (internals.sizeBytes !== undefined) base.sizeBytes = internals.sizeBytes;
  return base;
}
