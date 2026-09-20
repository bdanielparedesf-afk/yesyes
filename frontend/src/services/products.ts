import api from '@/lib/axios';

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  position: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name?: string;
  nameEs?: string;
  size?: string | null;
  color?: string | null;
  price: number;
  stock: number;
  image?: string;
  finalPrice?: number;
}

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
}

export interface CollectionInfo {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number;
  providerPrice: number;
  image: string;
  imageHover: string;
  category: string;
  categorySlug?: string;
  stock: number;
  offer: boolean;
  isFeatured?: boolean;
  productImages: ProductImage[];
  productVariants: ProductVariant[];
  collection?: CollectionInfo | null;
}

export interface HomeData {
  categories: { id: string; name: string; slug: string; image?: string | null; productCount: number }[];
  featured: Product[];
  latest: Product[];
  offers: Product[];
  byCategory: Record<string, Product[]>;
  uncategorized: Product[];
}

interface DbProductImage { url: string; alt?: string; position: number; id?: string }

function crossVariants(p: any): ProductVariant[] {
  // Product.variants ahora se guarda como array plano de PreviewVariant
  // (antes existio como objeto { type: [...] } y el cruce quedaba vacio).
  const rawVariants: any = Array.isArray(p.variants) ? p.variants : (Array.isArray(p.variants?.type) ? p.variants.type : []);
  const jsonVariants: any[] = rawVariants;
  const byVid = new Map<string, any>();
  for (const j of jsonVariants) {
    if (j && (j.supplierVariantId || j.vid || j.sku)) byVid.set(String(j.supplierVariantId || j.vid || j.sku), j);
    if (j && j.sku) byVid.set(String(j.sku), j);
  }
  const dbVariants: any[] = Array.isArray(p.productVariants) ? p.productVariants : [];
  if (dbVariants.length) {
    return dbVariants.map((pv: any) => {
      const j = byVid.get(String(pv.sku))
        || (pv.supplierVariantId ? byVid.get(String(pv.supplierVariantId)) : undefined)
        || (pv.sku && pv.sku.includes('-') ? byVid.get(String(pv.sku.split('-').slice(1).join('-'))) : undefined)
        || {};
      // El precio de la variante seleccionada manda: pv.price ya es el precio
      // de venta individual calculado en backend (costo variante + envio
      // variante, con el mismo margen, convertido a CLP).
      const label = j.skuAttr
        || [j.attributes?.map?.((a: any) => a?.value).filter(Boolean).join(' / ')].filter(Boolean)[0]
        || j.name
        || undefined;
      const variantPrice = Number(pv.price ?? 0);
      return {
        id: pv.id || pv.sku,
        sku: pv.sku || pv.supplierVariantId || '',
        name: label || j.nameEs || pv.size || undefined,
        nameEs: label || j.nameEs || pv.size || undefined,
        size: pv.size ?? null,
        color: pv.color ?? null,
        price: variantPrice,
        stock: Number(pv.stock ?? 0),
        image: j.image || pv.supplierImage || undefined,
        finalPrice: Number(j.salePriceClp ?? j.finalPriceCLP ?? j.finalPrice ?? (variantPrice || 0)),
      };
    });
  }
  return jsonVariants.map((j: any, idx: number) => ({
    id: String(j.vid || j.sku || `v-${idx}`),
    sku: String(j.sku || j.vid || `v-${idx}`),
    name: j.name || j.size || undefined,
    nameEs: j.nameEs || j.size || undefined,
    size: j.size || null,
    color: j.color || null,
    price: Number(j.finalPriceCLP ?? j.finalPrice ?? j.sellPrice ?? 0),
    stock: Number(j.stock ?? 0),
    image: j.image || undefined,
    finalPrice: Number(j.finalPriceCLP ?? j.finalPrice ?? j.sellPrice ?? 0),
  }));
}

function mapProduct(p: any): Product {
  const images: ProductImage[] = Array.isArray(p.productImages)
    ? p.productImages.map((img: DbProductImage, idx: number) => ({
        id: img.id || `img-${p.id}-${idx}`,
        url: img.url,
        alt: img.alt,
        position: img.position ?? idx,
      }))
    : [];

  const first = images[0]?.url || (Array.isArray(p.images) && typeof p.images[0] === 'string' ? p.images[0] : '') || '';
  const second = images[1]?.url || (Array.isArray(p.images) && typeof p.images[1] === 'string' ? p.images[1] : '') || first;
  const crossedVariants = crossVariants(p);
  const variantMinPrice = crossedVariants.length
    ? Math.min(...crossedVariants.map((v) => v.finalPrice || v.price).filter((n: number) => n > 0))
    : 0;
  const crossedStock = crossedVariants.length
    ? crossedVariants.reduce((acc: number, v) => acc + (Number(v.stock) || 0), 0)
    : 0;

  const categoryName = p.category?.name || 'General';
  const categorySlug = p.category?.slug || 'general';

  return {
    id: p.id,
    name: p.name || '',
    slug: p.slug,
    description: p.description || '',
    price: Number(p.salePrice || 0) || (variantMinPrice > 0 ? variantMinPrice : 0),
    compareAtPrice: Number(p.compareAtPrice || 0),
    providerPrice: Number(p.productCost || p.totalCost || 0),
    image: first,
    imageHover: second,
    category: categoryName,
    categorySlug,
    stock: Number(p.stock || 0) || crossedStock,
    offer: Boolean(p.isOffer),
    isFeatured: Boolean(p.isFeatured),
    productImages: images,
    productVariants: crossedVariants,
    collection: p.collection || null,
  };
}

export function mapProducts(products: any[]): Product[] {
  return products.map(mapProduct);
}

export async function getProducts(params?: {
  search?: string;
  category?: string;
  collection?: string;
  limit?: number;
  offset?: number;
}): Promise<{ products: Product[]; total: number }> {
  const { data } = await api.get('/products', { params });
  return { products: (data.products || []).map(mapProduct), total: data.total || 0 };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await api.get(`/products/${slug}`);
  return data.product ? mapProduct(data.product) : null;
}

export async function getHomeData(): Promise<{ categories: any[]; featured: Product[]; latest: Product[]; offers: Product[]; byCategory: Record<string, Product[]>; uncategorized: Product[] }> {
  const { data } = await api.get('/products/home');
  const mapArr = (arr: any[]) => (Array.isArray(arr) ? arr.map(mapProduct) : []);
  return {
    categories: data.categories || [],
    featured: mapArr(data.featured || []),
    latest: mapArr(data.latest || []),
    offers: mapArr(data.offers || []),
    byCategory: Object.fromEntries(
      Object.entries(data.byCategory || {}).map(([k, v]) => [k, mapArr(v as any[])]),
    ),
    uncategorized: mapArr(data.uncategorized || []),
  };
}

export async function getCategories(): Promise<any[]> {
  const { data } = await api.get('/categories');
  return data.categories || [];
}

export async function getProductsByCategory(slug: string): Promise<{ category: any; products: Product[]; total: number }> {
  const { data } = await api.get(`/products/category/${slug}`);
  return { category: data.category, products: (data.products || []).map(mapProduct), total: data.total || 0 };
}
