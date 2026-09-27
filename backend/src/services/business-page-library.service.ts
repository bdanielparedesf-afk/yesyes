/**
 * BIBLIOTECA DE PÁGINAS REUTILIZABLES (solo admin).
 *
 * QUÉ RESUELVE: una peluquería que quedó bien sirve de base para las docenas de
 * peluquerías que vendrán. El admin guarda esa página como ejemplo y la
 * reutiliza para crear la siguiente, en lugar de armarla de cero.
 *
 * POR QUÉ ES UNA TABLA APARTE Y NO UN BUSINESS MÁS:
 *  - es contenido del ADMIN, no del cliente;
 *  - y sobre todo, SOBREVIVE al borrado de la página de origen. Si el ejemplo
 *    fuera un business más, la limpieza de negocios de prueba se llevaría por
 *    delante los mejores ejemplos. Por eso `sourceBusinessId` es un id suelto,
 *    sin relación ni cascada: se borra la página y el ejemplo queda.
 *
 * EL CONTENIDO ES UN SNAPSHOT, no una referencia. Si mañana se edita la página
 * original, el ejemplo guardado no cambia, y reutilizar un ejemplo nunca puede
 * modificar nada que ya esté en manos de otro cliente.
 */
import { prisma } from '../lib/prisma';
import { logBusinessAudit } from './business-audit.service';
import { uniqueBusinessSlugFor } from './business.service';

export interface LibraryEntry {
  id: string;
  name: string;
  description: string | null;
  label: string | null;
  category: string | null;
  sourceBusinessId: string | null;
  sourceBusinessName: string | null;
  templateId: string | null;
  timesUsed: number;
  archived: boolean;
  createdAt: string;
  /** Conteo de lo que trae, para que el admin sepa qué va a obtener. */
  counts: { services: number; products: number; gallery: number; properties: number };
}

const countsOf = (snapshot: any) => ({
  services: (snapshot?.services || []).length,
  products: (snapshot?.products || []).length,
  gallery: (snapshot?.gallery || []).length,
  properties: (snapshot?.properties || []).length,
});

const toEntry = (row: any): LibraryEntry => ({
  id: row.id,
  name: row.name,
  description: row.description,
  label: row.label,
  category: row.category,
  sourceBusinessId: row.sourceBusinessId,
  sourceBusinessName: row.sourceBusinessName,
  templateId: row.templateId,
  timesUsed: row.timesUsed,
  archived: row.archived,
  createdAt: new Date(row.createdAt).toISOString(),
  counts: countsOf(row.snapshot),
});

/** Lista la biblioteca. `includeArchived` deja ver también los apartados. */
export async function listLibrary(options: { includeArchived?: boolean; search?: string } = {}): Promise<LibraryEntry[]> {
  const term = (options.search || '').trim();
  const rows = await prisma.businessPageLibrary.findMany({
    where: {
      ...(options.includeArchived ? {} : { archived: false }),
      ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { label: { contains: term, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
  });
  return rows.map(toEntry);
}

/**
 * GUARDA una página como ejemplo. Copia el contenido; la página sigue intacta.
 */
export async function saveToLibrary(input: {
  businessId: string;
  name?: string;
  description?: string;
  label?: string;
  adminId: string;
}): Promise<LibraryEntry> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    include: {
      services: true, catalogItems: true, gallery: true, properties: true,
      teamMembers: true, testimonials: true, faqs: true, promotions: true,
      siteInstance: true,
    },
  });
  if (!business) throw Object.assign(new Error('Negocio no encontrado'), { status: 404 });

  // Se guarda el contenido, NO los ids. Un ejemplo tiene que poder ir a una
  // página de otro dueño sin arrastrar referencias a los datos del primero.
  const snapshot = {
    name: business.name,
    category: business.category,
    description: business.description,
    phone: business.phone,
    whatsapp: business.whatsapp,
    email: business.email,
    address: business.address,
    city: business.city,
    socials: business.socials,
    cta: business.cta,
    hours: business.hours,
    visual: business.visual,
    seoTitle: business.seoTitle,
    seoDescription: business.seoDescription,
    services: (business.services || []).map((s) => ({ name: s.name, description: s.description, price: s.price, durationMin: s.durationMin, image: s.image, order: s.order })),
    // El catálogo no tiene columna de orden; se conserva el orden en que vino.
    products: (business.catalogItems || []).map((p, i) => ({ name: p.name, description: p.description, price: p.price, image: p.image, order: i })),
    gallery: (business.gallery || []).map((g) => ({ url: g.url, alt: g.alt, order: g.position })),
    // Property es el modelo de inmobiliaria: precio y tipo son obligatorios y
    // no tiene imagen ni orden. Guardar solo lo comparable entre negocios.
    properties: (business.properties || []).map((p) => ({ title: p.title, description: p.description, price: p.price, currency: p.currency, operation: p.operation, type: p.type, address: p.address, city: p.city, region: p.region, bedrooms: p.bedrooms, bathrooms: p.bathrooms, parking: p.parking, areaBuilt: p.areaBuilt, areaTotal: p.areaTotal, features: p.features, agent: p.agent })),
    team: (business.teamMembers || []).map((t) => ({ name: t.name, role: t.role, bio: t.bio, photo: t.photo, order: t.order })),
    testimonials: (business.testimonials || []).map((t) => ({ name: t.name, role: t.role, content: t.content, rating: t.rating, photo: t.photo, order: t.order })),
    faqs: (business.faqs || []).map((f) => ({ question: f.question, answer: f.answer, order: f.order })),
    promotions: (business.promotions || []).map((p) => ({ title: p.title, description: p.description, image: p.image, discountType: p.discountType, discountValue: p.discountValue, order: p.order })),
  };

  const row = await prisma.businessPageLibrary.create({
    data: {
      name: (input.name || business.name).trim().slice(0, 120),
      description: input.description?.trim() || null,
      label: input.label?.trim() || null,
      category: business.category,
      sourceBusinessId: business.id,
      sourceBusinessName: business.name,
      templateId: business.templateId,
      manifest: (business.siteInstance?.manifest as any) ?? undefined,
      snapshot: snapshot as any,
      createdById: input.adminId,
    },
  });
  await logBusinessAudit('BUSINESS_SAVED_TO_LIBRARY', {
    businessId: business.id,
    userId: input.adminId,
    metadata: { ejemplo: row.name, categoria: row.category },
  });
  return toEntry(row);
}

