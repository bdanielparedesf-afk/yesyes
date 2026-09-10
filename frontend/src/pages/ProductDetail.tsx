import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Truck, Shield, CreditCard, ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { getProductBySlug } from '@/services/products';
import type { Product } from '@/services/products';

export default function ProductDetail() {
  const { slug } = useParams();
  const addItem = useCartStore((s) => s.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getProductBySlug(slug)
      .then(setProduct)
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

  const handleAdd = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      imageHover: product.imageHover,
      stock: product.stock,
      providerPrice: product.providerPrice,
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="relative aspect-square">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              {product.offer && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                  -20% OFERTA
                </span>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">{product.category}</span>
              <h1 className="text-3xl font-bold text-gray-900 mt-3">{product.name}</h1>
              <div className="flex items-baseline space-x-3 mt-2">
                <span className="text-3xl font-extrabold text-primary-600">${product.price.toLocaleString('es-CL')}</span>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: product.description }} />
            <div className="flex flex-col gap-3 text-sm text-gray-600">
              <span className="flex items-center"><Truck className="w-4 h-4 mr-2 text-primary-500" /> <b>Envío 15-25 días.</b> Despacho por CJdropshipping, solo con cobertura en Chile.</span>
              <span className="flex items-center"><CreditCard className="w-4 h-4 mr-2 text-primary-500" /> <b>Pago Seguro MP.</b> Transacciones protegidas con Mercado Pago.</span>
              <span className="flex items-center"><Shield className="w-4 h-4 mr-2 text-primary-500" /> <b>Garantía legal 6 meses.</b> Por falla de fábrica según Ley 19.496. Escríbenos a yesyeswebsms@gmail.com</span>
            </div>
            <p className="text-sm text-gray-500">Stock disponible: <span className="font-semibold text-gray-900">{product.stock} unidades</span></p>
            <button onClick={handleAdd} className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all">
              <ShoppingCart className="w-5 h-5" />
              <span>Agregar al carrito</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
