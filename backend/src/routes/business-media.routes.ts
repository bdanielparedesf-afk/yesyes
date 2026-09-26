/**
 * YESYES BUSINESS · FASE 6 — API DE MEDIOS DEL NEGOCIO.
 *
 * Montada en `/api/businesses` ANTES que `business.routes`, sin tocar ninguna
 * ruta existente. Toda ruta pasa por dos barreras de seguridad:
 *
 *  1. `requireBusinessOwner` (dueño del negocio o ADMIN).
 *  2. Una comprobación EXPRESA de `businessId` en CADA consulta de medios.
 *
 * La segunda no es redundante: si el middleware se aplicara mal o una ruta nueva
 * lo olvidara, `findFirst({ id, businessId })` sigue impidiendo que el negocio A
 * lea, cambie o borre el medio del negocio B (6.11). Nunca se busca un medio por
 * id solamente.
 *
 * El manifest solo guarda `media:<id>`: esta API crea y destruye los medios
 * reales, y el renderer resuelve la referencia en el momento de pintar.
 */

import { Router, raw, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, type AuthRequest } from '../middlewares/auth';
import { requireBusinessOwner, ownerWhere } from '../middlewares/businessAuth';
import {
  uploadBusinessImage, uploadBusinessVideo, removeStoredObject,
  MAX_VIDEO_BYTES, isUploadKind, VIDEO_MIMES, UPLOAD_KINDS,
} from '../lib/storage';
import {
  MEDIA_PUBLIC_SELECT, mediaOwnerDTO, mediaUsageOf, detachFromDraft,
  withMediaInternals, mediaInternals, normalizeMediaKind,
} from '../services/business-media.service';

const router = Router();
router.use(authenticate);

/** MIME de imagen admitidos por el endpoint de imagen (allowlist cerrada). */
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

const patchSchema = z.object({
  alt: z.string().trim().max(200).nullish(),
  title: z.string().trim().max(200).nullish(),
  position: z.number().int().min(0).max(9999).nullish(),
  posterMediaId: z.string().trim().uuid().nullish(),
});

/** Resuelve el negocio del `:id` y corta la peticion si no es del solicitante. */
async function ownedBusiness(req: AuthRequest, res: Response): Promise<string | null> {
  const businessId = String(req.params.id || '');
  const found = await prisma.business.findFirst({ where: ownerWhere(req, businessId), select: { id: true } });
  if (!found) {
    // Mismo codigo para "no existe" y "no es tuyo": no se revela la existencia
    // de un negocio ajeno.
    res.status(404).json({ message: 'Negocio no encontrado' });
    return null;
  }
  return found.id;
}

/** Un medio del negocio indicado. `businessId` SIEMPRE va en el filtro. */
async function ownedMedia(businessId: string, mediaId: string) {
  return prisma.businessMedia.findFirst({ where: { id: mediaId, businessId }, select: MEDIA_PUBLIC_SELECT });
}

