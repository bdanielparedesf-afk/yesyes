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
  size?: string | null;
  color?: string | null;
  price: number;
  stock: number;
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

function mapProduct(p: any): Product {
  const images = Array.isArray(p.productImages) ? p.productImages : [];
  const first = images[0]?.url || (Array.isArray(p.images) && p.images[0]) || '';
  const second = images[1]?.url || first;
  return {
    id: p.id,
    name: p.name || '',
    slug: p.slug,
    description: p.description || '',
    price: Number(p.salePrice || 0),
    providerPrice: Number(p.productCost || p.totalCost || 0),
    image: first,
    imageHover: second,
    category: p.collection?.name || p.category?.name || 'General',
    stock: Number(p.stock || 0),
    offer: Boolean(p.isOffer),
    productImages: images,
    productVariants: Array.isArray(p.productVariants) ? p.productVariants : [],
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
