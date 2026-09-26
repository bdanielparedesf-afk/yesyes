/**
 * YESYES BUSINESS — SIEMBRA DE MEDIOS DE EJEMPLO.
 *
 * Crea filas REALES en `BusinessMedia` a partir del catálogo por rubro y las
 * conecta al manifest del negocio mediante referencias `media:<id>`.
 *
 * Por qué en dos pasos:
 *  1. `seedExampleMedia` crea los medios y devuelve el mapa ranura -> id.
 *  2. `assignExampleMediaToManifest` los coloca en los bloques `media-ref`.
 *
 * Se separan porque el manifest puede no existir todavia (negocio sin
 * plantilla) y en ese caso los medios se crean igual: el dueño los ve en el
 * panel y los usa cuando quiera, sin volver a subir nada.
 *
 * IDEMPOTENCIA: los medios de ejemplo se reconocen por `metadata.exampleSlot`
 * mas `metadata.example = true`, NO por la URL. Editar la foto, moverla o
 * borrarla no la revive; y una fila del usuario con la misma URL nunca se
 * confunde con una de ejemplo.
 */

import { prisma } from '../lib/prisma';
import { encodeMediaRef } from '../template-engine/media-ref';
import { initialBlockConfig } from '../template-engine/block-registry';
import { exampleMediaFor, type ExampleMedia } from './business-example-media';
import { normalizeMediaKind } from './business-media.service';

export interface SeedMediaResult {
  /** ids de medios creados, indexados por ranura. */
  bySlot: Record<string, string[]>;
  /** Total de filas creadas. */
  created: number;
  /** Means created previously, so the caller can still bind them. */
  reused: number;
  /** Filas escritas en `BusinessGalleryImage` (la galería de la página). */
  gallery?: number;
}

/** Marca interna que identifica un medio sembrado (no una subida del dueño). */
function exampleMetadata(item: ExampleMedia, slot: string) {
  return { example: true, exampleSlot: slot, exampleCategorySeed: true };
}

function isExampleMedia(row: { metadata?: unknown }): boolean {
  const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {};
  return meta.example === true;
}

/**
 * Crea los medios de ejemplo del rubro, o reutiliza los ya sembrados.
 *
 * Con `replace` borra SOLO los medios de ejemplo Previous (identificados por
 * `metadata.example`), nunca los que subiio el dueno.
 */
export async function seedExampleMedia(
  businessId: string,
  category: string,
  options: { replace?: boolean } = {},
): Promise<SeedMediaResult> {
  const catalog = exampleMediaFor(category);
  const result: SeedMediaResult = { bySlot: {}, created: 0, reused: 0 };

  if (options.replace) {
    // Solo filas marcadas como ejemplo. Un medio subido por el dueno tiene
    // `metadata` sin `example` y sobrevive.
    const previous = await prisma.businessMedia.findMany({
      where: { businessId },
      select: { id: true, metadata: true },
    });
    const staleIds = previous.filter((row) => isExampleMedia(row)).map((row) => row.id);
    if (staleIds.length) {
      await prisma.businessMedia.deleteMany({ where: { businessId, id: { in: staleIds } } });
    }
  }

  // Si ya hay medios de ejemplo sembrados y NO se pide replace, se reutilizan
  // tal cual: es lo que permite que recargar la pagina no duplique el catalogo.
  const existing = await prisma.businessMedia.findMany({
    where: { businessId },
    select: { id: true, kind: true, metadata: true },
  });
  const alreadySeeded = existing.filter((row) => isExampleMedia(row));
  if (alreadySeeded.length > 0 && !options.replace) {
    for (const row of alreadySeeded) {
      const slot = String((row.metadata as any)?.exampleSlot || 'gallery');
      (result.bySlot[slot] ||= []).push(row.id);
      result.reused += 1;
    }
    return result;
  }

  for (let index = 0; index < catalog.length; index += 1) {
    const item = catalog[index]!;
    const row = await prisma.businessMedia.create({
      data: {
        businessId,
        kind: normalizeMediaKind(item.kind),
        url: item.url,
        posterUrl: item.posterUrl || null,
        mimeType: item.mimeType,
        width: item.width ?? null,
        height: item.height ?? null,
        durationSec: item.durationSec ?? null,
        alt: item.alt,
        title: item.title,
        metadata: exampleMetadata(item, item.slot),
        position: index,
      },
      select: { id: true },
    });
    (result.bySlot[item.slot] ||= []).push(row.id);
    result.created += 1;
  }

  // La GALERIA de la pagina no lee `BusinessMedia`: el renderer recibe un prop
  // `gallery` que viene de la tabla `BusinessGalleryImage` (ver
  // public-business.routes.ts). Por eso las fotos de la ranura `gallery` se
  // escriben ADEMAS aqui, o la seccion ImageGallery no mostraria nada.
  if ((result.bySlot.gallery || []).length > 0) {
    await prisma.businessGalleryImage.deleteMany({ where: { businessId } });
    const galleryItems = catalog.filter((item) => item.slot === 'gallery');
    await prisma.businessGalleryImage.createMany({
      data: galleryItems.map((item, index) => ({
        businessId,
        url: item.url,
        alt: item.alt,
        title: item.title,
        position: index,
      })),
    });
    result.gallery = galleryItems.length;
  }

  return result;
}

