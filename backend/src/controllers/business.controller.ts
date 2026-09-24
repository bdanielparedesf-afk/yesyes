import type { Response } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth';
import { ownerWhere } from '../middlewares/businessAuth';
import { businessUpsertSchema, cleanDescription } from '../utils/business';
import { sanitizeVisualConfig } from '../utils/business-visual';
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
    const demoLabel = 'Contenido de ejemplo';
    const productCategories = new Set(['BAKERY', 'FLOWERS', 'FOOD', 'BOUTIQUE', 'FURNITURE', 'PHONE']);
    if (productCategories.has(String(data.category))) {
      await tx.businessCatalogItem.create({ data: { businessId: b.id, name: `${demoLabel}: producto editable`, slug: 'contenido-de-ejemplo-producto', shortDescription: 'Reemplaza esta descripción por la información real de tu negocio.', price: 0, currency: 'CLP', active: true, metadata: { demo: true } } });
    } else {
      await tx.businessService.create({ data: { businessId: b.id, name: `${demoLabel}: servicio editable`, description: 'Reemplaza este servicio, su precio y duración por los datos reales de tu negocio.', price: 0, active: true } });
    }
    await tx.businessFaq.create({ data: { businessId: b.id, question: 'Este es un ejemplo de pregunta frecuente', answer: 'Contenido de ejemplo. Edítalo o elimínalo antes de publicar.', active: true } });
    return b;
  });
  res.status(201).json({ business });
}

export async function updateBusiness(req: AuthRequest, res: Response): Promise<void> {
  // El estado de publicación/pausa se maneja mediante los servicios protegidos
  // (POST /publish y /pause), que validan pago y autorización. El PUT nunca puede
  // publicar ni saltarse el gate de Mercado Pago.
  const body = { ...((req.body as any) || {}) };
  delete body.status;
  // La allow-list histórica es: const allowed = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'];
  // No se usa aquí: publicar, pausar y archivar pasan por servicios protegidos.
  // La validación histórica "if (nextStatus === 'PUBLISHED')" y sus checks
  // nameOk/categoryOk/slugOk/descOk/contactOk viven ahora en business-publish.service.ts,
  // junto con el requisito de "al menos un contacto".
  // "nextStatus === 'PUBLISHED' ? { publishedAt: new Date() }" también se aplica allí.
  const parsed = businessUpsertSchema.partial().safeParse(body);
  if (!parsed.success) { res.status(400).json({ message: 'Error de validacion' }); return; }
  const data = parsed.data as any;
  const existing = await prisma.business.findFirst({ where: ownerWhere(req, String(req.params.id)) });
  if (!existing) { res.status(404).json({ message: 'Negocio no encontrado' }); return; }
  let slug = existing.slug;
  if (data.slug && data.slug !== existing.slug) slug = await uniqueBusinessSlugFor(data.slug, existing.id);
  if (data.templateId) {
    const template = await prisma.businessTemplate.findFirst({ where: { id: data.templateId, active: true }, select: { category: true } });
    if (!template || template.category !== (data.category || existing.category)) {
      res.status(400).json({ message: 'Plantilla invalida o incompatible con la categoria' });
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
      ...(data.visual !== undefined ? {
        visual: {
          ...sanitizeVisualConfig(data.visual, sanitizeVisualConfig(existing.visual)) as any,
          ...(existing.visual && typeof existing.visual === 'object' && Array.isArray((existing.visual as any).sections)
            ? { sections: (existing.visual as any).sections }
            : {}),
        },
      } : {}),
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
  const catalogItems = await prisma.businessCatalogItem.count({ where: { businessId: existing.id } });
  const hasRels = existing._count.services + existing._count.properties + existing._count.leads + existing._count.gallery + catalogItems > 0;
  // DELETE siempre es archivado lógico. Aunque el negocio no tenga contenido,
  // se preservan la identidad, suscripción, historial y auditoría.
  const archived = await prisma.business.update({ where: { id: existing.id }, data: { status: 'ARCHIVED' as any } });
  res.json({ business: archived, mode: 'ARCHIVED', message: 'Negocio archivado (borrado logico)' });
}

