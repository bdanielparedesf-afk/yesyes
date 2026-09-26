import api from '@/lib/axios';

export interface BusinessSubscriptionSummary {
  id: string;
  status: string;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: string;
  plan?: { name: string; features: string[] } | null;
}

export interface Business {
  id: string; ownerId?: string; name: string; slug: string; category: string; updatedAt?: string;
  templateId?: string | null; status: string; logo?: string | null; cover?: string | null;
  description?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null;
  address?: string | null; city?: string | null; region?: string | null; mapsUrl?: string | null;
  hours?: any; socials?: any; cta?: any; settings?: any;
  seoTitle?: string | null; seoDescription?: string | null; ogImage?: string | null;
  canonical?: string | null;
  template?: { code: string; name: string; category: string; capabilities: string[] } | null;
  visual?: { sections?: Array<{ id: string; enabled: boolean; order: number }> } | null;
  subscription?: BusinessSubscriptionSummary | null;
}

type PublicBusinessCollections = {
  services?: any[];
  products?: any[];
  properties?: any[];
  gallery?: any[];
  testimonials?: any[];
  faqs?: any[];
  promotions?: any[];
  team?: any[];
  bookingSlots?: any[];
};
type PublicBusinessPagePayload = Business & PublicBusinessCollections;
type PublicBusinessPage = {
  business: Business;
  services: any[];
  products: any[];
  properties: any[];
  gallery: any[];
  testimonials: any[];
  faqs: any[];
  promotions: any[];
  team: any[];
  bookingSlots: any[];
};

export async function getPublicBusinessPlan() {
  const { data } = await api.get('/public/businesses/plans');
  return data.plan as { name: string; amount: number; currency: string; frequency: number; frequencyType: string; features: string[] } | null;
}

/** Taxonomía pública de rubros (grupos + categorías canónicas, sin duplicados). */
export async function getBusinessTaxonomy() {
  const { data } = await api.get('/public/businesses/taxonomy');
  return data.groups as { group: { key: string; label: string; description: string }; categories: { code: string; label: string; description: string; cta: string }[] }[];
}

/** Galería de diseños de un rubro: nombre, estilo y funciones en lenguaje humano. */
export async function getPublicTemplates(category?: string) {
  const { data } = await api.get('/public/businesses/templates', { params: category ? { category } : {} });
  return data.templates as { id: string; code: string; category: string; label: string; style: string; legacy: boolean; previewImage?: string | null; functions: string[] }[];
}