/**
 * REUTILIZA un ejemplo: crea una página NUEVA en DRAFT con ese contenido.
 *
 * NUNCA toca la página de la que salió el ejemplo, ni ninguna otra. El
 * `snapshot` se copia tal cual y se le cambia solo el nombre y el slug, que
 * son lo único que no puede repetirse. La página nace en DRAFT y sin plan: es
 * una base de trabajo, publicarla es una decisión posterior.
 */
export async function reuseFromLibrary(input: {
  libraryId: string;
  name: string;
  ownerId: string;
  category?: string;
  adminId: string;
}): Promise<{ businessId: string; slug: string }> {
  const entry = await prisma.businessPageLibrary.findUnique({ where: { id: input.libraryId } });
  if (!entry) throw Object.assign(new Error('El ejemplo no existe o fue eliminado de la biblioteca'), { status: 404 });
  if (entry.archived) {
    throw Object.assign(new Error('Este ejemplo está apartado de la biblioteca. Reactívalo antes de usarlo.'), { status: 409 });
  }

  const nombre = input.name.trim();
  if (nombre.length < 2) throw Object.assign(new Error('El nombre es muy corto.'), { status: 400 });
  const owner = await prisma.user.findFirst({ where: { id: input.ownerId, isActive: true }, select: { id: true } });
  if (!owner) throw Object.assign(new Error('El cliente no existe o está inactivo'), { status: 404 });

  const snapshot: any = entry.snapshot || {};
  const slug = await uniqueBusinessSlugFor(nombre);
  // La categoría se puede cambiar al reutilizar: un ejemplo de restaurante
  // puede servir de base para una cafetería.
  const category = (input.category || entry.category || 'HAIR').toUpperCase();

  const business = await prisma.business.create({
    data: {
      ownerId: owner.id,
      name: nombre,
      slug,
      category,
      templateId: entry.templateId,
      status: 'DRAFT',
      description: snapshot.description ?? null,
      phone: snapshot.phone ?? null,
      whatsapp: snapshot.whatsapp ?? null,
      email: snapshot.email ?? null,
      address: snapshot.address ?? null,
      city: snapshot.city ?? null,
      socials: (snapshot.socials as any) ?? undefined,
      cta: (snapshot.cta as any) ?? undefined,
      hours: (snapshot.hours as any) ?? undefined,
      visual: (snapshot.visual as any) ?? undefined,
    } as any,
  });

  // El contenido se crea después, en una transacción. `order` es el campo real
  // de orden en estas tablas (no `sortOrder`), y los productos además exigen
  // `slug` y `price`. Los slugs se calculan ANTES porque el mapa de la
  // transacción es síncrono: no se puede esperar una promesa dentro de él.
  const productos = snapshot.products || [];
  const slugsProductos: string[] = [];
  for (const p of productos) slugsProductos.push(await uniqueBusinessSlugFor(`${nombre}-${p.name}`));

  await prisma.$transaction([
    ...(snapshot.services || []).map((s: any, i: number) => prisma.businessService.create({ data: { businessId: business.id, name: s.name, description: s.description ?? null, price: s.price ?? null, durationMin: s.durationMin ?? null, image: s.image ?? null, order: s.order ?? i } as any })),
    ...productos.map((p: any, i: number) => prisma.businessCatalogItem.create({ data: { businessId: business.id, name: p.name, slug: slugsProductos[i], description: p.description ?? null, price: p.price ?? 0, image: p.image ?? null, order: p.order ?? i } as any })),
    ...(snapshot.gallery || []).map((g: any, i: number) => prisma.businessGalleryImage.create({ data: { businessId: business.id, url: g.url, alt: g.alt ?? null, position: g.order ?? i } as any })),
    ...(snapshot.testimonials || []).map((t: any, i: number) => prisma.businessTestimonial.create({ data: { businessId: business.id, name: t.name, role: t.role ?? null, content: t.content, rating: t.rating ?? null, photo: t.photo ?? null, order: t.order ?? i } as any })),
    ...(snapshot.faqs || []).map((f: any, i: number) => prisma.businessFaq.create({ data: { businessId: business.id, question: f.question, answer: f.answer, order: f.order ?? i } as any })),
    ...(snapshot.promotions || []).map((p: any, i: number) => prisma.businessPromotion.create({ data: { businessId: business.id, title: p.title, description: p.description ?? null, image: p.image ?? null, discountType: p.discountType ?? 'TEXT_ONLY', discountValue: p.discountValue ?? null, order: p.order ?? i } as any })),
    ...(snapshot.team || []).map((t: any, i: number) => prisma.businessTeamMember.create({ data: { businessId: business.id, name: t.name, role: t.role ?? null, bio: t.bio ?? null, photo: t.photo ?? null, order: t.order ?? i } as any })),
    ...(snapshot.properties || []).map((p: any) => prisma.property.create({ data: { businessId: business.id, title: p.title, description: p.description ?? null, price: p.price ?? 0, currency: p.currency ?? 'CLP', operation: p.operation, type: p.type, address: p.address ?? null, city: p.city ?? null, region: p.region ?? null, bedrooms: p.bedrooms ?? null, bathrooms: p.bathrooms ?? null, parking: p.parking ?? null, areaBuilt: p.areaBuilt ?? null, areaTotal: p.areaTotal ?? null, features: p.features ?? [], agent: p.agent ?? null } as any })),
  ]);

  await prisma.businessPageLibrary.update({ where: { id: entry.id }, data: { timesUsed: { increment: 1 } } });
  await logBusinessAudit('BUSINESS_REUSED_FROM_LIBRARY', {
    businessId: business.id,
    userId: input.adminId,
    metadata: { ejemplo: entry.name, nuevoNegocio: nombre },
  });
  return { businessId: business.id, slug };
}

