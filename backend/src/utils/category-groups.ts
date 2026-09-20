/**
 * Agrupacion publica de categorias (solo presentacion, NO toca la BD).
 * Las categorias tecnicas `ae-{id}` se agrupan por NOMBRE comercial.
 * Las URLs legacy `/categoria/ae-*` siguen funcionando.
 */

export function isTechnicalAeSlug(slug: string): boolean {
  return /^ae-\d+$/i.test(String(slug || '').trim());
}

function norm(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Nombre comercial -> slug canonico (los que ya crea el resolver AE). */
function canonicalFromName(name: string): string {
  const n = norm(name);
  const byName: Record<string, string> = {
    electronica: 'electronics',
    electronics: 'electronics',
    moda: 'fashion',
    fashion: 'fashion',
    hogar: 'home',
    home: 'home',
    juguetes: 'toys',
    toys: 'toys',
    belleza: 'beauty',
    beauty: 'beauty',
    deportes: 'sports',
    sports: 'sports',
    oficina: 'office',
    office: 'office',
    general: 'general',
  };
  if (byName[n]) return byName[n];
  return n || 'general';
}

/** Slug -> canonico. Acepta alias en espanol (/electronica, /hogar...). */
export function canonicalFromSlug(slug: string): string {
  const s = norm(slug);
  const alias: Record<string, string> = {
    electronica: 'electronics',
    electronics: 'electronics',
    moda: 'fashion',
    fashion: 'fashion',
    hogar: 'home',
    home: 'home',
    juguetes: 'toys',
    toys: 'toys',
    belleza: 'beauty',
    beauty: 'beauty',
    deportes: 'sports',
    sports: 'sports',
    oficina: 'office',
    office: 'office',
    general: 'general',
  };
  return alias[s] || s;
}

const CANONICAL_NAMES: Record<string, string> = {
  electronics: 'Electrónica',
  home: 'Hogar',
  toys: 'Juguetes',
  fashion: 'Moda',
  general: 'General',
  beauty: 'Belleza',
  sports: 'Deportes',
  office: 'Oficina',
  mascotas: 'Mascotas',
  accesorios: 'Accesorios',
  ropa: 'Ropa',
  calzado: 'Calzado',
  computacion: 'Computación',
  importados: 'Importados',
};

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  order?: number;
  active?: boolean;
}

export interface CategoryGroup {
  key: string;
  slug: string;
  name: string;
  image?: string | null;
  order: number;
  categoryIds: string[];
  technicalSlugs: string[];
}
/** Clave comercial: ae-* deriva del NAME; resto alias de slug. */
export function groupKeyOf(cat: CategoryRow): string {
  if (isTechnicalAeSlug(cat.slug)) return canonicalFromName(cat.name);
  return canonicalFromSlug(cat.slug);
}

/** Agrupa filas de Category por clave comercial. */
export function groupCategories(cats: CategoryRow[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const c of cats) {
    const key = groupKeyOf(c);
    const g = map.get(key);
    const cOrder = typeof (c as any).order === 'number' ? (c as any).order : 99;
    if (!g) {
      map.set(key, {
        key, slug: key,
        name: CANONICAL_NAMES[key] || c.name,
        image: (c as any).image ?? null,
        order: cOrder,
        categoryIds: [c.id],
        technicalSlugs: isTechnicalAeSlug(c.slug) ? [c.slug] : [],
      });
    } else {
      g.categoryIds.push(c.id);
      if (isTechnicalAeSlug(c.slug)) g.technicalSlugs.push(c.slug);
      if (!isTechnicalAeSlug(c.slug) && norm(c.slug) === g.key) {
        g.name = c.name;
        if ((c as any).image) g.image = (c as any).image;
        g.order = Math.min(g.order, cOrder);
      } else if (!g.image && (c as any).image) {
        g.image = (c as any).image;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Slug publico -> ids reales. Legacy ae-* devuelve solo ese registro. */
export function resolveGroupIds(
  allCats: CategoryRow[], slug: string,
): { group: CategoryGroup; ids: string[] } | null {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return null;
  if (isTechnicalAeSlug(s)) {
    const found = allCats.find((c) => c.slug.toLowerCase() === s);
    if (!found) return null;
    const key = groupKeyOf(found);
    const groups = groupCategories(allCats);
    const group = groups.find((gg) => gg.key === key);
    return { group: group!, ids: [found.id] };
  }
  const key = canonicalFromSlug(s);
  const groups = groupCategories(allCats);
  const group = groups.find((gg) => gg.key === key);
  if (!group) return null;
  return { group, ids: group.categoryIds };
}

