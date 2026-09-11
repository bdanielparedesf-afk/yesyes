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
    <div className="min-h-screen bg-[#FFF8FA]">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative bg-[#111111] overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="bg-[#111111] rounded-[24px] py-20 px-6 flex flex-col items-center justify-center text-center">
            <img
              src="/logo-icon.svg"
              alt="YESYES"
              className="w-[180px] h-[180px] drop-shadow-[0_0_40px_rgba(232,160,191,0.4)]"
            />
            <h1 className="text-7xl font-black text-white tracking-tighter mt-6">YESYES</h1>
            <p className="text-white/60 mt-3">🔥 Nuevos productos llegando esta semana</p>
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
          <h2 className="text-3xl font-bold text-[#4A2C3A]">Nuestras Colecciones</h2>
          <p className="text-[#4A2C3A]/60 mt-2">Descubre productos seleccionados para ti</p>
        </div>

        {/* Estado de carga */}
        {loading && (
          <div className="text-center py-12">
            <img src="/logo-icon.svg" className="w-12 h-12 animate-pulse" alt="loading" />
            <p className="mt-4 text-[#4A2C3A]/50">Cargando colecciones...</p>
          </div>
        )}

        {/* Estado de error */}
        {!loading && error && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FAD3E7]/40 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-[#E8A0BF]" />
            </div>
            <h3 className="text-lg font-semibold text-[#4A2C3A] mb-2">Error al cargar productos</h3>
            <p className="text-[#4A2C3A]/50 mb-4 max-w-md mx-auto">{error}</p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={loadCollections}
                className="inline-flex items-center px-4 py-2 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-medium rounded-full transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </button>
              <Link
                to="/admin"
                className="inline-flex items-center px-4 py-2 bg-[#FAD3E7]/40 hover:bg-[#FAD3E7]/60 text-[#4A2C3A] font-medium rounded-full transition-colors"
              >
                Ir a Admin
              </Link>
            </div>
          </div>
        )}

        {/* Estado vacío: no hay productos */}
        {!loading && !error && flatProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-[#4A2C3A]/50 mb-4">No hay productos para mostrar</p>
            <p className="text-sm text-[#4A2C3A]/40 mb-6">
              Los productos pueden estar importados pero con status != PUBLISHED o la API no está respondiendo.
            </p>
            <Link
              to="/admin"
              className="inline-flex items-center px-6 py-3 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-medium rounded-full transition-colors"
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
          <motion.div whileHover={{ y: -4 }} className="flex items-center space-x-4 bg-white p-6 rounded-[24px] shadow-sm border border-[#FAD3E7]">
            <div className="p-3 bg-[#FAD3E7]/30 rounded-full">
              <Truck className="w-6 h-6 text-[#E8A0BF]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#4A2C3A]">Envío 15-25 días</h3>
              <p className="text-sm text-[#4A2C3A]/60">Despachado por CJdropshipping, solo donde tenga cobertura en Chile</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} className="flex items-center space-x-4 bg-white p-6 rounded-[24px] shadow-sm border border-[#FAD3E7]">
            <div className="p-3 bg-[#FAD3E7]/30 rounded-full">
              <Shield className="w-6 h-6 text-[#E8A0BF]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#4A2C3A]">Pago Seguro MP</h3>
              <p className="text-sm text-[#4A2C3A]/60">Transacciones protegidas con Mercado Pago</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} className="flex items-center space-x-4 bg-white p-6 rounded-[24px] shadow-sm border border-[#FAD3E7]">
            <div className="p-3 bg-[#FAD3E7]/30 rounded-full">
              <ShieldCheck className="w-6 h-6 text-[#E8A0BF]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#4A2C3A]">Garantía legal 6 meses</h3>
              <p className="text-sm text-[#4A2C3A]/60">Por falla de fábrica según Ley 19.496 - Escríbenos a yesyeswebsms@gmail.com</p>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
