import { Link } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems());
  const { user, status, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL || user?.role === 'admin';

  const handleSignOut = () => {
    useAuthStore.getState().signOut('/');
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const userAvatar = user?.image;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-[0_1px_20px_rgba(232,160,191,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="YESYES" className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/productos" className="text-[#4A2C3A]/80 hover:text-[#E8A0BF] font-medium transition-colors">
              Productos
            </Link>
            <Link to="/contacto" className="text-[#4A2C3A]/80 hover:text-[#E8A0BF] font-medium transition-colors">
              Contacto
            </Link>
          </nav>

          <div className="hidden md:flex items-center space-x-6">
            <Link to="/carrito" className="relative text-[#4A2C3A]/80 hover:text-[#E8A0BF] transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#E8A0BF] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

             {status === 'authenticated' && user ? (
              <div className="flex items-center space-x-3">
                {isAdmin && (
                  <Link to="/admin" className="text-sm font-medium text-[#4A2C3A]/80 hover:text-[#E8A0BF] transition-colors">
                    Admin
                  </Link>
                )}
                {userAvatar ? (
                  <img src={userAvatar} alt={displayName} className="w-9 h-9 rounded-full object-cover border-2 border-[#FAD3E7]" />
                ) : (
                  <div className="w-9 h-9 bg-[#FAD3E7]/40 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[#E8A0BF]" />
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-[#4A2C3A]">{displayName}</p>
                  <p className="text-xs text-[#4A2C3A]/60">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1 text-[#4A2C3A]/60 hover:text-red-400 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : status === 'loading' ? null : (
              <Link to="/login" className="flex items-center space-x-1 text-[#4A2C3A]/80 hover:text-[#E8A0BF] transition-colors">
                <User className="w-5 h-5" />
                <span className="font-medium">Login</span>
              </Link>
            )}
          </div>

          <button
            className="md:hidden text-[#4A2C3A]/80"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-3">
            <Link to="/productos" className="block text-[#4A2C3A]/80 hover:text-[#E8A0BF] font-medium" onClick={() => setMobileOpen(false)}>
              Productos
            </Link>
            <Link to="/contacto" className="block text-[#4A2C3A]/80 hover:text-[#E8A0BF] font-medium" onClick={() => setMobileOpen(false)}>
              Contacto
            </Link>
            <Link to="/carrito" className="flex items-center space-x-2 text-[#4A2C3A]/80 hover:text-[#E8A0BF] font-medium" onClick={() => setMobileOpen(false)}>
              <ShoppingCart className="w-5 h-5" />
              <span>Carrito {totalItems > 0 && `(${totalItems})`}</span>
            </Link>
            {status === 'authenticated' && user ? (
              <div className="flex items-center justify-between pt-2 border-t border-[#FAD3E7]">
                <div className="flex items-center space-x-3">
                  {isAdmin && (
                    <Link to="/admin" className="text-sm font-medium text-[#4A2C3A]/80 hover:text-[#E8A0BF]" onClick={() => setMobileOpen(false)}>
                      Admin
                    </Link>
                  )}
                  {userAvatar ? (
                    <img src={userAvatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 bg-[#FAD3E7]/40 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-[#E8A0BF]" />
                    </div>
                  )}
                  <span className="font-medium text-[#4A2C3A]">{displayName}</span>
                </div>
                <button
                  onClick={() => { handleSignOut(); setMobileOpen(false); }}
                  className="p-1 text-[#4A2C3A]/60 hover:text-red-400 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="flex items-center space-x-2 text-[#4A2C3A]/80 hover:text-[#E8A0BF] font-medium" onClick={() => setMobileOpen(false)}>
                <User className="w-5 h-5" />
                <span>Login</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
