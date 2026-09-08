import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import { getProducts } from '@/services/products';
import type { Product } from '@/services/products';

const categories = ['Todos', 'Tecnología', 'Hogar', 'Moda', 'Belleza', 'Juguetes', 'Deportes'];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

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

  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(data))
      .catch(() => toast.error('Error al cargar productos'))
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

  const handleAdd = (product: Product) => {
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {offerOnly ? 'Ofertas' : category !== 'Todos' ? category : 'Productos'}
          </h1>
          <button
            className="lg:hidden flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg"
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
                <h3 className="font-semibold text-gray-900 mb-3">Categoría</h3>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        checked={category === cat}
                        onChange={() => setCategory(cat)}
                        className="text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Precio máximo: ${maxPrice.toLocaleString('es-CL')}</h3>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="1000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-primary-500"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stockOnly}
                    onChange={(e) => setStockOnly(e.target.checked)}
                    className="rounded text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Solo con stock</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offerOnly}
                    onChange={(e) => setOfferOnly(e.target.checked)}
                    className="rounded text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Solo ofertas</span>
                </label>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Cargando productos...</div>
            ) : (
              <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map((product) => (
                  <motion.div key={product.id} variants={item} whileHover={{ y: -4 }} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden group">
                    <Link to={`/productos/${product.slug}`} className="block relative overflow-hidden aspect-square">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300 absolute inset-0" />
                      <img src={product.imageHover} alt={product.name} className="w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0" />
                      {product.offer && (
                        <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -20%
                        </span>
                      )}
                    </Link>
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-gray-800 line-clamp-2">{product.name}</h3>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xs text-gray-400 line-through">${product.providerPrice.toLocaleString('es-CL')}</span>
                        <span className="text-xl font-bold text-primary-600">${product.price.toLocaleString('es-CL')}</span>
                      </div>
                      <p className="text-sm font-medium text-green-600">
                        Ganancia ${(product.price - product.providerPrice).toLocaleString('es-CL')}
                      </p>
                      <p className="text-xs text-gray-500">Stock: {product.stock} unidades</p>
                      <button
                        onClick={() => handleAdd(product)}
                        className="w-full mt-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Agregar
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500">No se encontraron productos.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
