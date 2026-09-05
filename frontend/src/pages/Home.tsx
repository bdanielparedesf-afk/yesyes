import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Shield, Headphones } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';

const categories = [
  { name: 'Tecnología', icon: '💻' },
  { name: 'Hogar', icon: '🏠' },
  { name: 'Moda', icon: '👕' },
  { name: 'Belleza', icon: '✨' },
  { name: 'Juguetes', icon: '🎮' },
  { name: 'Deportes', icon: '⚽' },
];

const featuredProducts = [
  { id: '1', name: 'Audífonos Bluetooth Pro', price: 19990, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', discount: 20, slug: 'audifonos-bluetooth-pro' },
  { id: '2', name: 'Reloj Inteligente Smart', price: 29990, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', discount: 15, slug: 'reloj-inteligente-smart' },
  { id: '3', name: 'Zapatillas Running Air', price: 39990, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', discount: 25, slug: 'zapatillas-running-air' },
  { id: '4', name: 'Cámara Deportiva 4K', price: 24990, image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop', discount: 10, slug: 'camara-deportiva-4k' },
  { id: '5', name: 'Mochila Impermeable Urban', price: 15990, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', discount: 30, slug: 'mochila-impermeable-urban' },
  { id: '6', name: 'Lámpara LED Escritorio', price: 12990, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&h=400&fit=crop', discount: 20, slug: 'lampara-led-escritorio' },
  { id: '7', name: 'Teclado Mecánico RGB', price: 34990, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop', discount: 15, slug: 'teclado-mecanico-rgb' },
  { id: '8', name: 'Mouse Inalámbrico Ergo', price: 9990, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop', discount: 20, slug: 'mouse-inalambrico-ergo' },
];

const newProducts = [
  { id: '9', name: 'Soporte Monitor Ajustable', price: 18990, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop', slug: 'soporte-monitor-ajustable' },
  { id: '10', name: 'Botella Térmica 1L', price: 7990, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop', slug: 'botella-termica-1l' },
  { id: '11', name: 'Camiseta Dry-Fit Running', price: 14990, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', slug: 'camiseta-dryfit-running' },
  { id: '12', name: 'Power Bank 20000mAh', price: 11990, image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop', slug: 'power-bank-20000mah' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = (product: typeof featuredProducts[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      stock: 10,
    });
    toast.success('Producto agregado al carrito');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative bg-gradient-to-b from-white to-gray-100 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
                Bienvenido a <span className="text-primary-500">YESYES</span>
              </h1>
              <p className="text-lg text-gray-600 max-w-lg">
                Tu tienda online favorita con los mejores productos al mejor precio. Envíos a todo Chile y pagos seguros.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 transition-all">
                  Ver Productos
                </Link>
                <Link to="/ofertas" className="inline-flex items-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-semibold rounded-lg shadow-sm transition-all">
                  Ofertas
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative"
            >
              <img
                src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=600&fit=crop"
                alt="Productos ecommerce"
                className="rounded-2xl shadow-2xl w-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Categorías</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {categories.map((cat) => (
            <motion.div key={cat.name} variants={item}>
              <Link to={`/categoria/${cat.name}`} className="group block">
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center border border-gray-100">
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{cat.icon}</div>
                  <p className="font-semibold text-gray-800 text-sm">{cat.name}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Productos Destacados</h2>
            <p className="text-gray-500 mt-2">Los más vendidos de la semana</p>
          </div>
          <Link to="/productos" className="text-primary-500 hover:text-primary-600 font-semibold text-sm">
            Ver todos →
          </Link>
        </div>
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <motion.div key={product.id} variants={item} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden group">
              <div className="relative overflow-hidden aspect-square">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                {product.discount > 0 && (
                  <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    -{product.discount}%
                  </span>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-gray-800 line-clamp-2">{product.name}</h3>
                <p className="text-lg font-bold text-primary-600">${product.price.toLocaleString('es-CL')}</p>
                <button onClick={() => handleAdd(product)} className="w-full mt-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Agregar al carrito
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Nuevos Productos</h2>
            <p className="text-gray-500 mt-2">Recién llegados a nuestra tienda</p>
          </div>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
          {newProducts.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -5 }}
              className="min-w-[260px] snap-start bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden"
            >
              <div className="aspect-square overflow-hidden">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-semibold text-gray-800 text-sm">{product.name}</h3>
                <p className="text-primary-600 font-bold">${product.price.toLocaleString('es-CL')}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div whileHover={{ y: -4 }} className="flex items-center space-x-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="p-3 bg-primary-50 rounded-full">
              <Truck className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Envío 7-15 días</h3>
              <p className="text-sm text-gray-500">A todo Chile por correo certificado</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} className="flex items-center space-x-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="p-3 bg-primary-50 rounded-full">
              <Shield className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Pago Seguro MP</h3>
              <p className="text-sm text-gray-500">Transacciones protegidas con Mercado Pago</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} className="flex items-center space-x-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="p-3 bg-primary-50 rounded-full">
              <Headphones className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Garantía</h3>
              <p className="text-sm text-gray-500">30 días de garantía en todos los productos</p>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
