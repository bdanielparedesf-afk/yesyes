/**
 * YESYES BUSINESS · FASE 6 — REFERENCIAS ESTABLES A MEDIOS.
 *
 * Un manifest NUNCA guarda un archivo binario ni depende de una URL temporal.
 * Guarda una REFERENCIA ESTABLE al medio, que el renderer resuelve contra la
 * tabla `BusinessMedia` del negocio.
 *
 *   { "video": "media:8f1c…" }        ← forma canónica (referencia estable)
 *   { "poster": "media:2a90…" }
 *
 * Se aceptan además dos formas por compatibilidad, porque ya hay borradores y
 * los 98 templates legacy guardaban URLs:
 *   { "video": { "mediaId": "8f1c…" } }  ← forma estructurada equivalente
 *   { "video": "https://…/uuid.mp4" }    ← URL plana legacy (se sigue leyendo)
 *
 * La URL plana NO se genera nunca desde el editor: el picker siempre escribe la
 * forma `media:<id>`. Así, reemplazar el archivo de un medio (que conserva su
 * `id`) actualiza todas las secciones que lo usan sin tocar el manifest.
 */

export const MEDIA_REF_PREFIX = 'media:';

export type MediaKind = 'image' | 'video';

export interface MediaLike {
  id: string;
  kind: string;
  url: string;
  posterUrl?: string | null;
  alt?: string | null;
  title?: string | null;
}

/** Referencia canónica a partir del id del medio. */
export function encodeMediaRef(mediaId: string): string {
  return `${MEDIA_REF_PREFIX}${String(mediaId || '').trim()}`;
}

export type ParsedMediaRef =
  | { kind: 'empty' }
  /** Referencia estable: el manifest apunta al id, no a la URL. */
  | { kind: 'id'; mediaId: string }
  /** URL plana heredada de borradores o manifests legacy. */
  | { kind: 'url'; url: string };

/**
 * Interpreta el valor de un campo `media-ref`. Acepta las tres formas documentadas
 * y nunca lanza: un valor raro es simplemente "sin medio".
 */
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
 * Resuelve una referencia contra la lista de medios del negocio.
 *
 * Prioridad: id estable > URL legacy. Filtra por `kind` cuando el bloque lo
 * necesita (un poster de video NO puede ser un video). Devuelve `null` si no
 * hay medio: el bloque cae entonces a su fallback visual, nunca a un error.
 */
export function resolveMediaReference(
  value: unknown,
  media: MediaLike[] | null | undefined,
  options: { kind?: MediaKind } = {},
): MediaLike | null {
  const parsed = parseMediaRef(value);
  if (parsed.kind === 'empty') return null;
  const list = Array.isArray(media) ? media.filter(Boolean) : [];
  const matchesKind = (item: MediaLike) => (options.kind ? String(item.kind).toLowerCase() === options.kind : true);
  if (parsed.kind === 'id') {
    const byId = list.find((item) => item.id === parsed.mediaId);
    if (!byId) return null;
    // Un id que existe pero es del tipo equivocado no se usa: se busca otro
    // medio del tipo pedido, o se devuelve null.
    return matchesKind(byId) ? byId : list.find(matchesKind) || null;
  }
  return list.find((item) => item.url === parsed.url && matchesKind(item)) || null;
}

/** ¿Este valor del manifest apunta a este medio concreto? */
export function mediaRefMatches(value: unknown, mediaId: string): boolean {
  const parsed = parseMediaRef(value);
  return parsed.kind === 'id' && parsed.mediaId === mediaId;
}

export interface MediaReferenceHit {
  sectionId: string;
  blockId: string;
  field: string;
}

/**
 * Recorre el manifest y devuelve TODOS los lugares que usan un medio.
 *
 * Es lo que permite upholdar 6.12: antes de borrar un archivo se comprueba que
 * ninguna sección lo referencia. Se recorren `config` y `items`, que es donde
 * el BlockRegistry declara sus campos `media-ref`.
 */
export function collectMediaReferences(manifest: unknown, mediaId: string): MediaReferenceHit[] {
  const hits: MediaReferenceHit[] = [];
  const sections = (manifest as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return hits;
  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const sectionId = String((section as { id?: unknown }).id ?? '');
    const blocks = (section as { blocks?: unknown[] }).blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const blockId = String((block as { id?: unknown }).id ?? '');
      const config = (block as { config?: Record<string, unknown> }).config;
      if (config && typeof config === 'object') {
        for (const [field, value] of Object.entries(config)) {
          if (mediaRefMatches(value, mediaId)) hits.push({ sectionId, blockId, field });
        }
      }
      const items = (block as { items?: unknown[] }).items;
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          if (!item || typeof item !== 'object') return;
          for (const [field, value] of Object.entries(item as Record<string, unknown>)) {
            if (mediaRefMatches(value, mediaId)) hits.push({ sectionId, blockId, field: `${field}#${index}` });
          }
        });
      }
    }
  }
  return hits;
}

/**
 * Todos los ids de medio referenciados por un manifest.
 *
 * Recorre en profundidad: una referencia vive dentro de `config` o de `items`,
 * que a su vez están dentro de bloques y secciones. Un recorrido de un solo
 * nivel habría devuelto un set vacío y el borrado creería que nadie usa el
 * medio: exactamente el fallo que 6.12 tiene que impedir.
 */
export function mediaIdsInManifest(manifest: unknown): Set<string> {
  const ids = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    for (const value of Object.values(node as Record<string, unknown>)) {
      // Un string puede ser la referencia (`media:<id>`): se interpreta aqui.
      if (typeof value === 'string') {
        const parsed = parseMediaRef(value);
        if (parsed.kind === 'id') ids.add(parsed.mediaId);
        continue;
      }
      // Un objeto puede ser un contenedor: se sigue hacia abajo.
      if (value && typeof value === 'object') walk(value);
    }
  };
  walk(manifest);
  return ids;
}


/**
 * Copia del manifest con las referencias de un medio quitadas.
 *
 * Se usa en el borrado explícito (`detach`): primero se sueltan los usos y
 * LUEGO se borra el archivo, para que ninguna sección quede apuntando al vacío.
 * Devuelve un manifest NUEVO (el historial de undo/redo necesita clones reales).
 */
export function detachMediaReferences(manifest: unknown, mediaId: string): unknown {
  const clone = JSON.parse(JSON.stringify(manifest ?? {})) as Record<string, any>;
  const sections = Array.isArray(clone.sections) ? clone.sections : [];
  for (const section of sections) {
    for (const block of section?.blocks || []) {
      if (block?.config && typeof block.config === 'object') {
        for (const field of Object.keys(block.config)) {
          if (mediaRefMatches(block.config[field], mediaId)) block.config[field] = null;
        }
      }
      if (Array.isArray(block?.items)) {
        for (const item of block.items) {
          if (!item || typeof item !== 'object') continue;
          for (const field of Object.keys(item)) {
            if (mediaRefMatches(item[field], mediaId)) item[field] = null;
          }
        }
      }
    }
  }
  return clone;
}