/**
 * Coloca los medios de ejemplo en los bloques `media-ref` del manifest.
 *
 * El manifest guarda `media:<id>`, nunca una URL: por eso reemplazar el archivo
 * mas adelante actualiza la pagina sin volver a tocar la composicion.
 *
 * Reglas de asignacion:
 *  - `cover`  -> el campo `image` del bloque Hero (o el primer `image` que exista).
 *  - `video`  -> `video` + `poster` del bloque Video / HeroVideo.
 *  - `gallery`-> los campos de imagen de ImageGallery, en orden.
 *  - `team`   -> la foto de cada miembro del equipo, si el bloque la pide.
 *
 * NUNCA sobreescribe un medio que el usuario ya eligio: si el campo ya tiene un
 * `media:<id>` que no es de ejemplo, se respeta la eleccion del usuario.
 */

type BlockLike = { block?: string; id?: string; instanceId?: string; config?: Record<string, unknown> };

/** ¿El valor actual del campo es un medio de ejemplo (o esta vacio)? */
function isReplaceable(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  const raw = String(value);
  return raw.startsWith('media:') || /^https?:\/\//i.test(raw);
}

export interface AssignMediaResult {
  /** Cuantas ranuras quedaron conectadas. */
  assigned: number;
  /** Bloques que se agregaron porque el diseño no traia galeria ni video. */
  addedBlocks: string[];
}

/**
 * Conecta los medios ya sembrados con los bloques del manifest del negocio.
 *
 * No falla si el negocio no tiene instancia de sitio: devuelve `assigned: 0` y
 * el llamador sigue. Los medios quedan disponibles en el panel de todas formas.
 */
export async function assignExampleMediaToManifest(
  businessId: string,
  bySlot: Record<string, string[]>,
): Promise<AssignMediaResult> {
  const result: AssignMediaResult = { assigned: 0, addedBlocks: [] };
  if (Object.keys(bySlot).length === 0) return result;

  const instance = await prisma.businessSiteInstance.findUnique({
    where: { businessId },
    select: { id: true, manifest: true },
  });
  if (!instance?.manifest) return result;

  const manifest = JSON.parse(JSON.stringify(instance.manifest)) as {
    sections?: Array<{ id: string; blocks?: BlockLike[] }>;
  };
  const sections = Array.isArray(manifest.sections) ? manifest.sections : [];
  if (!sections.length) return result;

  const galleryQueue = [...(bySlot.gallery || [])];
  const teamQueue = [...(bySlot.team || [])];
  const coverId = (bySlot.cover || [])[0] || null;
  const videoId = (bySlot.video || [])[0] || null;
  const posterId = (bySlot.video || [])[0] || null;

  const setField = (block: BlockLike, field: string, mediaId: string | null) => {
    if (!mediaId) return;
    const config = (block.config || {}) as Record<string, unknown>;
    if (!isReplaceable(config[field])) return;
    config[field] = encodeMediaRef(mediaId);
    block.config = config;
    result.assigned += 1;
  };

  for (const section of sections) {
    const blocks = Array.isArray(section.blocks) ? section.blocks : [];
    for (const block of blocks) {
      const type = String(block.block ?? block.id ?? '');
      const config = (block.config || {}) as Record<string, unknown>;

      // La ranura `image` se completa en el Hero y en cualquier bloque que la
      // declare. No se exige que ya sea string: con `initialBlockConfig` llega
      // en `null`, que es exactamente el caso que hay que llenar.
      if (coverId && 'image' in config && isReplaceable(config.image)) {
        setField(block, 'image', coverId);
      }
      if (type === 'Video' || type === 'HeroVideo') {
        if (videoId) {
          setField(block, 'video', videoId);
          if (posterId) setField(block, 'poster', posterId);
        }
      } else if (type === 'ImageGallery' || type === 'VideoGallery') {
        // Estas galerias NO tienen ranuras `media-ref`: el renderer las alimenta
        // con la lista de medios del negocio (ver BlockProps.gallery), asi que
        // no hay nada que escribir aqui. Solo se respeta si el usuario ya fijo
        // un limite manual.
        if (typeof config.images === 'string' && galleryQueue.length) {
          const next = galleryQueue.shift();
          if (next) setField(block, 'images', next);
        }
      } else if (type === 'Image') {
        const next = galleryQueue.shift();
        if (next) setField(block, 'image', next);
      } else if (type === 'Team') {
        const next = teamQueue.shift();
        if (next) setField(block, 'photo', next);
      }
    }
  }

  // Si hay video de ejemplo y el diseño NO traia un bloque de video, se agrega
  // una seccion. Sin esto el video queda creado en el panel pero invisible en la
  // pagina, que era justo la queja: la pagina se veía vacía.
  if (videoId) {
    const hasVideoBlock = sections.some((section) =>
      (section.blocks || []).some((block) => {
        const type = String(block.block ?? block.id ?? '');
        return type === 'Video' || type === 'HeroVideo' || type === 'VideoGallery';
      }),
    );
    if (!hasVideoBlock) {
      const videoSection = {
        id: 'video',
        label: 'Video',
        // El resto de secciones va de 10 a 120, asi que 400 dejaba el video
        // debajo del pie. Va justo despues de la galeria (30), que es donde
        // suma: foto, despues video.
        order: 35,
        hidden: false,
        blocks: [{
          block: 'Video',
          instanceId: 'video-video',
          config: {
            ...initialBlockConfig('Video'),
            video: encodeMediaRef(videoId),
            // El poster se toma de la propia imagen de portada: es lo que se ve
            // mientras carga el video, en mobile y en reduced-motion.
            poster: coverId ? encodeMediaRef(coverId) : null,
            title: 'En video',
          },
          hidden: false,
          emphasis: 'secondary',
        }],
      };
      sections.push(videoSection);
      result.addedBlocks.push('Video');
      result.assigned += 1;
    }
  }

  await prisma.businessSiteInstance.update({
    where: { businessId },
    data: { manifest: manifest as any },
  });

  return result;
}