/** Aparta o reactiva un ejemplo sin borrarlo. */
export async function setLibraryArchived(libraryId: string, archived: boolean, adminId: string): Promise<LibraryEntry> {
  const row = await prisma.businessPageLibrary.update({ where: { id: libraryId }, data: { archived } });
  await logBusinessAudit('BUSINESS_LIBRARY_ARCHIVED', {
    // Sin página de origen no hay businessId: se registra el id del ejemplo.
    // La auditoría exige un id, y un ejemplo de la biblioteca no es un negocio.
    businessId: row.sourceBusinessId || row.id,
    userId: adminId,
    metadata: { ejemplo: row.name, apartado: archived },
  });
  return toEntry(row);
}

/**
 * Borra un ejemplo de la biblioteca. Distinto de borrar la página: aquí el
 * ejemplo es del admin y no tiene dueño, ni leads, ni cobro asociado.
 */
export async function deleteLibraryEntry(libraryId: string, adminId: string): Promise<{ deleted: boolean; name: string }> {
  const row = await prisma.businessPageLibrary.findUnique({ where: { id: libraryId } });
  if (!row) throw Object.assign(new Error('El ejemplo no existe'), { status: 404 });
  await prisma.businessPageLibrary.delete({ where: { id: libraryId } });
  await logBusinessAudit('BUSINESS_LIBRARY_DELETED', {
    businessId: row.sourceBusinessId || row.id,
    userId: adminId,
    metadata: { ejemplo: row.name },
  });
  return { deleted: true, name: row.name };
}