export function buildWaLink(phone: string | null | undefined, message: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  let n = digits;
  if (n.length === 9) n = '56' + n;
  else if (n.length === 11 && n.startsWith('569')) n = '56' + n.slice(2);
  const clean = n.replace(/\D/g, '');
  if (!clean) return '#contacto';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export async function trackEvent(slug: string, event: string) {
  try { await api.post(`/public/businesses/${slug}/track`, { event }); } catch { /* noop */ }
}

export async function getPublicPage(slug: string): Promise<PublicBusinessPage> {
  const { data } = await api.get(`/public/businesses/${slug}/page`);
  const {
    services = [], products = [], properties = [], gallery = [],
    testimonials = [], faqs = [], promotions = [], team = [], bookingSlots = [],
    ...business
  } = data as PublicBusinessPagePayload;
  return {
    business,
    services, products, properties, gallery,
    testimonials, faqs, promotions, team, bookingSlots,
  };
}
export async function getPublicBusiness(slug: string) {
  const { data } = await api.get(`/public/businesses/${slug}`);
  return data.business as Business;
}
export async function getPublicServices(slug: string) {
  const { data } = await api.get(`/public/businesses/${slug}/services`);
  return data.services as any[];
}
export async function getPublicProducts(slug: string) {
  const { data } = await api.get(`/public/businesses/${slug}/products`);
  return data.products as any[];
}
export async function getPublicProperties(slug: string, params?: Record<string, string>) {
  const { data } = await api.get(`/public/businesses/${slug}/properties`, { params });
  return data.properties as any[];
}
export async function getPublicGallery(slug: string) {
  const { data } = await api.get(`/public/businesses/${slug}/gallery`);
  return data.gallery as any[];
}
export async function getPublicContent(slug: string) {
  const { data } = await api.get(`/public/businesses/${slug}/content`);
  return data as { testimonials: any[]; faqs: any[]; promotions: any[]; team: any[]; bookingSlots: any[] };
}
export async function createLead(slug: string, payload: any) {
  const { data } = await api.post(`/public/businesses/${slug}/leads`, payload);
  return data;
}

export async function myBusinesses() {
  const { data } = await api.get('/businesses');
  return data.businesses as Business[];
}
export async function createBusiness(payload: any) {
  const { data } = await api.post('/businesses', payload);
  return data.business as Business;
}
export async function updateBusiness(id: string, payload: any) {
  const { data } = await api.put(`/businesses/${id}`, payload);
  return data.business as Business;
}

/** Detalle privado (incluye gallery, services, properties). */
export async function getBusiness(id: string) {
  const { data } = await api.get(`/businesses/${id}`);
  return data.business as any;
}

export async function getBusinessCapabilities(id: string) {
  const { data } = await api.get(`/businesses/${id}/capabilities`);
  return data as { enabled: string[]; available: string[]; sections: any[]; catalog: any[] };
}

/**
 * DISEÃ‘O Y VARIANTES (Fase 4.1).
 *
 * Estas llamadas son lo que convierte el editor en un constructor visual: el
 * usuario puede cambiar de diseño, cambiar la variante de una sección y
 * agregar/quitar/reordenar, sin salir de la interfaz ni editar JSON.
 */

/** Catálogo de diseños del rubro, con nombres legibles y sin códigos. */
export async function getBusinessDesigns(id: string) {
  const { data } = await api.get(`/business/${id}/designs`);
  return data as {
    category: string;
    categoryLabel: string;
    designs: Array<{
      id: string;
      templateId: string;
      label: string;
      styleLabel: string;
      description: string;
      layout: string;
      sections: Array<{ id: string; label: string; blocks: Array<{ block: string; label: string; variants: Array<{ id: string; label: string }> }> }>;
    }>;
  };
}

/** Manifest actual del negocio (borrador). */
export async function getBusinessManifest(id: string) {
  const { data } = await api.get(`/business/${id}/manifest`);
  return (data as { manifest: any; updatedAt?: string | null }).manifest;
}

/**
 * Carga la instancia + manifest de edicion en una sola llamada.
 *
 * El backend garantiza la instancia (`ensureSiteInstance`) antes de responder:
 * una pagina nueva SIEMPRE entra al editor con manifest V2, y una pagina V3
 * antigua sin instancia tambien lo recibe (derivado de su diseño, nunca de
 * `visual.sections`).
 */
export async function loadBusinessSite(id: string) {
  const { data } = await api.get(`/business/${id}/manifest`);
  return data as { manifest: any; updatedAt: string | null };
}

/**
 * PERSISTENCIA PRINCIPAL DEL EDITOR (Fase 4.2 · C).
 *
 * Guarda el manifest V2 completo: el backend lo revalida, escribe la
 * BusinessSiteInstance y abre una revision. `baseUpdatedAt` habilita la
 * deteccion de conflictos: si otra pestana guardo antes, responde 409 y aqui se
 * propaga como error de conflicto (el editor detiene el autosave y recarga).
 */
export async function saveBusinessManifest(id: string, manifest: any, baseUpdatedAt?: string | null, reason?: string) {
  const { data } = await api.put(`/business/${id}/manifest`, {
    manifest,
    baseUpdatedAt: baseUpdatedAt || undefined,
    reason,
  });
  return data as { manifest: any; updatedAt: string | null; warnings?: string[] };
}

/**
 * Cambia el diseño global conservando el contenido.
 *
 * FASE 5 §12 — devuelve `updatedAt`: aplicar un diseño escribe la instancia, así
 * que el editor debe refrescar su sello de optimistic locking. Si no, el
 * siguiente autosave manda el sello viejo y recibe un 409 sin motivo real.
 */
export async function applyBusinessDesign(id: string, templateId: string) {
  const { data } = await api.post(`/business/${id}/design`, { templateId });
  return data as { manifest: any; design: { id: string; label: string }; updatedAt: string | null };
}

/** Vista previa de un diseño SIN aplicarlo: cancelar no cambia nada. */
export async function previewBusinessDesign(id: string, templateId: string) {
  const { data } = await api.post(`/business/${id}/design/preview`, { templateId });
  return data as { manifest: any; design: { id: string; label: string } };
}

/** Cambia la variante de un bloque. El contenido nunca se toca. */
export async function setBusinessBlockVariant(id: string, instanceId: string, variant: string) {
  const { data } = await api.put(`/business/${id}/block/${instanceId}/variant`, { variant });
  return data as { manifest: any; updatedAt: string | null };
}

/** Secciones que este rubro puede agregar, con sus variantes. */
export async function getAddableSections(id: string) {
  const { data } = await api.get(`/business/${id}/addable-sections`);
  return data as {
    sections: Array<{ capability: string; label: string; block: string; blockLabel: string; variants: Array<{ id: string; label: string }> }>;
  };
}

/**
 * Agrega una sección al manifest. Falla explícitamente si ya existe.
 *
 * FASE 5 §10 — el backend RECHAZA (422) una capability que el rubro no admite,
 * sin modificar el manifest. FASE 5 §12 — devuelve `updatedAt` para refrescar el
 * sello de optimistic locking del editor.
 */
export async function addBusinessSection(id: string, capability: string, variant?: string) {
  const { data } = await api.post(`/business/${id}/sections`, { capability, variant });
  return data as { manifest: any; updatedAt: string | null };
}

/** Reordena, oculta, quita o duplica secciones. */
export async function updateBusinessSections(id: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/business/${id}/sections`, payload);
  return data as { manifest: any; updatedAt: string | null };
}
export async function saveBusinessCapabilities(id: string, sections: Array<{ id: string; enabled: boolean; order: number }>) {
  const { data } = await api.put(`/businesses/${id}/capabilities`, { sections });
  return data as { sections: any[]; available: string[]; catalog: any[] };
}

export async function publishBusinessPage(id: string) {
  const { data } = await api.post(`/businesses/${id}/publish`);
  return data as { business: Business; checklist?: any[]; subscription?: BusinessSubscriptionSummary | null };
}

export async function pauseBusinessPage(id: string, reason = 'owner') {
  const { data } = await api.post(`/businesses/${id}/pause`, { reason });
  return data.business as Business;
}


/** Reemplaza la galería completa (el backend borra y recrea). */
export async function saveGallery(businessId: string, images: { url: string; alt?: string | null }[]) {
  const { data } = await api.put(`/businesses/${businessId}/gallery`, { images });
  return data.gallery as any[];
}

export type UploadKind = 'logo' | 'cover' | 'gallery' | 'service' | 'property' | 'product';

/** Upload binario a Supabase Storage via backend (image/*, max 5MB, validado por magic bytes). */
export async function uploadBusinessImage(businessId: string, kind: UploadKind, file: File): Promise<string> {
  const { data } = await api.post(`/businesses/${businessId}/upload?kind=${kind}`, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    transformRequest: [(d) => d],
  });
  return data.url as string;
}

/* ============================ FASE 6 · MEDIOS ============================ */

/**
 * Un medio del negocio (imagen o video). Es la unidad a la que apunta el
 * manifest mediante `media:<id>`: nunca a una URL suelta.
 */
export interface BusinessMediaItem {
  id: string;
  businessId?: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  posterUrl: string | null;
  alt: string | null;
  title: string | null;
  sizeBytes: number | null;
  position: number;
  mimeType?: string | null;
  durationSec?: number | null;
}

export const VIDEO_MIME_ALLOWLIST = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

/** Lista los medios del negocio. */
export async function listBusinessMedia(businessId: string): Promise<BusinessMediaItem[]> {
  const { data } = await api.get(`/businesses/${businessId}/media`);
  return (data.media || []) as BusinessMediaItem[];
}

/**
 * Sube un medio real y devuelve el registro del catálogo.
 *
 * El `Content-Type` que se manda es el del archivo, pero el servidor lo ignora
 * para decidir el tipo: lo deduce de los magic bytes. Un `.mp4` que en realidad
 * sea un texto se rechaza igual en el servidor.
 */
export async function uploadBusinessMedia(
  businessId: string,
  file: File,
  options: { kind?: 'IMAGE' | 'VIDEO'; imageKind?: UploadKind; alt?: string | null; title?: string | null; posterMediaId?: string } = {},
): Promise<BusinessMediaItem> {
  const params = new URLSearchParams();
  const kind = options.kind || 'IMAGE';
  params.set('kind', kind);
  if (kind === 'IMAGE') params.set('imageKind', options.imageKind || 'gallery');
  if (options.alt) params.set('alt', options.alt);
  if (options.title) params.set('title', options.title);
  if (options.posterMediaId) params.set('posterMediaId', options.posterMediaId);
  const { data } = await api.post(`/businesses/${businessId}/media?${params.toString()}`, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    transformRequest: [(d) => d],
  });
  return data.media as BusinessMediaItem;
}

/**
 * Reemplaza el ARCHIVO de un medio conservando su `id`.
 *
 * Es lo que hace que las secciones que ya lo usan se actualicen solas: el
 * manifest sigue apuntando al mismo medio, solo cambia lo que hay detrás.
 */
export async function replaceBusinessMedia(businessId: string, mediaId: string, file: File): Promise<BusinessMediaItem> {
  const { data } = await api.post(`/businesses/${businessId}/media/${mediaId}/replace`, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    transformRequest: [(d) => d],
  });
  return data.media as BusinessMediaItem;
}

/** Edita los metadatos de un medio (alt, titulo, orden, poster). */
export async function updateBusinessMedia(
  businessId: string,
  mediaId: string,
  patch: { alt?: string | null; title?: string | null; position?: number; posterMediaId?: string | null },
): Promise<BusinessMediaItem> {
  const { data } = await api.patch(`/businesses/${businessId}/media/${mediaId}`, patch);
  return data.media as BusinessMediaItem;
}

export interface MediaUsage {
  draft: Array<{ sectionId: string; blockId: string; field: string }>;
  published: Array<{ sectionId: string; blockId: string; field: string }>;
  hasPublished: boolean;
}

/** Donde se usa un medio: secciones del borrador y de la pagina publicada. */
export async function businessMediaUsage(businessId: string, mediaId: string): Promise<MediaUsage> {
  const { data } = await api.get(`/businesses/${businessId}/media/${mediaId}/usage`);
  return data.usage as MediaUsage;
}

/**
 * Borra un medio. El servidor se NEGA a borrarlo si algo lo usa, y devuelve
 * 409 con las referencias. `detach` suelta primero las del borrador; nunca
 * toca la revisión publicada.
 */
export async function deleteBusinessMedia(
  businessId: string,
  mediaId: string,
  options: { detach?: boolean } = {},
): Promise<{ ok: boolean; detached: number; storageRemoved: boolean | null }> {
  const { data } = await api.delete(`/businesses/${businessId}/media/${mediaId}${options.detach ? '?detach=1' : ''}`);
  return data;
}

export async function getPublicProperty(slug: string, propertyId: string) {
  const { data } = await api.get(`/public/businesses/${slug}/properties/${propertyId}`);
  return data.property as any;
}

/* ============================ Dashboard Business ============================ */

/** Plantillas activas (opcionalmente filtradas por categoria) para el picker. */
export async function getTemplates(category?: string) {
  const { data } = await api.get('/businesses/templates', { params: category ? { category } : {} });
  return data.templates as { id: string; code: string; name: string; category: string; capabilities: string[] }[];
}

/**
 * Vista previa autenticada (?preview=true). El backend exige ser owner o ADMIN
 * y devuelve el negocio en cualquier estado (DRAFT/PAUSED/ARCHIVED/PUBLISHED).
 */
export async function getPreviewBusiness(slug: string, token?: string | null) {
  if (token && token !== 'true') {
    const { data } = await api.get(`/public/businesses/${encodeURIComponent(slug)}/preview`, { params: { token } });
    return data as {
      business: Business; services: any[]; products: any[]; properties: any[]; gallery: any[];
      testimonials: any[]; faqs: any[]; promotions: any[]; team: any[]; bookingSlots: any[];
    };
  }
  const { data } = await api.get(`/businesses/preview/${encodeURIComponent(slug)}`);
  return data as {
    business: Business; services: any[]; products: any[]; properties: any[]; gallery: any[];
    testimonials: any[]; faqs: any[]; promotions: any[]; team: any[]; bookingSlots: any[];
  };
}

export async function deleteBusiness(id: string) {
  const { data } = await api.delete(`/businesses/${id}`);
  return data as { deleted?: boolean; mode?: 'HARD' | 'ARCHIVED' };
}

/* ------------------------------ Servicios ------------------------------ */
export async function listServices(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/services`);
  return data.services as any[];
}
export async function createService(businessId: string, payload: any) {
  const { data } = await api.post(`/businesses/${businessId}/services`, payload);
  return data.service as any;
}
export async function updateService(businessId: string, serviceId: string, payload: any) {
  const { data } = await api.put(`/businesses/${businessId}/services/${serviceId}`, payload);
  return data.service as any;
}
export async function deleteService(businessId: string, serviceId: string) {
  const { data } = await api.delete(`/businesses/${businessId}/services/${serviceId}`);
  return data as { deleted: boolean };
}

