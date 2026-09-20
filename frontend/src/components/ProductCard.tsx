import { Link } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import type { Product } from '@/services/products';

interface ProductCardProps {
  product: Product;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProductCard({ product, size = 'md' }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      imageHover: product.imageHover,
      stock: product.stock,
      providerPrice: product.providerPrice,
    });
    toast.success('Agregado al carrito');
  };

  const hasDiscount = product.compareAtPrice > 0 && product.price < product.compareAtPrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;
  const isOutOfStock = product.stock <= 0;
  const lowStock = !isOutOfStock && product.stock <= 5;

  // ProporciÃ³n consistente en todos los tamaÃ±os: evita alturas desiguales en la grilla.
  const sizeClasses = {
    sm: 'aspect-[4/5]',
    md: 'aspect-[4/5]',
    lg: 'aspect-[4/5]',
  };

  return (
    <Link
      to={`/productos/${product.slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-[var(--radius-xl)]"
      aria-label={product.name}
    >
      <div className="relative flex h-full flex-col bg-white rounded-[var(--radius-xl)] shadow-soft group-hover:shadow-float-hover group-hover:-translate-y-1 transition-all duration-300 ease-out overflow-hidden border border-neutral-100">
        <div className={`relative ${sizeClasses[size]} overflow-hidden bg-neutral-50`}>
          {product.image && (
            <>
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover object-center group-hover:opacity-0 transition-opacity duration-500"
                loading="lazy"
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo-icon.svg'; }}
              />
              <img
                src={product.imageHover || product.image}
                alt=""
                aria-hidden
                className="w-full h-full object-cover object-center scale-[1.02] group-hover:scale-105 opacity-0 group-hover:opacity-100 transition-all duration-500 absolute inset-0"
                loading="lazy"
                decoding="async"
              />
            </>
          )}
          {discountPercent > 0 && (
            <span className="absolute top-3 left-3 bg-accent-600 text-white text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full shadow-md">
              -{discountPercent}% OFF
            </span>
          )}
          {isOutOfStock && (
            <span className="absolute top-3 right-3 bg-neutral-800/80 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
              Agotado
            </span>
          )}
          {lowStock && (
            <span className="absolute top-3 right-3 bg-amber-500/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
              Â¡Ãšltimas {product.stock}!
            </span>
          )}
        </div>

        <div className="flex flex-col flex-1 p-4 sm:p-5">
          {product.category && (
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">{product.category}</p>
          )}
          <h3 className="mt-1 font-semibold text-neutral-900 text-sm line-clamp-2 leading-snug group-hover:text-primary-700 transition-colors">
            {product.name}
          </h3>
          <div className="mt-auto pt-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-lg font-extrabold tracking-tight text-neutral-900">
                ${product.price.toLocaleString('es-CL')}
              </span>
              {hasDiscount && (
                <span className="text-sm text-neutral-400 line-through">
                  ${product.compareAtPrice.toLocaleString('es-CL')}
                </span>
              )}
            </div>
            <button
              onClick={handleQuickAdd}
              disabled={isOutOfStock}
              aria-label={`Agregar ${product.name} al carrito`}
              className={`w-full mt-3 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 active:scale-[0.98] ${!isOutOfStock ? 'sm:opacity-90 sm:group-hover:opacity-100' : ''} ${
                isOutOfStock
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : 'bg-primary-700 hover:bg-primary-800 text-white shadow-sm hover:shadow-md'
              }`}
            >
              {isOutOfStock ? 'Sin stock' : 'Agregar al carrito'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

