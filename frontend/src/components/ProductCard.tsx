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

  const sizeClasses = {
    sm: 'aspect-[3/4]',
    md: 'aspect-[4/5]',
    lg: 'aspect-[3/4]',
  };

  return (
    <Link to={`/productos/${product.slug}`} className="group block">
      <div className="bg-white rounded-[var(--radius-xl)] shadow-sm group-hover:shadow-[var(--shadow-float-hover)] transition-all duration-300 overflow-hidden border border-neutral-100">
        <div className={`relative ${sizeClasses[size]} overflow-hidden bg-neutral-50`}>
          {product.image && (
            <>
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover object-center group-hover:opacity-0 transition-opacity duration-500"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo-icon.svg'; }}
              />
              <img
                src={product.imageHover || product.image}
                alt={product.name}
                className="w-full h-full object-cover object-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 absolute inset-0"
                loading="lazy"
              />
            </>
          )}
          {discountPercent > 0 && (
            <span className="absolute top-3 left-3 bg-accent-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
              -{discountPercent}%
            </span>
          )}
          {isOutOfStock && (
            <span className="absolute top-3 right-3 bg-neutral-800/80 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
              Agotado
            </span>
          )}
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{product.category}</p>
          <h3 className="font-semibold text-neutral-900 text-sm line-clamp-2 group-hover:text-primary-700 transition-colors leading-tight">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-neutral-900">${product.price.toLocaleString('es-CL')}</span>
            {hasDiscount && (
              <span className="text-sm text-neutral-500 line-through">
                ${product.providerPrice.toLocaleString('es-CL')}
              </span>
            )}
          </div>
          <button
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            className={`w-full mt-2 py-2 text-sm font-semibold rounded-full transition-all ${
              isOutOfStock
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-primary-700 hover:bg-primary-800 text-white shadow-md hover:shadow-lg'
            }`}
          >
            {isOutOfStock ? 'Sin stock' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    </Link>
  );
}
