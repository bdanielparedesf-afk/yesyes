import { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getProducts } from '@/services/products';
import type { Product } from '@/services/products';
import ProductGrid from '@/components/ProductGrid';

const categories = ['Todos', 'Tecnología', 'Hogar', 'Moda', 'Belleza', 'Juguetes', 'Deportes'];

export default function Products() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [maxPrice, setMaxPrice] = useState(50000);
  const [stockOnly, setStockOnly] = useState(false);
  const [offerOnly, setOfferOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { nombre, slug } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(data))
      .catch(() => console.error('Error al cargar productos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const catFromUrl = nombre || slug || searchParams.get('category');
    if (catFromUrl && categories.includes(catFromUrl)) {
      setCategory(catFromUrl);
    }
    const filter = searchParams.get('filter');
    if (filter === 'ofertas') {
      setOfferOnly(true);
    }
  }, [nombre, slug, searchParams]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'Todos' || p.category === category;
      const matchesPrice = p.price <= maxPrice;
      const matchesStock = !stockOnly || p.stock > 0;
      const matchesOffer = !offerOnly || p.offer;
      return matchesSearch && matchesCategory && matchesPrice && matchesStock && matchesOffer;
    });
  }, [products, search, category, maxPrice, stockOnly, offerOnly]);

  return (
    <div className="min-h-screen bg-[#FFF8FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[#4A2C3A]">
            {offerOnly ? 'Ofertas' : category !== 'Todos' ? category : 'Productos'}
          </h1>
          <button
            className="lg:hidden flex items-center space-x-2 px-4 py-2 bg-white border border-[#FAD3E7] rounded-full"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span>Filtros</span>
          </button>
        </div>

        <div className="flex gap-8">
          <aside className={`${sidebarOpen ? 'fixed inset-0 z-50 bg-white p-6 overflow-auto' : 'hidden'} lg:block lg:w-64 flex-shrink-0`}>
            {sidebarOpen && (
              <button className="absolute top-4 right-4" onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            )}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-[#4A2C3A] mb-3">Categoría</h3>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        checked={category === cat}
                        onChange={() => setCategory(cat)}
                        className="text-[#E8A0BF] focus:ring-[#E8A0BF]"
                      />
                      <span className="text-sm text-[#4A2C3A]/80">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#4A2C3A] mb-3">Precio máximo: ${maxPrice.toLocaleString('es-CL')}</h3>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="1000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-[#E8A0BF]"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stockOnly}
                    onChange={(e) => setStockOnly(e.target.checked)}
                    className="rounded text-[#E8A0BF] focus:ring-[#E8A0BF]"
                  />
                  <span className="text-sm text-[#4A2C3A]/80">Solo con stock</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offerOnly}
                    onChange={(e) => setOfferOnly(e.target.checked)}
                    className="rounded text-[#E8A0BF] focus:ring-[#E8A0BF]"
                  />
                  <span className="text-sm text-[#4A2C3A]/80">Solo ofertas</span>
                </label>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A2C3A]/50" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:border-transparent"
              />
            </div>

            <ProductGrid products={filtered} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}
