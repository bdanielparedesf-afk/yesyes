import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Truck, Shield, CreditCard, ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { getProductBySlug } from '@/services/products';
import type { Product, ProductVariant } from '@/services/products';

type GalleryProduct = {
  id?: string;
  image?: string;
  images?: Array<string | { url?: string; image?: string }>;
  productImages?: Array<string | { url?: string; image?: string }>;
};

const getGallery = (p: GalleryProduct | null): string[] => {
  try {
    const list: string[] = [];
    if (p?.image) list.push(p.image);
    if (p?.images && Array.isArray(p.images)) list.push(...p.images.map((i) => typeof i === 'string' ? i : i.url).filter((item): item is string => Boolean(item)));
    if (p?.productImages && Array.isArray(p.productImages)) list.push(...p.productImages.map((i) => typeof i === 'string' ? i : i.url || i.image).filter((item): item is string => Boolean(item)));
    return [...new Set(list)].filter(Boolean);
  } catch {
    return p?.image ? [p.image] : [];
  }
};

export default function ProductDetail() {
  const { slug } = useParams();
  const addItem = useCartStore((s) => s.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const gallery = getGallery(product);
  const [mainImage, setMainImage] = useState<string | null>(null);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    if (gallery[0]) setMainImage(gallery[0]);
  }, [product?.id]);

  useEffect(() => {
    if (!slug) return;
    getProductBySlug(slug)
      .then((p) => {
        setProduct(p);
        if (p && p.productVariants && p.productVariants.length > 0) {
          setSelectedVariant(p.productVariants[0]);
        } else {
          setSelectedVariant(null);
        }
      })
      .catch(() => toast.error('Error al cargar el producto'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Producto no encontrado</h2>
          <p className="text-gray-500">El producto que buscas no existe.</p>
          <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 transition-all">
            Ver Productos
          </Link>
        </div>
      </div>
    );
  }

  const displayPrice = selectedVariant?.finalPrice || product.price;
  const displayStock = selectedVariant?.stock ?? product.stock;

  const handleAdd = () => {
    addItem({
      id: selectedVariant ? `${product.id}::${selectedVariant.id}` : product.id,
      name: selectedVariant ? `${product.name} - ${selectedVariant.nameEs || selectedVariant.sku}` : product.name,
      price: displayPrice,
      image: mainImage || gallery[0] || product.image,
      imageHover: product.imageHover,
      stock: displayStock,
      providerPrice: product.providerPrice,
      variant: selectedVariant ? (selectedVariant.nameEs || selectedVariant.sku) : undefined,
    });
    toast.success('Producto agregado al carrito');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/productos" className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a productos
        </Link>
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
            {gallery.length ? (
              <div className="flex gap-4">
                <div className="flex flex-col gap-2">
                  {gallery.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      onClick={() => setMainImage(img)}
                      className="w-20 h-20 object-cover cursor-pointer border"
                    />
                  ))}
                </div>
                <img
                  src={mainImage || gallery[0]}
                  className="flex-1 max-h-[600px] object-contain"
                />
              </div>
            ) : (
              <img src={product.image} />
            )}
          </div>
          <div className="space-y-6">
            <div>
              <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">{product.category}</span>
              <h1 className="text-3xl font-bold text-gray-900 mt-3">{product.name}</h1>
              <div className="flex items-baseline space-x-3 mt-2">
                <span className="text-3xl font-extrabold text-primary-600">${displayPrice.toLocaleString('es-CL')}</span>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: product.description }} />

            {product.productVariants && product.productVariants.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Selecciona una opción:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {product.productVariants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition-all ${
                        selectedVariant?.id === v.id
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-300'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {v.image && <img src={v.image} alt={v.nameEs || v.sku} className="w-12 h-12 rounded-lg object-cover" />}
                      <span className="text-sm text-gray-900 text-center">{v.nameEs || v.sku}</span>
                      <span className="text-xs text-gray-500">
                        ${Number(v.finalPrice || v.price).toLocaleString('es-CL')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm text-gray-600">
              <span className="flex items-center"><Truck className="w-4 h-4 mr-2 text-primary-500" /> <b>Envío 15-25 días.</b> Despacho por CJdropshipping, solo con cobertura en Chile.</span>
              <span className="flex items-center"><CreditCard className="w-4 h-4 mr-2 text-primary-500" /> <b>Pago Seguro MP.</b> Transacciones protegidas con Mercado Pago.</span>
              <span className="flex items-center"><Shield className="w-4 h-4 mr-2 text-primary-500" /> <b>Garantía legal 6 meses.</b> Por falla de fábrica según Ley 19.496. Escríbenos a yesyeswebsms@gmail.com</span>
            </div>
            <p className="text-sm text-gray-500">Stock disponible: <span className="font-semibold text-gray-900">{displayStock} unidades</span></p>
            <button
              onClick={handleAdd}
              disabled={displayStock <= 0}
              className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Agregar al carrito</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
