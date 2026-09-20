import { useEffect, useState } from 'react';
import { getProducts } from '@/services/products';
import type { Product } from '@/services/products';
import ProductCard from '@/components/ProductCard';

interface RelatedProductsProps {
  categorySlug?: string;
  excludeId?: string;
  title?: string;
}

/**
 * Productos relacionados: se cargan despues del producto principal (no bloquean
 * la ficha) y reutilizan el catalogo publico ya existente.
 */
export default function RelatedProducts({
  categorySlug, excludeId, title = 'También te puede interesar',
}: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(Boolean(categorySlug));

  useEffect(() => {
    if (!categorySlug) { setProducts([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    getProducts({ category: categorySlug, limit: 8 })
      .then((data) => {
        if (!alive) return;
        setProducts(data.products.filter((p) => p.id !== excludeId).slice(0, 4));
      })
      .catch(() => { if (alive) setProducts([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [categorySlug, excludeId]);

  if (!loading && products.length === 0) return null;

  return (
    <section aria-labelledby="related-products" className="mt-10">
      <h2 id="related-products" className="mb-4 text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
        {title}
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="aspect-[4/5] animate-pulse rounded-[var(--radius-xl)] bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} size="sm" />
          ))}
        </div>
      )}
    </section>
  );
}
