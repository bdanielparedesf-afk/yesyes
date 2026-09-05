import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';

const categories = ['Todos', 'Tecnología', 'Hogar', 'Moda', 'Belleza', 'Juguetes', 'Deportes'];

const products = [
  { id: '1', name: 'Audífonos Bluetooth Pro', price: 19990, providerPrice: 12000, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop', category: 'Tecnología', stock: 25, offer: true, slug: 'audifonos-bluetooth-pro' },
  { id: '2', name: 'Reloj Inteligente Smart', price: 29990, providerPrice: 18000, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=400&h=400&fit=crop', category: 'Tecnología', stock: 15, offer: true, slug: 'reloj-inteligente-smart' },
  { id: '3', name: 'Zapatillas Running Air', price: 39990, providerPrice: 25000, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1606107557195-0e29a8b52368?w=400&h=400&fit=crop', category: 'Deportes', stock: 8, offer: true, slug: 'zapatillas-running-air' },
  { id: '4', name: 'Cámara Deportiva 4K', price: 24990, providerPrice: 15000, image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop', category: 'Tecnología', stock: 20, offer: false, slug: 'camara-deportiva-4k' },
  { id: '5', name: 'Mochila Impermeable Urban', price: 15990, providerPrice: 8000, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', category: 'Hogar', stock: 50, offer: true, slug: 'mochila-impermeable-urban' },
  { id: '6', name: 'Lámpara LED Escritorio', price: 12990, providerPrice: 6500, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&h=400&fit=crop', category: 'Hogar', stock: 30, offer: true, slug: 'lampara-led-escritorio' },
  { id: '7', name: 'Teclado Mecánico RGB', price: 34990, providerPrice: 22000, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400&h=400&fit=crop', category: 'Tecnología', stock: 12, offer: true, slug: 'teclado-mecanico-rgb' },
  { id: '8', name: 'Mouse Inalámbrico Ergo', price: 9990, providerPrice: 4500, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&h=400&fit=crop', category: 'Tecnología', stock: 40, offer: false, slug: 'mouse-inalambrico-ergo' },
  { id: '9', name: 'Soporte Monitor Ajustable', price: 18990, providerPrice: 10000, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1585792180666-f7347f490ea2?w=400&h=400&fit=crop', category: 'Tecnología', stock: 18, offer: false, slug: 'soporte-monitor-ajustable' },
  { id: '10', name: 'Botella Térmica 1L', price: 7990, providerPrice: 3500, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop', category: 'Deportes', stock: 60, offer: false, slug: 'botella-termica-1l' },
  { id: '11', name: 'Camiseta Dry-Fit Running', price: 14990, providerPrice: 7000, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=400&fit=crop', category: 'Moda', stock: 35, offer: true, slug: 'camiseta-dryfit-running' },
  { id: '12', name: 'Power Bank 20000mAh', price: 11990, providerPrice: 6000, image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop', imageHover: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop', category: 'Tecnología', stock: 45, offer: false, slug: 'power-bank-20000mah' },
];

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
  const { nombre, slug } = useParams();
  const [searchParams] = useSearchParams();

  const addItem = useCartStore((s) => s.addItem);

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
  }, [search, category, maxPrice, stockOnly, offerOnly]);

  const handleAdd = (product: typeof products[0]) => {
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

            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500">No se encontraron productos.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
