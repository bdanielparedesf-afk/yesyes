import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { useHomeData } from '@/hooks/useProductsQuery';
import ProductGrid from '@/components/ProductGrid';
import type { Product } from '@/services/products';

function Hero() {
  return (
    <section className="relative bg-neutral-900 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-primary-800/30 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[360px] w-[360px] rounded-full bg-gradient-to-tr from-accent-600/20 to-transparent blur-3xl" />
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
              className="inline-flex items-center px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-full shadow-lg shadow-primary-600/30 transition-all hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
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

function SectionHeading({ title, link, linkText }: { title: string; link?: string; linkText?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <span className="block text-[11px] font-semibold text-primary-600 uppercase tracking-[0.2em] mb-1">YesYes</span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">{title}</h2>
      </div>
      {link && linkText && (
        <Link
          to={link}
          className="group flex-shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors"
        >
          {linkText}
          <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}

interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  productCount: number;
}

function CategoryGrid({ categories }: { categories: HomeCategory[] }) {
  if (!categories.length) return null;
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Categorías" link="/productos" linkText="Ver todas" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/categoria/${cat.slug}`}
              className="group relative flex flex-col items-center text-center bg-white rounded-xl p-4 sm:p-5 shadow-soft border border-neutral-100 hover:shadow-float-hover hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-primary-50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 mb-2 bg-primary-100 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-neutral-50">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-12 h-12 rounded-full object-cover object-center group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </div>
              <p className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors line-clamp-1">
                {cat.name}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">{cat.productCount} productos</p>
            </Link>
          ))}
        </div>
            </div>
    </section>
  );
}

export default function Home() {
  // React Query maneja fetching, cache, background refetch.
  // El Hero se renderiza inmediatamente sin esperar estos datos.
  // HOME SIMPLIFICADO: se muestra Hero + Categorías + "Lo último".
  // Se eliminan Destacados/Ofertas/por-categoría. No se toca el endpoint.
  const { data, isLoading, refetch } = useHomeData();

  // Cada sección se renderiza de forma independiente.
  // Mientras isLoading sea true, cada sección muestra su propio skeleton.
  // Una vez que isLoading es false, se muestran los datos reales o estado de error.
  const renderProductSection = (
    title: string,
    products: Product[] | undefined,
    link?: string,
    linkText?: string,
  ) => {
    // Si hay datos disponibles, mostrarlos inmediatamente (even during background refetch).
    // Esto permite que secciones con datos listos se rendericen sin esperar a otras.
    if (products && products.length > 0) {
      return (
        <section className="py-10 border-t border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading title={title} link={link} linkText={linkText} />
            <ProductGrid products={products} />
          </div>
        </section>
      );
    }
    // Primer fetch sin datos aún → skeleton
    if (isLoading) {
      return (
        <section className="py-10 border-t border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading title={title} />
            <ProductGrid products={[]} loading />
          </div>
        </section>
      );
    }
    // Error o sin productos
    return (
      <section className="py-10 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title={title} />
          <div className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm mb-4">No se pudieron cargar los productos</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-full transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        </div>
      </section>
    );
  };

  // El estado de error se maneja a nivel de la sección "Lo último".

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Hero: siempre visible, no espera la API ── */}
      <Hero />

      {/* ── Categorías (navegación por categoría, no duplica productos) ── */}
      <CategoryGrid categories={data?.categories ?? []} />

      {/* ── Lo último (sección existente, sin cambios de lógica/datos) ── */}
      {renderProductSection(
        'Lo último',
        data?.uncategorized,
        '/productos',
        'Ver todos',
      )}

      {/* ── Trust badges: siempre visibles, no dependen de datos ── */}
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
