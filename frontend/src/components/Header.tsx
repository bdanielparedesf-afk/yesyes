import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getCategories } from '@/services/products';
import { useHomeData } from '@/hooks/useProductsQuery';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const totalItems = useCartStore((s) => s.totalItems());
  const { user, status, checkSession } = useAuthStore();

  // checkSession tiene caché de 5min + dedupe: solo dispara 1 request.
  // Se difiere a requestIdleCallback para NO competir con /products/home?lite=1
  // en la carga inicial (el cuello de botella es connection_limit=1 a Supabase).
  useEffect(() => {
    const run = () => { void checkSession(); };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 0);
    return () => window.clearTimeout(t);
  }, [checkSession]);

  // Las categorías del nav reutilizan la caché del Home (['home','lite']) si ya
  // se cargó; si no, hace su propio fetch pero SIN bloquear el primer paint.
  // NOTA: useHomeData tipa options como Parameters<typeof useQuery>[1]
  // (= QueryClient en esta versión); se castea para pasar UseQueryOptions.
  const { data: homeCached } = useHomeData({
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false,
  } as unknown as Parameters<typeof useHomeData>[0]);
  useEffect(() => {
    if (homeCached?.categories?.length) {
      setCategories(homeCached.categories);
      return;
    }
    void loadCategories();
  }, [homeCached]);

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      // Categories optional on header
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/productos?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const userAvatar = user?.image;
  const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL || user?.role === 'admin';

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="YESYES" className="h-8 w-auto" />
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-7" aria-label="Navegación principal">
            {[
              { to: '/', label: 'Inicio', active: location.pathname === '/' },
              { to: '/productos', label: 'Productos', active: location.pathname.startsWith('/productos') },
              ...categories.slice(0, 5).map((cat) => ({
                to: `/categoria/${cat.slug}`,
                label: cat.name,
                active: location.pathname.startsWith('/categoria/') && location.pathname.includes(cat.slug),
              })),
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.active ? 'page' : undefined}
                className={`relative text-sm font-medium transition-colors py-1 after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary-600 after:transition-all after:duration-300 ${
                  item.active
                    ? 'text-primary-800 after:w-full'
                    : 'text-neutral-700 hover:text-primary-700 after:w-0 hover:after:w-full'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side: search, account, cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search: inline en desktop, icono en móvil */}
            <form onSubmit={handleSearch} className="hidden lg:flex items-center" role="search">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos..."
                  aria-label="Buscar productos"
                  className="w-56 pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-full bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
                <button type="submit" aria-label="Buscar" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-primary-700">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-neutral-600 hover:text-primary-700 transition-colors lg:hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Buscar"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Account */}
            {status === 'authenticated' && user ? (
              <div className="flex items-center gap-2 relative">
                                <button
                  onClick={() => setShowCategories(!showCategories)}
                  aria-haspopup="true"
                  aria-expanded={showCategories}
                  className="flex items-center gap-2 cursor-pointer rounded-full p-1 -m-1 text-neutral-700 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt={displayName} className="w-9 h-9 rounded-full object-cover border-2 border-neutral-100" />
                  ) : (
                    <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-700" />
                    </div>
                  )}
                  {isAdmin && (
                    <span className="hidden sm:block text-sm font-medium text-neutral-700">{displayName}</span>
                  )}
                </button>
                {showCategories && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-[var(--shadow-float)] border border-neutral-100 py-1">
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setShowCategories(false)} className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                        Panel Admin
                      </Link>
                    )}
                    <Link to="/perfil" onClick={() => setShowCategories(false)} className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                      Mi cuenta
                    </Link>
                    <Link to="/mis-pedidos" onClick={() => setShowCategories(false)} className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                      Mis pedidos
                    </Link>
                    <button
                      onClick={() => useAuthStore.getState().signOut('/')}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
                        ) : (
              <Link
                to="/login"
                className="p-2 text-neutral-600 hover:text-primary-700 transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <User className="w-5 h-5" />
              </Link>
            )}

            {/* Cart */}
            <Link
              to="/carrito"
              aria-label={`Carrito de compras (${totalItems} productos)`}
              className="relative p-2 text-neutral-600 hover:text-primary-700 transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-700 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              className="md:hidden p-2 text-neutral-600 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search overlay */}
        {searchOpen && (
          <div className="border-t border-neutral-100 md:hidden">
            <form onSubmit={handleSearch} className="flex items-center p-3 gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                autoFocus
                className="flex-1 px-4 py-2 text-sm border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="submit" className="p-2 text-neutral-500">
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-neutral-100 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg">
                Inicio
              </Link>
              <Link to="/productos" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg">
                Productos
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categoria/${cat.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg capitalize"
                >
                  {cat.name}
                </Link>
              ))}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg"
              >
                <Search className="w-4 h-4" /> Buscar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