/** Lista de medios del negocio, en el orden que usa el renderer. */
router.get('/:id/media', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = await ownedBusiness(req, res);
  if (!businessId) return;
  const rows = await prisma.businessMedia.findMany({ where: { businessId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  res.json({ media: rows.map((row) => mediaOwnerDTO(row as any)) });
});

/**
 * Sube un medio real y lo registra en el catálogo.
 *
 * `kind=video` sube al bucket de video con su propio límite de 60MB; el resto
 * son imagenes al bucket de imagenes con su límite de 5MB. La extension y el
 * MIME los decide el SERVIDOR por magic bytes: los que declara el cliente solo
 * sirven para decidir si el body se parsea.
 */
router.post(
  '/:id/media',
  requireBusinessOwner,
  raw({ type: [...IMAGE_MIMES, ...VIDEO_MIMES], limit: MAX_VIDEO_BYTES }),
  async (req: AuthRequest, res) => {
    const businessId = await ownedBusiness(req, res);
    if (!businessId) return;
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length === 0) {
      res.status(400).json({ message: 'Archivo invalido: envia una imagen (5MB) o un video MP4/WEBM/MOV (60MB)' });
      return;
    }
    const query = req.query as Record<string, string>;
    const wantsVideo = String(query.kind || '').toUpperCase() === 'VIDEO';
    const alt = typeof query.alt === 'string' ? query.alt.trim().slice(0, 200) : null;
    const title = typeof query.title === 'string' ? query.title.trim().slice(0, 200) : null;
    const declaredMime = String(req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() || '';

    try {
      if (wantsVideo) {
        // El cliente dijo VIDEO pero mando una imagen (o al reves): se rechaza.
        if (!declaredMime.startsWith('video/')) {
          res.status(400).json({ message: 'El archivo enviado no es un video' });
          return;
        }
        if (!(VIDEO_MIMES as readonly string[]).includes(declaredMime)) {
          res.status(415).json({ message: `Formato de video no soportado. Usa: ${VIDEO_MIMES.join(', ')}` });
          return;
        }
        const uploaded = await uploadBusinessVideo({ businessId, buffer });
        const posterMediaId = String(query.posterMediaId || '').trim();
        // El poster DEBE ser un medio del mismo negocio: sin esta comprobacion
        // se podria colgar el video de una imagen de otro negocio.
        const poster = posterMediaId
          ? await prisma.businessMedia.findFirst({
              where: { id: posterMediaId, businessId, kind: 'IMAGE' },
              select: { url: true },
            })
          : null;
        const row = await prisma.businessMedia.create({
          data: {
            businessId,
            kind: 'VIDEO',
            url: uploaded.url,
            posterUrl: poster?.url || null,
            mimeType: uploaded.mimeType,
            alt: alt || title,
            title,
            metadata: withMediaInternals(null, { storagePath: uploaded.storagePath, sizeBytes: uploaded.sizeBytes }) as any,
          },
        });
        res.status(201).json({ media: mediaOwnerDTO(row as any) });
        return;
      }

      const imageKind = String(query.imageKind || 'gallery');
      if (!isUploadKind(imageKind)) {
        res.status(400).json({ message: `Kind de imagen invalido: usa uno de ${UPLOAD_KINDS.join(', ')}` });
        return;
      }
      const url = await uploadBusinessImage({ businessId, kind: imageKind, buffer });
      const row = await prisma.businessMedia.create({
        data: { businessId, kind: 'IMAGE', url, alt, title, mimeType: null },
      });
      res.status(201).json({ media: mediaOwnerDTO(row as any) });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || 'Error subiendo el medio' });
    }
  },
);

/** Metadatos del medio: alt, titulo, orden y poster. No cambia el archivo. */
router.patch('/:id/media/:mediaId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = await ownedBusiness(req, res);
  if (!businessId) return;
  const mediaId = String(req.params.mediaId || '');
  const current = await ownedMedia(businessId, mediaId);
  if (!current) { res.status(404).json({ message: 'Medio no encontrado' }); return; }
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ message: 'Datos invalidos' }); return; }
  const data: Record<string, unknown> = {};
  if (parsed.data.alt !== undefined) data.alt = parsed.data.alt || null;
  if (parsed.data.title !== undefined) data.title = parsed.data.title || null;
  if (parsed.data.position !== undefined) data.position = parsed.data.position;
  if (parsed.data.posterMediaId !== undefined) {
    if (!parsed.data.posterMediaId) {
      data.posterUrl = null;
    } else {
      // El poster se valida contra el mismo negocio: un poster ajeno se rechaza.
      const poster = await prisma.businessMedia.findFirst({
        where: { id: parsed.data.posterMediaId, businessId, kind: 'IMAGE' },
        select: { url: true },
      });
      if (!poster) { res.status(400).json({ message: 'El poster debe ser una imagen de este negocio' }); return; }
      data.posterUrl = poster.url;
    }
  }
  const row = await prisma.businessMedia.update({ where: { id: mediaId }, data: data as any });
  res.json({ media: mediaOwnerDTO(row as any) });
});

/**
 * REEMPLAZO. El archivo nuevo entra en el MISMO medio: conserva su `id`.
 *
 * Es la decision de diseño de 6.12 y la razon de que el manifest guarde ids y no
 * URLs: si el reemplazo creara un medio nuevo, cada seccion que usara la imagen
 * vieja quedaria apuntando al archivo viejo (o habria que re-elegirla en todas).
 * Conservando el id, todas las secciones se actualizan solas.
 *
 * El objeto anterior se borra DESPUES de que el nuevo subio con exito: si el
 * upload falla, el medio sigue apuntando a un archivo que existe.
 */
