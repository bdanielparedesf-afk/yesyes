import { prisma } from '../lib/prisma';
import { slugify, isReservedSlug } from '../utils/business';

export async function uniqueBusinessSlugFor(base: string, ignoreId?: string): Promise<string> {
  let candidate = slugify(base);
  if (isReservedSlug(candidate)) candidate = `${candidate}-negocio`;
  let suffix = 0;
  for (;;) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    const existing = await prisma.business.findUnique({ where: { slug } });
    if (!existing || (ignoreId && existing.id === ignoreId)) return slug;
    suffix += 1;
    if (suffix > 200) throw new Error('No se pudo generar slug unico');
  }
}

export const BUSINESS_PUBLIC_SELECT = {
  id: true, name: true, slug: true, category: true, status: true,
  logo: true, cover: true, description: true, phone: true, whatsapp: true,
  email: true, address: true, city: true, region: true, mapsUrl: true,
  lat: true, lng: true, hours: true, socials: true, cta: true,
  seoTitle: true, seoDescription: true, ogImage: true, canonical: true,
  templateId: true,
  template: { select: { code: true, name: true, category: true, capabilities: true } },
} as const;

export function businessCompleteness(b: any): { pct: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['Nombre', !!b?.name],
    ['Descripcion', !!b?.description],
    ['WhatsApp', !!b?.whatsapp],
    ['Direccion', !!b?.address],
    ['Logo', !!b?.logo],
    ['Portada', !!b?.cover],
  ];
  const done = checks.filter(([, v]) => v).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, v]) => !v).map(([k]) => k) };
}
