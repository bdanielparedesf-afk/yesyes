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

/** TaxonomÃ­a pÃºblica de rubros (grupos + categorÃ­as canÃ³nicas, sin duplicados). */
export async function getBusinessTaxonomy() {
  const { data } = await api.get('/public/businesses/taxonomy');
  return data.groups as { group: { key: string; label: string; description: string }; categories: { code: string; label: string; description: string; cta: string }[] }[];
}

/** GalerÃ­a de diseÃ±os de un rubro: nombre, estilo y funciones en lenguaje humano. */
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
 * usuario puede cambiar de diseÃ±o, cambiar la variante de una secciÃ³n y
 * agregar/quitar/reordenar, sin salir de la interfaz ni editar JSON.
 */

/** CatÃ¡logo de diseÃ±os del rubro, con nombres legibles y sin cÃ³digos. */
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
  return (data as { manifest: any }).manifest;
}

/** Cambia el diseÃ±o global conservando el contenido. */
export async function applyBusinessDesign(id: string, templateId: string) {
  const { data } = await api.post(`/business/${id}/design`, { templateId });
  return data as { manifest: any; design: { id: string; label: string } };
}

/** Vista previa de un diseÃ±o SIN aplicarlo: cancelar no cambia nada. */
export async function previewBusinessDesign(id: string, templateId: string) {
  const { data } = await api.post(`/business/${id}/design/preview`, { templateId });
  return data as { manifest: any; design: { id: string; label: string } };
}

/** Cambia la variante de un bloque. El contenido nunca se toca. */
export async function setBusinessBlockVariant(id: string, instanceId: string, variant: string) {
  const { data } = await api.put(`/business/${id}/block/${instanceId}/variant`, { variant });
  return (data as { manifest: any }).manifest;
}

/** Secciones que este rubro puede agregar, con sus variantes. */
export async function getAddableSections(id: string) {
  const { data } = await api.get(`/business/${id}/addable-sections`);
  return data as {
    sections: Array<{ capability: string; label: string; block: string; blockLabel: string; variants: Array<{ id: string; label: string }> }>;
  };
}

/** Agrega una secciÃ³n al manifest. Falla explÃ­citamente si ya existe. */
export async function addBusinessSection(id: string, capability: string, variant?: string) {
  const { data } = await api.post(`/business/${id}/sections`, { capability, variant });
  return (data as { manifest: any }).manifest;
}

/** Reordena, oculta, quita o duplica secciones. */
export async function updateBusinessSections(id: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/business/${id}/sections`, payload);
  return (data as { manifest: any }).manifest;
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


/** Reemplaza la galerÃ­a completa (el backend borra y recrea). */
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

// CatÃ¡logo propio del Business. No usa Product, Category ni carrito de la tienda.
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

