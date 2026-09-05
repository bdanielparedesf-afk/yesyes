import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Star, Truck, Shield, ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';

const products = [
  { id: '1', name: 'Audífonos Bluetooth Pro', price: 19990, providerPrice: 12000, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop', category: 'Tecnología', stock: 25, offer: true, slug: 'audifonos-bluetooth-pro', description: 'Audífonos Bluetooth con cancelación de ruido activa, 30 horas de batería y sonido premium. Ideales para trabajo y entretenimiento.' },
  { id: '2', name: 'Reloj Inteligente Smart', price: 29990, providerPrice: 18000, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=400&h=400&fit=crop', category: 'Tecnología', stock: 15, offer: true, slug: 'reloj-inteligente-smart', description: 'Smartwatch con pantalla AMOLED, GPS integrado, monitor cardíaco y resistencia al agua. Tu compañero perfecto para el día a día.' },
  { id: '3', name: 'Zapatillas Running Air', price: 39990, providerPrice: 25000, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1606107557195-0e29a8b52368?w=400&h=400&fit=crop', category: 'Deportes', stock: 8, offer: true, slug: 'zapatillas-running-air', description: 'Zapatillas de running con amortiguación de aire, ligeras y transpirables. Diseñadas para máximo rendimiento.' },
  { id: '4', name: 'Cámara Deportiva 4K', price: 24990, providerPrice: 15000, image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop', category: 'Tecnología', stock: 20, offer: false, slug: 'camara-deportiva-4k', description: 'Cámara deportiva 4K a 60fps, resistente al agua hasta 30m, con estabilización electrónica y control por app.' },
  { id: '5', name: 'Mochila Impermeable Urban', price: 15990, providerPrice: 8000, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', category: 'Hogar', stock: 50, offer: true, slug: 'mochila-impermeable-urban', description: 'Mochila urbana impermeable con compartimento para laptop, múltiples bolsillos y diseño moderno.' },
  { id: '6', name: 'Lámpara LED Escritorio', price: 12990, providerPrice: 6500, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&h=400&fit=crop', category: 'Hogar', stock: 30, offer: true, slug: 'lampara-led-escritorio', description: 'Lámpara LED con 5 modos de luz, ajuste de brillo y temperatura. Protege tu vista mientras trabajas.' },
  { id: '7', name: 'Teclado Mecánico RGB', price: 34990, providerPrice: 22000, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400&h=400&fit=crop', category: 'Tecnología', stock: 12, offer: true, slug: 'teclado-mecanico-rgb', description: 'Teclado mecánico con switches Cherry MX, iluminación RGB personalizable y reposamuñecas ergonómico.' },
  { id: '8', name: 'Mouse Inalámbrico Ergo', price: 9990, providerPrice: 4500, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&h=400&fit=crop', category: 'Tecnología', stock: 40, offer: false, slug: 'mouse-inalambrico-ergo', description: 'Mouse ergonómico inalámbrico con sensor óptico de alta precisión y batería de larga duración.' },
  { id: '9', name: 'Soporte Monitor Ajustable', price: 18990, providerPrice: 10000, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1585792180666-f7347f490ea2?w=400&h=400&fit=crop', category: 'Tecnología', stock: 18, offer: false, slug: 'soporte-monitor-ajustable', description: 'Soporte de monitor ajustable en altura y ángulo. Compatible con monitores de 17 a 32 pulgadas.' },
  { id: '10', name: 'Botella Térmica 1L', price: 7990, providerPrice: 3500, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop', category: 'Deportes', stock: 60, offer: false, slug: 'botella-termica-1l', description: 'Botella térmica de acero inoxidable, mantiene bebidas frías 24h y calientes 12h. Sin BPA.' },
  { id: '11', name: 'Camiseta Dry-Fit Running', price: 14990, providerPrice: 7000, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=400&fit=crop', category: 'Moda', stock: 35, offer: true, slug: 'camiseta-dryfit-running', description: 'Camiseta técnica de running con tecnología Dry-Fit. Transpirable, secado rápido y ajuste cómodo.' },
  { id: '12', name: 'Power Bank 20000mAh', price: 11990, providerPrice: 6000, image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop', category: 'Tecnología', stock: 45, offer: false, slug: 'power-bank-20000mah', description: 'Cargador portátil de 20000mAh con carga rápida 18W. 2 puertos USB y 1 USB-C.' },
];

export default function ProductDetail() {
  const { slug } = useParams();
  const addItem = useCartStore((s) => s.addItem);
  const product = products.find((p) => p.slug === slug || p.id === slug);

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
                <span className="text-lg text-gray-400 line-through">${product.providerPrice.toLocaleString('es-CL')}</span>
              </div>
            </div>
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center"><Truck className="w-4 h-4 mr-1 text-primary-500" /> Envío 7-15 días</span>
              <span className="flex items-center"><Shield className="w-4 h-4 mr-1 text-primary-500" /> Garantía 30 días</span>
              <span className="flex items-center"><Star className="w-4 h-4 mr-1 text-yellow-500 fill-yellow-500" /> 4.8 (120)</span>
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
