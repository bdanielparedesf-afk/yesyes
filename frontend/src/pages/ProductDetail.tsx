import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Truck, Shield, CreditCard, ChevronRight, Check } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { getProductBySlug } from '@/services/products';
import type { Product, ProductVariant } from '@/services/products';

const getGallery = (p: Product | null): string[] => {
  const list: string[] = [];
  if (p?.image) list.push(p.image);
  if (Array.isArray(p?.productImages)) {
    p.productImages.forEach((img) => { if (img.url) list.push(img.url); });
  }
  return [...new Set(list)].filter(Boolean);
};

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const gallery = getGallery(product);

  useEffect(() => {
    if (gallery[0]) setMainImage(gallery[0]);
  }, [product?.id]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getProductBySlug(slug)
      .then((p) => {
        setProduct(p);
        const variants = p?.productVariants || [];
        if (variants.length > 0) {
          setSelectedVariant(variants[0]);
        } else {
          setSelectedVariant(null);
        }
      })
      .catch(() => toast.error('Error al cargar el producto'))
      .finally(() => setLoading(false));
  }, [slug]);

  const displayPrice = selectedVariant?.finalPrice || product?.price || 0;
  const displayStock = selectedVariant?.stock ?? product?.stock ?? 0;

  const handleAdd = () => {
    if (!product) return;
    const stockLimit = displayStock;
    if (quantity > stockLimit) {
      toast.error(`Solo quedan ${stockLimit} unidades disponibles`);
      return;
    }
    addItem({
      id: selectedVariant ? `${product.id}::${selectedVariant.id}` : product.id,
      name: selectedVariant ? `${product.name} - ${selectedVariant.nameEs || selectedVariant.sku}` : product.name,
      price: displayPrice,
      image: mainImage || product.image,
      imageHover: product.imageHover,
      stock: stockLimit,
      providerPrice: product.providerPrice,
      variant: selectedVariant ? (selectedVariant.nameEs || selectedVariant.sku) : undefined,
    });
    toast.success('Producto agregado al carrito');
  };

  const handleBuyNow = () => {
    handleAdd();
    navigate('/checkout');
  };

  const decrement = () => setQuantity(Math.max(1, quantity - 1));
  const increment = () => setQuantity(Math.min(displayStock, quantity + 1));

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-500">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold text-neutral-900">Producto no encontrado</h2>
          <p className="text-neutral-500">El producto que buscas no existe.</p>
          <Link
            to="/productos"
            className="inline-flex items-center px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-full transition-colors"
          >
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  const hasDiscount = product.compareAtPrice > 0 && displayPrice < product.compareAtPrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice - displayPrice) / product.compareAtPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
          <Link to="/" className="hover:text-neutral-900">Inicio</Link>
          <ChevronRight className="w-4 h-4" />
          {product.category !== 'General' && (
            <>
            </>
          )}
          <Link to={`/categoria/${product.categorySlug || 'general'}`} className="hover:text-neutral-900">{product.category}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-neutral-900 truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="bg-white rounded-[var(--radius-xl)] shadow-sm border border-neutral-100 p-4 min-h-[400px] flex items-center justify-center">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  className="max-w-full max-h-[600px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logo-icon.svg'; }}
                />
              ) : (
                <div className="w-full h-64 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <span className="text-neutral-400">Sin imagen</span>
                </div>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMainImage(img)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden ${
                      mainImage === img ? 'border-primary-600' : 'border-neutral-200'
                    }`}
                  >
                    <img src={img} alt={`Vista ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-6">
            <div>
              <Link
                to={`/categoria/${product.categorySlug || 'general'}`}
                className="text-xs font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full inline-block mb-2"
              >
                {product.category}
              </Link>
              <h1 className="text-2xl lg:text-3xl font-bold text-neutral-900 mb-4">{product.name}</h1>

              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-2xl font-bold text-neutral-900">
                  ${displayPrice.toLocaleString('es-CL')}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-lg text-neutral-400 line-through">
                      ${product.compareAtPrice.toLocaleString('es-CL')}
                    </span>
                    <span className="text-lg font-semibold text-accent-600">-{discountPercent}%</span>
                  </>
                )}
              </div>

              {displayStock > 0 && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  En stock ({displayStock} unidades)
                </p>
              )}
              {displayStock === 0 && (
                <p className="text-sm text-red-500">Sin stock disponible</p>
              )}
            </div>

            {/* Variants */}
            {product.productVariants && product.productVariants.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-neutral-700">Selecciona una opción:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {product.productVariants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition-all ${
                        selectedVariant?.id === v.id
                          ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      {v.image && <img src={v.image} alt={v.nameEs || v.sku} className="w-10 h-10 rounded-lg object-cover" />}
                      <span className="text-sm text-neutral-800 text-center">
                        {v.nameEs || v.name || v.sku}
                      </span>
                      <span className="text-xs text-neutral-500">
                        ${Number(v.finalPrice || v.price).toLocaleString('es-CL')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            {displayStock > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">Cantidad</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={decrement}
                    disabled={quantity <= 1}
                    className="w-10 h-10 border border-neutral-200 rounded-full flex items-center justify-center text-neutral-600 hover:border-neutral-300 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-lg font-medium w-8 text-center">{quantity}</span>
                  <button
                    onClick={increment}
                    disabled={quantity >= displayStock}
                    className="w-10 h-10 border border-neutral-200 rounded-full flex items-center justify-center text-neutral-600 hover:border-neutral-300 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-2">
              <button
                onClick={handleAdd}
                disabled={displayStock <= 0}
                className="flex-1 py-3 px-6 bg-primary-700 hover:bg-primary-800 disabled:bg-neutral-300 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Agregar al carrito
              </button>
              <button
                onClick={handleBuyNow}
                disabled={displayStock <= 0}
                className="flex-1 py-3 px-6 border border-neutral-200 hover:border-primary-700 text-neutral-900 font-semibold rounded-full transition-all"
              >
                Comprar ahora
              </button>
            </div>

            {/* Info */}
            <div className="border-t border-neutral-200 pt-6 space-y-3 text-sm text-neutral-600">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-primary-700" />
                <span><b>Envío</b> 15-25 días hábiles a todo Chile. Despacho CJ Dropshipping.</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary-700" />
                <span><b>Garantía legal</b> 6 meses por falla de fábrica (Ley 19.496).</span>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-primary-700" />
                <span><b>Pago seguro</b> con Mercado Pago.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product description */}
        <div className="mt-12 bg-white rounded-[var(--radius-xl)] shadow-sm border border-neutral-100 p-6 lg:p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Descripción del producto</h2>
          {product.description ? (
            <div
              className="prose prose-sm max-w-none text-neutral-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <p className="text-neutral-500">Sin descripción disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}
