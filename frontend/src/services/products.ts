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

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  providerPrice: number;
  image: string;
  imageHover: string;
  category: string;
  stock: number;
  offer: boolean;
  productImages: ProductImage[];
  productVariants: ProductVariant[];
  collection?: { name: string; slug: string } | null;
}

// Helper que cruza productVariants (BD) con el JSON variants (vid→nameEs/imagen/precio final)
function crossVariants(p: any): ProductVariant[] {
  const jsonVariants: any[] = Array.isArray(p.variants) ? p.variants : [];
  const byVid = new Map<string, any>();
  for (const j of jsonVariants) {
    if (j && (j.vid || j.sku)) byVid.set(String(j.vid || j.sku), j);
    if (j && j.sku) byVid.set(String(j.sku), j);
  }
  const dbVariants: any[] = Array.isArray(p.productVariants) ? p.productVariants : [];
  // Si la BD tiene variantes, úsalas como base; si no, usa el JSON directamente
  if (dbVariants.length) {
    return dbVariants.map((pv: any) => {
      const j = byVid.get(String(pv.sku)) || {};
      return {
        id: pv.id || pv.sku,
        sku: pv.sku,
        name: j.name || pv.name || undefined,
        nameEs: j.nameEs || pv.name || undefined,
        size: pv.size || null,
        color: pv.color || null,
        price: Number(pv.price || 0),
        stock: Number(pv.stock || 0),
        image: j.image || pv.image || undefined,
        finalPrice: Number(j.finalPriceCLP ?? j.finalPrice ?? pv.price ?? 0),
      };
    });
  }
  return jsonVariants.map((j: any, idx: number) => ({
    id: String(j.vid || j.sku || `v-${idx}`),
    sku: String(j.sku || j.vid || `v-${idx}`),
    name: j.name || undefined,
    nameEs: j.nameEs || j.name || undefined,
    size: j.size || null,
    color: j.color || null,
    price: Number(j.finalPriceCLP ?? j.finalPrice ?? j.sellPrice ?? 0),
    stock: Number(j.stock ?? 0),
    image: j.image || undefined,
    finalPrice: Number(j.finalPriceCLP ?? j.finalPrice ?? j.sellPrice ?? 0),
  }));
}

function mapProduct(p: any): Product {
  const images = Array.isArray(p.productImages) ? p.productImages : [];
  const first = images[0]?.url || (Array.isArray(p.images) && p.images[0]) || '';
  const second = images[1]?.url || first;
  const crossedVariants = crossVariants(p);
  const variantMinPrice = crossedVariants.length
    ? Math.min(...crossedVariants.map((v) => v.finalPrice || v.price).filter((n: number) => n > 0))
    : 0;
  const crossedStock = crossedVariants.length
    ? crossedVariants.reduce((acc: number, v) => acc + (Number(v.stock) || 0), 0)
    : 0;
  return {
    id: p.id,
    name: p.name || '',
    slug: p.slug,
    description: p.description || '',
    price: Number(p.salePrice || 0) || (variantMinPrice > 0 ? variantMinPrice : 0),
    providerPrice: Number(p.productCost || p.totalCost || 0),
    image: first,
    imageHover: second,
    category: p.collection?.name || p.category?.name || 'General',
    stock: Number(p.stock || 0) || crossedStock,
    offer: Boolean(p.isOffer),
    productImages: images,
    productVariants: crossedVariants,
    collection: p.collection || null,
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data } = await api.get('/products');
  return (data.products || []).map(mapProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await api.get(`/products/${slug}`);
  return data.product ? mapProduct(data.product) : null;
}