router.post(
  '/:id/media/:mediaId/replace',
  requireBusinessOwner,
  raw({ type: [...IMAGE_MIMES, ...VIDEO_MIMES], limit: MAX_VIDEO_BYTES }),
  async (req: AuthRequest, res) => {
    const businessId = await ownedBusiness(req, res);
    if (!businessId) return;
    const mediaId = String(req.params.mediaId || '');
    const current = await ownedMedia(businessId, mediaId);
    if (!current) { res.status(404).json({ message: 'Medio no encontrado' }); return; }
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length === 0) {
      res.status(400).json({ message: 'Archivo invalido' });
      return;
    }
    const isVideo = normalizeMediaKind(current.kind) === 'VIDEO';
    const previous = mediaInternals(current);
    try {
      const data: Record<string, unknown> = {};
      if (isVideo) {
        const uploaded = await uploadBusinessVideo({ businessId, buffer });
        data.url = uploaded.url;
        data.mimeType = uploaded.mimeType;
        // El poster NO se toca al reemplazar el video: sigue siendo valido.
        data.metadata = withMediaInternals(current.metadata, { storagePath: uploaded.storagePath, sizeBytes: uploaded.sizeBytes });
      } else {
        data.url = await uploadBusinessImage({ businessId, kind: 'gallery', buffer });
        data.metadata = withMediaInternals(current.metadata, { storagePath: null, sizeBytes: null });
      }
      const row = await prisma.businessMedia.update({ where: { id: mediaId }, data: data as any });
      // Solo ahora se limpia el archivo anterior. Un fallo aqui deja un objeto
      // huerfano (se puede reintentar) pero nunca deja una referencia rota.
      if (previous.storagePath) {
        await removeStoredObject({ businessId, storagePath: previous.storagePath, video: isVideo });
      }
      res.json({ media: mediaOwnerDTO(row as any) });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || 'Error reemplazando el medio' });
    }
  },
);


/** Donde se usa un medio: que secciones del borrador y de la pagina publicada. */
router.get('/:id/media/:mediaId/usage', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = await ownedBusiness(req, res);
  if (!businessId) return;
  const mediaId = String(req.params.mediaId || '');
  const current = await ownedMedia(businessId, mediaId);
  if (!current) { res.status(404).json({ message: 'Medio no encontrado' }); return; }
  res.json({ usage: await mediaUsageOf(businessId, mediaId) });
});

/**
 * BORRADO. Nunca borra un archivo que todavía se usa (6.12).
 *
 * Un medio puede estar en el Hero, en la galería y en otra sección a la vez. Si
 * se borrara a ciegas, las otras secciones quedarían con una referencia rota.
 * Por eso primero se cuentan las referencias:
 *
 *  - Si la REVISIÓN PUBLICADA lo usa -> 409 siempre. El sitio en vivo no se toca.
 *  - Si solo lo usa el BORRADOR -> 409, y el cliente puede reintentar con
 *    `?detach=1` para soltarlo primero y borrarlo despues.
 *  - Si no lo usa nadie -> se borra la fila y el objeto de storage.
 *
 * El borrado físico del objeto es responsabilidad del sistema porque el
 * registro es suyo; si el objeto ya no estuviera, la fila se elimina igual.
 */
router.delete('/:id/media/:mediaId', requireBusinessOwner, async (req: AuthRequest, res) => {
  const businessId = await ownedBusiness(req, res);
  if (!businessId) return;
  const mediaId = String(req.params.mediaId || '');
  const current = await ownedMedia(businessId, mediaId);
  if (!current) { res.status(404).json({ message: 'Medio no encontrado' }); return; }

  const usage = await mediaUsageOf(businessId, mediaId);
  if (usage.published.length > 0) {
    res.status(409).json({
      message: 'Este medio se usa en la pagina publicada. Quitalo del sitio y publica antes de eliminarlo.',
      code: 'MEDIA_IN_USE_PUBLISHED',
      usage,
    });
    return;
  }

  const detach = String((req.query as any).detach || '') === '1';
  if (usage.draft.length > 0 && !detach) {
    res.status(409).json({
      message: 'Este medio se usa en el borrador. Confirma para soltarlo de esas secciones.',
      code: 'MEDIA_IN_USE_DRAFT',
      usage,
    });
    return;
  }
  if (usage.draft.length > 0) {
    await detachFromDraft(businessId, mediaId);
  }

  await prisma.businessMedia.delete({ where: { id: mediaId } });
  const { storagePath } = mediaInternals(current);
  const isVideo = normalizeMediaKind(current.kind) === 'VIDEO';
  const storageRemoved = storagePath
    ? await removeStoredObject({ businessId, storagePath, video: isVideo })
    : null;
  res.json({ ok: true, detached: usage.draft.length, storageRemoved });
});

export default router;
