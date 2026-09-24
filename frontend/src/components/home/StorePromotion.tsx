import { Link } from 'react-router-dom';
import { ArrowRight, PackageOpen, ShoppingBag } from 'lucide-react';
import type { Product } from '@/services/products';

interface StorePromotionProps {
  products: Product[];
  loading?: boolean;
}

export default function StorePromotion({ products, loading = false }: StorePromotionProps) {
  const samples = products.filter((product) => product.image).slice(0, 3);

  return (
    <section className="bg-gradient-to-br from-accent-50 via-white to-primary-50 py-16 sm:py-20" aria-labelledby="store-title">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-700" aria-hidden><ShoppingBag className="h-6 w-6" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.22em] text-accent-700">Tienda YesYes</p>
          <h2 id="store-title" className="mt-2 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">Descubre productos que hacen tu día más fácil</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600">Explora nuestra selección de productos y encuentra algo que te guste.</p>
          <Link to="/productos" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-neutral-950 px-7 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">Explorar productos<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute inset-8 rounded-full bg-accent-200/50 blur-3xl" aria-hidden />
          {loading ? (
            <div className="relative grid grid-cols-2 gap-4" aria-label="Cargando productos destacados" aria-busy="true">
              {[0, 1, 2].map((item) => <div key={item} className="aspect-square animate-pulse rounded-3xl border border-neutral-200 bg-white" />)}
            </div>
          ) : samples.length ? (
            <div className="relative grid grid-cols-2 gap-4">
              {samples.map((product, index) => (
                <Link key={product.id} to={`/productos/${product.slug}`} className={`group relative overflow-hidden rounded-3xl border border-white bg-white shadow-float transition hover:-translate-y-1 ${index === 0 ? 'col-span-2 mx-auto w-2/3' : ''}`} aria-label={`Ver ${product.name}`}>
                  <img src={product.image} alt={product.name} className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="relative flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-white/80 p-8 text-center">
              <PackageOpen className="h-10 w-10 text-neutral-300" aria-hidden />
              <p className="mt-3 font-semibold text-neutral-700">Conoce todos nuestros productos</p>
              <p className="mt-1 text-sm text-neutral-500">La selección estará disponible muy pronto.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
