/**
 * YESYES BUSINESS · FASE 6 — REFERENCIAS A MEDIOS (lado renderer).
 *
 * Espejo exacto de `backend/src/template-engine/media-ref.ts`. Tiene que ser
 * el mismo contrato en los dos lados: el manifest guarda `media:<id>` y el
 * renderer lo resuelve contra la lista de medios que llega en `media`.
 *
 * Antes, los bloques comparaban URLs (`media.find(m => m.url === reference)`).
 * Eso rompia en cuanto un video se reemplazaba: el manifest apuntaria al
 * archivo viejo. Con el id, reemplazar el archivo actualiza todas las
 * secciones que lo usan sin tocar el manifest (6.2 y 6.12).
 *
 * Se mantiene la lectura por URL porque hay borradores y manifests legacy que
 * la guardan; no se escribe nunca.
 */

export const MEDIA_REF_PREFIX = 'media:';

export interface MediaLike {
  id: string;
  kind: string;
  url: string;
  posterUrl?: string | null;
  alt?: string | null;
  title?: string | null;
}

export type MediaKind = 'image' | 'video';

/** Referencia canónica: la que escribe el editor. */
export function encodeMediaRef(mediaId: string): string {
  return `${MEDIA_REF_PREFIX}${String(mediaId || '').trim()}`;
}

/** Referencia legible para mostrar en el inspector ("Video: Cover.mp4"). */
export function mediaRefLabel(mediaId: string, media: MediaLike[] | null | undefined): string {
  const item = (media || []).find((entry) => entry.id === mediaId);
  if (!item) return 'Medio eliminado';
  return item.title || item.alt || item.url.split('/').pop() || 'Medio';
}

export type ParsedMediaRef =
  | { kind: 'empty' }
  | { kind: 'id'; mediaId: string }
  | { kind: 'url'; url: string };

export function parseMediaRef(value: unknown): ParsedMediaRef {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return { kind: 'empty' };
    if (raw.startsWith(MEDIA_REF_PREFIX)) {
      const mediaId = raw.slice(MEDIA_REF_PREFIX.length).trim();
      return mediaId ? { kind: 'id', mediaId } : { kind: 'empty' };
    }
    if (/^https?:\/\//i.test(raw)) return { kind: 'url', url: raw };
    return { kind: 'empty' };
  }
  if (value && typeof value === 'object') {
    const object = value as { mediaId?: unknown; url?: unknown };
    if (typeof object.mediaId === 'string' && object.mediaId.trim()) return { kind: 'id', mediaId: object.mediaId.trim() };
    if (typeof object.url === 'string' && object.url.trim()) return { kind: 'url', url: object.url.trim() };
  }
  return { kind: 'empty' };
}

/**
 * Resuelve la referencia de un campo `media-ref` contra los medios reales.
 * Devuelve `null` cuando no hay medio: el bloque cae a su poster o no se
 * pinta, nunca a un `<video>` roto (6.7).
 */
export function resolveMediaReference(
  value: unknown,
  media: MediaLike[] | null | undefined,
  options: { kind?: MediaKind } = {},
): MediaLike | null {
  const parsed = parseMediaRef(value);
  if (parsed.kind === 'empty') return null;
  const list = (media || []).filter(Boolean);
  const matchesKind = (item: MediaLike) => (options.kind ? String(item.kind).toLowerCase() === options.kind : true);
  if (parsed.kind === 'id') {
    const byId = list.find((item) => item.id === parsed.mediaId);
    if (!byId) return null;
    return matchesKind(byId) ? byId : list.find(matchesKind) || null;
  }
  return list.find((item) => item.url === parsed.url && matchesKind(item)) || null;
}

/** ¿Este medio es el que usa este campo? */
export function mediaRefIs(value: unknown, mediaId: string): boolean {
  const parsed = parseMediaRef(value);
  return parsed.kind === 'id' && parsed.mediaId === mediaId;
}
