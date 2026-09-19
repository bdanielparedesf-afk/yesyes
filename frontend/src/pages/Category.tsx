import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getProductsByCategory } from '@/services/products';
import ProductGrid from '@/components/ProductGrid';
import type { Product } from '@/services/products';

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Más nuevos' },
  { value: 'createdAt:asc', label: 'Más viejos' },
  { value: 'salePrice:desc', label: 'Precio mayor' },
  { value: 'salePrice:asc', label: 'Precio menor' },
];

export default function Category() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const urlSort = searchParams.get('sort') || 'createdAt:desc';

  const [category, setCategory] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(urlSearch);
  const [sortBy, setSortBy] = useState(urlSort.split(':')[0]);
  const [sortDir, setSortDir] = useState(urlSort.split(':')[1] || 'desc');

  useEffect(() => {
    if (!slug) return;
    void loadCategory(slug);
  }, [slug]);

  async function loadCategory(slug: string) {
    try {
      setError(null);
      const { category: cat, products } = await getProductsByCategory(slug);
      setCategory(cat);
      setAllProducts(products);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Error al cargar la categoría');
      setCategory(null);
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = [...allProducts];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'salePrice') {
        return sortDir === 'asc' ? a.price - b.price : b.price - a.price;
      }
      if (sortBy === 'name') {
        return sortDir === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return sortDir === 'asc'
        ? new Date(a.id).getTime() - new Date(b.id).getTime()
        : new Date(b.id).getTime() - new Date(a.id).getTime();
    });
    return result;
  }, [allProducts, search, sortBy, sortDir]);

  const sortedProductsForUrl = `${sortBy}:${sortDir}`;

  const handleSortChange = (val: string) => {
    const [s, d] = val.split(':');
    setSortBy(s);
    setSortDir(d);
    setSearchParams({ ...(search ? { search } : {}), sort: val });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-8 w-48 bg-neutral-200 animate-pulse rounded mb-4" />
          <div className="h-6 w-32 bg-neutral-200 animate-pulse rounded mb-8" />
          <ProductGrid products={[]} loading={true} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white rounded-full font-medium transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Categoría no encontrada</h2>
          <p className="text-neutral-500 mb-4">La categoría que buscas no existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{category.name}</h1>
            <p className="text-neutral-500 mt-1">{allProducts.length} productos</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar en esta categoría..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                onKeyPress={(e) => e.key === 'Enter' && setSearchParams({ ...(search ? { search } : {}), sort: sortedProductsForUrl })}
                className="pl-10 pr-4 py-2 text-sm border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            </div>
            <select
              value={sortedProductsForUrl}
              onChange={(e) => handleSortChange(e.target.value)}
              className="text-sm border border-neutral-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-lg">No se encontraron productos en esta categoría.</p>
          </div>
        ) : (
          <ProductGrid products={filtered} />
        )}
      </div>
    </div>
  );
}
