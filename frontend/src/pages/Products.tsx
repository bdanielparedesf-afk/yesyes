import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { getProducts, getCategories } from '@/services/products';
import ProductGrid from '@/components/ProductGrid';
import type { Product } from '@/services/products';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const urlCategory = searchParams.get('category') || 'todos';
  const urlOffer = searchParams.get('filter') === 'ofertas';

  const [search, setSearch] = useState(urlSearch);
  const [category, setCategory] = useState(urlCategory);
  const [offerOnly, setOfferOnly] = useState(urlOffer);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProducts();
    void loadCategories();
  }, []);

  async function loadProducts() {
    try {
      const result = await getProducts({ search: search || undefined });
      setProducts(result.products);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      // Categories are optional
    }
  }

  const displayedCategories = [
    { id: 'all', name: 'Todos', slug: 'todos', productCount: undefined as number | undefined },
    ...categories.map((c) => ({
      id: c.id, name: c.name, slug: c.slug,
      productCount: c.productCount ?? c._count?.products ?? 0,
    })),
  ];

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'todos' || p.categorySlug === category || p.category.toLowerCase() === displayedCategories.find(c => c.slug === category)?.name.toLowerCase();
      const matchesOffer = !offerOnly || p.offer;
      return matchesSearch && matchesCategory && matchesOffer;
    });
  }, [products, search, category, offerOnly, displayedCategories]);

  const handleSearch = () => {
    const params: any = {};
    if (search.trim()) params.search = search.trim();
    if (category !== 'todos') params.category = category;
    if (offerOnly) params.filter = 'ofertas';
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">
            {offerOnly ? 'Ofertas' : category !== 'todos' ? category : 'Productos'}
          </h1>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {displayedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.slug);
                  const params: any = {};
                  if (search.trim()) params.search = search.trim();
                  if (cat.slug !== 'todos') params.category = cat.slug;
                  if (offerOnly) params.filter = 'ofertas';
                  setSearchParams(params);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
                  category === cat.slug
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
                }`}
              >
                {cat.name}
                {cat.productCount !== undefined && cat.productCount > 0 && cat.slug !== 'todos' && (
                  <span className="ml-1 text-xs opacity-70">({cat.productCount})</span>
                )}
              </button>
            ))}
            <button
              onClick={() => {
                setOfferOnly(!offerOnly);
                const params: any = {};
                if (search.trim()) params.search = search.trim();
                if (category !== 'todos') params.category = category;
                if (offerOnly) params.filter = 'ofertas';
                setSearchParams(params);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                offerOnly
                  ? 'bg-accent-600 text-white'
                  : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
              }`}
            >
              Solo ofertas
            </button>
          </div>
        </div>

        <ProductGrid
          products={filtered}
          loading={loading}
          emptyMessage={search ? `No se encontraron productos para "${search}"` : 'No hay productos para mostrar'}
        />
      </div>
    </div>
  );
}
