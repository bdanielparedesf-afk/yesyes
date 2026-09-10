import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Upload,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Productos', icon: Package },
  { href: '/admin/orders', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/import-cj', label: 'Importar CJ', icon: Upload },
  { href: '/admin/bulk', label: 'Importar Excel', icon: Upload },
] as const;

export default function AdminSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuthStore();

  const handleSignOut = () => {
    signOut('/');
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col">
      <div className="flex items-center justify-between p-5 border-b border-gray-800">
        <Link to="/admin" className="text-2xl font-bold tracking-tight flex items-center gap-2">
          YES<span className="text-gray-400">YES</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <Link
              key={href}
              to={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-white text-gray-900' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
            <Shield className="w-4 h-4 text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Administrador'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
