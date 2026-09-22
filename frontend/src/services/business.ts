import api from '@/lib/axios';

export interface Business {
  id: string; ownerId?: string; name: string; slug: string; category: string;
  templateId?: string | null; status: string; logo?: string | null; cover?: string | null;
  description?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null;
  address?: string | null; city?: string | null; region?: string | null; mapsUrl?: string | null;
  hours?: any; socials?: any; cta?: any; settings?: any;
  seoTitle?: string | null; seoDescription?: string | null; ogImage?: string | null;
  template?: { code: string; name: string; category: string; capabilities: string[] } | null;
}

export function buildWaLink(phone: string | null | undefined, message: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  let n = digits;
  if (n.length === 9) n = '56' + n;
  else if (n.length === 11 && n.startsWith('569')) n = '56' + n.slice(2);
  const clean = n.replace(/\D/g, '') || '56900000000';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export async function trackEvent(slug: string, event: string) {
  try { await api.post(`/public/businesses/${slug}/track`, { event }); } catch { /* noop */ }
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

export async function getPublicProperty(slug: string, propertyId: string) {
  const { data } = await api.get(`/public/businesses/${slug}/properties/${propertyId}`);
  return data.property as any;
}