// Catálogo propio del Business. No usa Product, Category ni carrito de la tienda.
export async function listBusinessProducts(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/products`);
  return data.products as any[];
}
export async function createBusinessProduct(businessId: string, payload: any) {
  const { data } = await api.post(`/businesses/${businessId}/products`, payload);
  return data.product as any;
}
export async function updateBusinessProduct(businessId: string, productId: string, payload: any) {
  const { data } = await api.put(`/businesses/${businessId}/products/${productId}`, payload);
  return data.product as any;
}
export async function deleteBusinessProduct(businessId: string, productId: string) {
  const { data } = await api.delete(`/businesses/${businessId}/products/${productId}`);
  return data as { deleted: boolean; mode?: 'HARD' | 'ARCHIVED' };
}
export async function duplicateBusinessProduct(businessId: string, productId: string) {
  const { data } = await api.post(`/businesses/${businessId}/products/${productId}/duplicate`);
  return data.product as any;
}
export async function getBusinessContent(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/content`);
  return data as { testimonials: any[]; faqs: any[]; promotions: any[]; team: any[] };
}
export async function createBusinessContent(businessId: string, section: 'testimonials' | 'faqs' | 'promotions' | 'team', payload: any) {
  const { data } = await api.post(`/businesses/${businessId}/content/${section}`, payload);
  return data.item as any;
}
export async function updateBusinessContent(businessId: string, section: 'testimonials' | 'faqs' | 'promotions' | 'team', itemId: string, payload: any) {
  const { data } = await api.put(`/businesses/${businessId}/content/${section}/${itemId}`, payload);
  return data.item as any;
}
export async function deleteBusinessContent(businessId: string, section: 'testimonials' | 'faqs' | 'promotions' | 'team', itemId: string) {
  const { data } = await api.delete(`/businesses/${businessId}/content/${section}/${itemId}`);
  return data as { deleted: boolean };
}
export async function getBusinessBookings(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/bookings`);
  return data.bookings as any[];
}
export async function updateBusinessBooking(businessId: string, bookingId: string, status: string) {
  const { data } = await api.put(`/businesses/${businessId}/bookings/${bookingId}`, { status });
  return data.booking as any;
}

/* ------------------------------ Propiedades ------------------------------ */
export async function listProperties(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/properties`);
  return data.properties as any[];
}
export async function createProperty(businessId: string, payload: any) {
  const { data } = await api.post(`/businesses/${businessId}/properties`, payload);
  return data.property as any;
}
export async function updateProperty(businessId: string, propertyId: string, payload: any) {
  const { data } = await api.put(`/businesses/${businessId}/properties/${propertyId}`, payload);
  return data.property as any;
}
export async function deleteProperty(businessId: string, propertyId: string) {
  const { data } = await api.delete(`/businesses/${businessId}/properties/${propertyId}`);
  return data as { deleted: boolean };
}

/* -------------------------- Leads y analytics -------------------------- */
export async function getBusinessLeads(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/leads`);
  return data.leads as any[];
}
export async function getBusinessStats(businessId: string) {
  const { data } = await api.get(`/businesses/${businessId}/stats`);
  return data as {
    stats: any[];
    totals: {
      pageViews: number; waClicks: number; phoneClicks: number; emailClicks: number;
      leads: number; productViews: number; propertyViews: number;
    };
  };
}
