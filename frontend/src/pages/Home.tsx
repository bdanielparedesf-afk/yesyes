import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Shield, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import api from '@/lib/axios';
import ProductGrid from '@/components/ProductGrid';
import type { Product } from '@/services/products';

// Producto como viene de la API /products/groups (colecciones)
interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  salePrice: number;
  compareAtPrice?: number;
  stock?: number;
  status?: string;
  isOffer?: boolean;
  imagenUrl?: string;
  imagen?: string;
  images?: string[];
  productImages?: { url: string; position: number }[];
  collection?: { name: string; slug: string } | null;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  products: ApiProduct[];
}

/**
 * Mapea un producto de la API de colecciones al tipo Product usado por ProductGrid.
 * La API devuelve `name` y `salePrice` (según el schema Prisma del backend).
 */
function mapApiProductToProduct(p: ApiProduct): Product {
  const rawImages = Array.isArray(p.productImages) ? p.productImages : [];
  // Mapea al tipo ProductImage (requiere `id`) agregando un id generado si no existe
  const images = rawImages.map((img, idx) => ({
    id: `img-${p.id}-${idx}`,
    url: img.url,
    position: img.position ?? idx,
  }));
  const PLACEHOLDER = '/placeholder.png';
  // Prioridad: productImages > images[] > imagenUrl > imagen > placeholder
  const first = images[0]?.url || (Array.isArray(p.images) && p.images[0]) || p.imagenUrl || p.imagen || PLACEHOLDER;
  const second = images[1]?.url || (Array.isArray(p.images) && p.images[1]) || first;
  return {
    id: p.id,
    name: p.name || 'Sin nombre',
    slug: p.slug,
    description: p.description || '',
    price: Number(p.salePrice || 0),
    providerPrice: 0,
    image: first,
    imageHover: second,
    category: p.collection?.name || 'General',
    stock: Number(p.stock || 0),
    offer: Boolean(p.isOffer),
    productImages: images,
    productVariants: [],
    collection: p.collection || null,
  };
}

export default function Home() {
  const [flatProducts, setFlatProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setError(null);
      setLoading(true);

      // Timeout manual para evitar carga infinita
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: la API tardó demasiado')), 10000)
      );

      // Llamada a la API con timeout de 10 segundos
      const apiPromise = api.get('/products/groups', { timeout: 10000 });
      const res: any = await Promise.race([apiPromise, timeoutPromise]);

      // LOG: respuesta cruda de /api/products/groups
      console.log('[Home] Respuesta cruda de /api/products/groups:', res.data);

      // Maneja ambos casos: { collections: [] } o directamente []
      let rawCollections: Collection[] = [];
      if (Array.isArray(res.data?.collections)) {
        rawCollections = res.data.collections;
      } else if (Array.isArray(res.data)) {
        rawCollections = res.data;
      }

      // Filtra colecciones que tengan productos
      const validCollections = rawCollections.filter(
        (c: Collection) => c.products && c.products.length > 0
      );

      // Aplana todos los productos de las colecciones para el grid unificado
      const allProducts = validCollections.flatMap((c) =>
        c.products.map(mapApiProductToProduct)
      );
      setFlatProducts(allProducts);

      console.log(`[Home] ${validCollections.length} colecciones con productos, ${allProducts.length} productos totales`);
    } catch (e: any) {
      // LOG: error completo para debugging
      const errorMessage = e?.response?.data?.message || e?.message || 'Error desconocido';
      const errorStatus = e?.response?.status;
      console.error('[Home] Error cargando colecciones:', errorMessage, '| Status:', errorStatus);
      console.error('[Home] Error completo:', e);

      // Muestra el error en pantalla, no deja blanco
      setError(errorMessage);
      setFlatProducts([]);
    } finally {
      setLoading(false);
    }
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
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Nuestras Colecciones</h2>
          <p className="text-gray-600 mt-2">Descubre productos seleccionados para ti</p>
        </div>

        {/* Estado de carga */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500">Cargando colecciones...</p>
          </div>
        )}

        {/* Estado de error */}
        {!loading && error && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Error al cargar productos</h3>
            <p className="text-gray-500 mb-4 max-w-md mx-auto">{error}</p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={loadCollections}
                className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </button>
              <Link
                to="/admin"
                className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Ir a Admin
              </Link>
            </div>
          </div>
        )}

        {/* Estado vacío: no hay productos */}
        {!loading && !error && flatProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-gray-500 mb-4">No hay productos para mostrar</p>
            <p className="text-sm text-gray-400 mb-6">
              Los productos pueden estar importados pero con status != PUBLISHED o la API no está respondiendo.
            </p>
            <Link
              to="/admin"
              className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              Ir a Admin
            </Link>
          </div>
        )}

        {/* Productos cargados: usa el mismo ProductGrid que Products.tsx */}
        {!loading && !error && flatProducts.length > 0 && (
          <ProductGrid products={flatProducts} />
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
              <h3 className="font-semibold text-gray-900">Envío 15-25 días</h3>
              <p className="text-sm text-gray-500">Despachado por CJdropshipping, solo donde tenga cobertura en Chile</p>
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
              <ShieldCheck className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Garantía legal 6 meses</h3>
              <p className="text-sm text-gray-500">Por falla de fábrica según Ley 19.496 - Escríbenos a yesyeswebsms@gmail.com</p>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
