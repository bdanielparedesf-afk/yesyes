import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Shield, Headphones, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface ProductImage {
  url: string;
  position: number;
}

interface CollectionProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  salePrice: number;
  compareAtPrice?: number;
  productImages: ProductImage[];
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  image: string;
  products: CollectionProduct[];
}

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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const res = await axios.get('/api/products/groups');
      const data = res.data.collections.filter((c: Collection) => c.products.length > 0);
      setCollections(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (product: CollectionProduct) => {
    addItem({
      id: product.id,
      name: product.name,
      price: Number(product.salePrice),
      image: product.productImages[0]?.url || '',
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
                Nuevos productos llegando esta semana 🔥
              </h1>
              <p className="text-lg text-gray-600 max-w-lg">
                Envío a todo Chile. Los mejores precios en tecnología, hogar, belleza y más.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 transition-all">
                  Ver Productos
                </Link>
                <a href="#colecciones" className="inline-flex items-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-semibold rounded-lg shadow-sm transition-all">
                  Explorar
                </a>
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
        id="colecciones"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-500">Cargando productos...</p>
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">Próximamente nuevos productos en nuestra tienda</p>
          </div>
        ) : (
          collections.map((col) => (
            <motion.div key={col.id} variants={item} className="mb-16">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{col.name}</h2>
                  <p className="text-gray-500 mt-1">
                    {col.products.length} producto{col.products.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Link
                  to={`/productos?collection=${col.slug}`}
                  className="hidden sm:flex items-center text-primary-500 hover:text-primary-600 font-medium text-sm"
                >
                  Ver todos <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {col.products.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={item}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden group"
                  >
                    <Link to={`/productos/${product.slug}`}>
                      <div className="relative overflow-hidden aspect-square">
                        <img
                          src={product.productImages[0]?.url || 'https://via.placeholder.com/400'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.salePrice) && (
                          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            -{Math.round((1 - Number(product.salePrice) / Number(product.compareAtPrice)) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="font-semibold text-gray-800 line-clamp-2">{product.name}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-primary-600">
                            ${Number(product.salePrice).toLocaleString('es-CL')}
                          </p>
                          {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.salePrice) && (
                            <p className="text-sm text-gray-400 line-through">
                              ${Number(product.compareAtPrice).toLocaleString('es-CL')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); handleAdd(product); }}
                          className="w-full mt-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Agregar al carrito
                        </button>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))
        )}
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
