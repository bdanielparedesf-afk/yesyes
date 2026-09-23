import type { Response } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth';
import { ownerWhere } from '../middlewares/businessAuth';
import { businessUpsertSchema, cleanDescription } from '../utils/business';
import { uniqueBusinessSlugFor } from '../services/business.service';
import { deleteBusinessImages, storageConfigured } from '../lib/storage';
import { logger } from '../utils/logger';

export async function createBusiness(req: AuthRequest, res: Response): Promise<void> {
  const parsed = businessUpsertSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const data = parsed.data;
  const slug = await uniqueBusinessSlugFor(data.slug || data.name);
  const business = await prisma.$transaction(async (tx) => {
    const b = await tx.business.create({
      data: {
        ownerId: req.user!.id, name: data.name.trim(), slug, category: data.category as any,
        templateId: (data.templateId as string | null) || null,
        description: cleanDescription(data.description) ?? null,
        phone: data.phone || null, whatsapp: data.whatsapp || null, email: data.email || null,
        address: data.address || null, city: data.city || null, region: data.region || null,
        mapsUrl: data.mapsUrl || null, lat: data.lat ?? null, lng: data.lng ?? null,
        hours: (data.hours as any) ?? undefined, socials: (data.socials as any) ?? undefined,
        cta: (data.cta as any) ?? undefined, settings: (data.settings as any) ?? undefined,
        logo: data.logo || null, cover: data.cover || null,
        seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null,
        ogImage: data.ogImage || null, canonical: data.canonical || null,
      },
    });
    if (req.user!.role === 'CUSTOMER') {
      await tx.user.update({ where: { id: req.user!.id }, data: { role: 'BUSINESS' as any } });
    }
    return b;
  });
  res.status(201).json({ business });
}

export async function updateBusiness(req: AuthRequest, res: Response): Promise<void> {
  // Zod .strict() rechaza claves desconocidas; `status` se valida aparte
  // (allow-list abajo) para permitir publicar/pausar al owner.
  const body = { ...((req.body as any) || {}) };
  delete body.status;
  const parsed = businessUpsertSchema.partial().safeParse(body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const data = parsed.data as any;
  const existing = await prisma.business.findFirst({ where: ownerWhere(req, String(req.params.id)) });
  if (!existing) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  let slug = existing.slug;
  if (data.slug && data.slug !== existing.slug) slug = await uniqueBusinessSlugFor(data.slug, existing.id);
  const status = (req.body as any).status;
  const allowed = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'];
  const nextStatus = status && allowed.includes(String(status)) ? String(status) : undefined;
  if (nextStatus === 'PUBLISHED') {
    // Publicacion solo con negocio completo: nombre, categoria, slug,
    // descripcion y al menos un canal de contacto.
    const nameOk = Boolean(data.name ?? existing.name);
    const categoryOk = Boolean(data.category ?? existing.category);
    const slugOk = Boolean(slug);
    const descOk = Boolean(data.description !== undefined ? data.description : existing.description);
    const contactOk = Boolean(
      (data.whatsapp !== undefined ? data.whatsapp : existing.whatsapp) ||
      (data.phone !== undefined ? data.phone : existing.phone) ||
      (data.email !== undefined ? data.email : existing.email),
    );
    if (!nameOk || !categoryOk || !slugOk || !descOk || !contactOk) {
      res.status(400).json({
        message: 'Para publicar se requiere nombre, categoria, slug, descripcion y al menos un contacto (telefono, WhatsApp o email)',
      });
      return;
    }
  }
  const updated = await prisma.business.update({
    where: { id: existing.id },
    data: {
      ...(data.name ? { name: String(data.name).trim() } : {}), slug,
      ...(data.category ? { category: data.category as any } : {}),
      ...(data.templateId !== undefined ? { templateId: data.templateId || null } : {}),
      ...(data.description !== undefined ? { description: cleanDescription(data.description) ?? null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.city !== undefined ? { city: data.city || null } : {}),
      ...(data.region !== undefined ? { region: data.region || null } : {}),
      ...(data.mapsUrl !== undefined ? { mapsUrl: data.mapsUrl || null } : {}),
      ...(data.lat !== undefined ? { lat: data.lat } : {}),
      ...(data.lng !== undefined ? { lng: data.lng } : {}),
      ...(data.hours !== undefined ? { hours: (data.hours as any) ?? undefined } : {}),
      ...(data.socials !== undefined ? { socials: (data.socials as any) ?? undefined } : {}),
      ...(data.cta !== undefined ? { cta: (data.cta as any) ?? undefined } : {}),
      ...(data.settings !== undefined ? { settings: (data.settings as any) ?? undefined } : {}),
      ...(data.logo !== undefined ? { logo: data.logo || null } : {}),
      ...(data.cover !== undefined ? { cover: data.cover || null } : {}),
      ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle || null } : {}),
      ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription || null } : {}),
      ...(data.ogImage !== undefined ? { ogImage: data.ogImage || null } : {}),
      ...(data.canonical !== undefined ? { canonical: data.canonical || null } : {}),
      ...(nextStatus ? { status: nextStatus as any, ...(nextStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}) } : {}),
    },
  });
  res.json({ business: updated });
}
/**
 * Limpieza best-effort de las imagenes del negocio en Supabase Storage.
 * No bloquea el borrado del negocio: si Storage falla se registra un warn
 * (el objeto del bucket queda huerfano, igual que antes de FASE 1.5, pero
 * el owner siempre puede eliminar su negocio).
 */
async function cleanupBusinessImages(businessId: string): Promise<void> {
  if (!storageConfigured()) return;
  try {
    const removed = await deleteBusinessImages(businessId);
    if (removed > 0) logger.info(`[business] imagenes eliminadas de storage: ${removed}`, { businessId });
  } catch (error) {
    logger.warn(`[business] no se pudieron limpiar las imagenes de storage: ${(error as Error).message}`, { businessId });
  }
}

export async function archiveBusiness(req: AuthRequest, res: Response): Promise<void> {
  const existing = await prisma.business.findFirst({
    where: ownerWhere(req, String(req.params.id)),
    include: { _count: { select: { services: true, properties: true, leads: true, gallery: true } } },
  });
  if (!existing) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  const products = await prisma.product.count({ where: { businessId: existing.id } });
  const hasRels = existing._count.services + existing._count.properties + existing._count.leads + existing._count.gallery + products > 0;
  if (!hasRels && existing.status === 'DRAFT') {
    await prisma.business.delete({ where: { id: existing.id } });
    await cleanupBusinessImages(existing.id);
    res.json({ deleted: true, mode: 'HARD' });
    return;
  }
  // Borrado logico (ARCHIVED): se conservan las imagenes para poder restaurar el negocio.
  const archived = await prisma.business.update({ where: { id: existing.id }, data: { status: 'ARCHIVED' as any } });
  res.json({ business: archived, mode: 'ARCHIVED', message: 'Negocio archivado (borrado logico)' });
}

