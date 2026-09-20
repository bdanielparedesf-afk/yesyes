import { motion } from 'framer-motion';
import { PackageOpen } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import type { Product } from '@/services/products';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

// Grilla responsive: 2 columnas cómodas en móvil, intermedia en tablet y hasta
// 4 en escritorio. El skeleton replica la forma de ProductCard (aspect-[4/5]).
const GRID = 'grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4';

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  /** Indicador de refetch en background (p. ej. al cambiar de página o refocus).
   *  Cuando es true se muestra el contenido actual con un indicador sutil de
   *  actualización en la parte superior, evitando pantallas blancas. */
  paginating?: boolean;
  emptyMessage?: string;
}

export default function ProductGrid({ products, loading = false, paginating = false, emptyMessage = 'No hay productos para mostrar' }: ProductGridProps) {
  if (loading) {
    return (
      <div className={GRID} aria-busy="true" aria-label="Cargando productos">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden bg-white border border-neutral-100 rounded-[var(--radius-xl)] shadow-soft">
            <div className="aspect-[4/5] bg-neutral-100 animate-pulse" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-2/3 bg-neutral-100 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-neutral-100 rounded animate-pulse" />
              <div className="h-8 w-full bg-neutral-100 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4 bg-neutral-100 rounded-full">
          <PackageOpen className="w-6 h-6 text-neutral-400" aria-hidden />
        </div>
        <p className="text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

        // Indicador sutil de actualización en la parte superior.
  // Se muestra solo durante refetches en background (no en el loading inicial).
  const topRefreshingBar = paginating ? (
    <div className="absolute top-0 left-0 w-full h-0.5 overflow-hidden bg-neutral-100">
      <div className="h-full w-2/3 animate-pulse bg-primary-600" />
    </div>
  ) : null;

  return (
    <div className="relative">
      {topRefreshingBar}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className={GRID}
      >
        {products.map((product) => (
          <motion.div key={product.id} variants={item} transition={{ duration: 0.4, ease: 'easeOut' }}>
            <ProductCard product={product} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
