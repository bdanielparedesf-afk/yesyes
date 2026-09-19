import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { getHomeData } from '@/services/products';
import ProductGrid from '@/components/ProductGrid';
import type { Product } from '@/services/products';

interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  productCount: number;
}

interface HomeData {
  categories: HomeCategory[];
  featured: Product[];
  latest: Product[];
  offers: Product[];
  byCategory: Record<string, Product[]>;
  uncategorized: Product[];
}

function Hero() {
  return (
    <section className="relative bg-neutral-900 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/40 via-primary-800/30 to-transparent" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-6"
          >
            YESYES
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-lg text-neutral-200 mb-8 max-w-lg leading-relaxed"
          >
            Tu marketplace moderno. Descubre productos novedosos con envíos a todo Chile.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <Link
              to="/productos"
              className="inline-flex items-center px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-full shadow-lg shadow-primary-600/30 transition-all hover:shadow-xl"
            >
              Ver productos
            </Link>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute right-0 top-0 w-1/3 h-full hidden lg:block"
        >
          <img src="/logo-icon.svg" alt="YESYES" className="w-full h-full object-contain opacity-20" />
        </motion.div>
      </div>
    </section>
  );
}

function CategoryGrid({ categories }: { categories: HomeCategory[] }) {
  if (!categories.length) return null;
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-neutral-900">Categorías</h2>
          <Link to="/productos" className="text-sm font-medium text-primary-700 hover:underline">
            Ver todas →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/categoria/${cat.slug}`}
              className="group bg-white rounded-xl p-4 text-center shadow-sm border border-neutral-100 hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 mx-auto mb-2 bg-primary-100 rounded-full flex-shrink-0 flex items-center justify-center">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </div>
              <p className="text-sm font-medium text-neutral-800 group-hover:text-primary-700 transition-colors">
                {cat.name}
              </p>
              <p className="text-xs text-neutral-500">{cat.productCount} productos</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductSection({
  title, products, link, linkText,
}: { title: string; products: Product[]; link?: string; linkText?: string }) {
  if (!products.length) return null;
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
          {link && linkText && (
            <Link to={link} className="text-sm font-medium text-primary-700 hover:underline">
              {linkText} →
            </Link>
          )}
        </div>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadHome();
  }, []);

  async function loadHome() {
    try {
      setError(null);
      const result = await getHomeData();
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Error al cargar la tienda');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="h-96 bg-neutral-200 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-12">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-neutral-200 animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-neutral-200 animate-pulse rounded-[var(--radius-xl)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">Error al cargar la tienda</h3>
          <p className="text-neutral-500">{error}</p>
          <button
            onClick={loadHome}
            className="inline-flex items-center px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-full transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Hero />

      {data && <CategoryGrid categories={data.categories} />}

      {data && <ProductSection
        title="Productos destacados"
        products={data.featured}
        link="/productos"
        linkText="Ver todos"
      />}

      {data && <ProductSection
        title="Nuevos productos"
        products={data.latest}
        link="/productos"
        linkText="Ver nuevos"
      />}

      {data && <ProductSection
        title="Ofertas"
        products={data.offers}
        link="/ofertas"
        linkText="Ver ofertas"
      />}

      {data && Object.entries(data.byCategory).map(([slug, products]) => {
        if (!products.length) return null;
        const category = data.categories.find((c) => c.slug === slug);
        return (
          <ProductSection
            key={slug}
            title={category ? category.name : slug}
            products={products}
            link={`/categoria/${slug}`}
            linkText="Ver categoría"
          />
        );
      })}

      {/* Products not in any collection but published */}
      {data && data.uncategorized.length > 0 && (
        <ProductSection
          title="Lo último"
          products={data.uncategorized}
          link="/productos"
          linkText="Ver todos"
        />
      )}

      {/* Trust badges */}
      <section className="py-12 border-t border-neutral-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-neutral-100">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-primary-700" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Envío a todo Chile</p>
                <p className="text-sm text-neutral-500">15-25 días hábiles, despacho CJ Dropshipping</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-neutral-100">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-primary-700" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Pago seguro con Mercado Pago</p>
                <p className="text-sm text-neutral-500">Transacciones 100% protegidas</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-neutral-100">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-primary-700" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Garantía legal 6 meses</p>
                <p className="text-sm text-neutral-500">Por falla de fábrica (Ley 19.496)</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
