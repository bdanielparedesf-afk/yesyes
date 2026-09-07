import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard, Package, FolderTree, ShoppingBag, Users, LogOut,
  Menu, X, Plus, Pencil, Trash2, Shield, Loader2
} from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

interface Product {
  id: string;
  name: string;
  slug: string;
  salePrice: number;
  status?: string;
  stock?: number;
  productImages: { url: string }[];
  collection?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  _count?: { products: number };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  user?: { name: string; lastName: string; email: string };
}

interface User {
  id: string;
  email: string;
  name: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

type Tab = 'dashboard' | 'productos' | 'categorias' | 'pedidos' | 'usuarios';

const ORDER_STATUSES = [
  'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SUPPLIER_ORDERED',
  'SUPPLIER_PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED',
  'CANCELLED', 'REFUND_REQUESTED', 'REFUND_PROCESSING', 'REFUNDED',
  'DISPUTED', 'PENDING', 'FULFILLED', 'RETURN_REQUESTED', 'RETURNED'
];

const USER_ROLES = ['CUSTOMER', 'ADMIN'];

const SIDEBAR_ITEMS: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'productos', label: 'Productos', icon: Package },
  { key: 'categorias', label: 'Categorías', icon: FolderTree },
  { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
];

export default function Admin() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({ totalProducts: 0, pendingOrders: 0, totalUsers: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productModal, setProductModal] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', slug: '', description: '', salePrice: '', categoryId: '', collectionId: '', status: 'PUBLISHED', stock: '0' });
  const [productSaving, setProductSaving] = useState(false);
  const [categoriesForSelect, setCategoriesForSelect] = useState<Category[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryModal, setCategoryModal] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', active: true });
  const [categorySaving, setCategorySaving] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userRoleSaving, setUserRoleSaving] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login', { replace: true });
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      if (tab === 'dashboard') loadStats();
      else if (tab === 'productos') { loadProducts(); loadCategoriesForSelect(); }
      else if (tab === 'categorias') loadCategories();
      else if (tab === 'pedidos') loadOrders();
      else if (tab === 'usuarios') loadUsers();
    }
  }, [tab, isAdmin]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch {
      toast.error('Error al cargar estadísticas');
    } finally {
      setStatsLoading(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await api.get('/admin/products');
      setProducts(res.data.products);
    } catch {
      toast.error('Error al cargar productos');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadCategoriesForSelect = async () => {
    try {
      const res = await api.get('/admin/categories');
      setCategoriesForSelect(res.data.categories);
    } catch {
      // silent
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const res = await api.get('/admin/categories');
      setCategories(res.data.categories);
    } catch {
      toast.error('Error al cargar categorías');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await api.get('/admin/orders');
      setOrders(res.data.orders);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.salePrice) {
      toast.error('Nombre y precio son obligatorios');
      return;
    }
    setProductSaving(true);
    try {
      if (productModal) {
        await api.put(`/admin/products/${productModal.id}`, {
          name: productForm.name,
          salePrice: Number(productForm.salePrice),
          description: productForm.description,
          status: productForm.status,
          categoryId: productForm.categoryId,
          collectionId: productForm.collectionId,
          stock: Number(productForm.stock),
        });
        toast.success('Producto actualizado');
      } else {
        await api.post('/admin/products', {
          name: productForm.name,
          slug: productForm.slug || productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: productForm.description,
          salePrice: Number(productForm.salePrice),
          categoryId: productForm.categoryId,
          collectionId: productForm.collectionId,
          status: productForm.status,
          stock: Number(productForm.stock),
        });
        toast.success('Producto creado');
      }
      setProductModal(null);
      loadProducts();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar producto');
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success('Producto eliminado');
      loadProducts();
      loadStats();
    } catch {
      toast.error('Error al eliminar producto');
    }
  };

  const openProductModal = (p?: Product) => {
    if (p) {
      setProductModal(p);
      setProductForm({
        name: p.name,
        slug: p.slug,
        description: '',
        salePrice: String(p.salePrice),
        categoryId: p.category?.id || '',
        collectionId: p.collection?.id || '',
        status: p.status || 'PUBLISHED',
        stock: String(p.stock || 0),
      });
    } else {
      setProductModal(null);
      setProductForm({ name: '', slug: '', description: '', salePrice: '', categoryId: '', collectionId: '', status: 'PUBLISHED', stock: '0' });
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name || !categoryForm.slug) {
      toast.error('Nombre y slug son obligatorios');
      return;
    }
    setCategorySaving(true);
    try {
      if (categoryModal) {
        await api.put(`/admin/categories/${categoryModal.id}`, categoryForm);
        toast.success('Categoría actualizada');
      } else {
        await api.post('/admin/categories', categoryForm);
        toast.success('Categoría creada');
      }
      setCategoryModal(null);
      loadCategories();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar categoría');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar categoría?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      toast.success('Categoría eliminada');
      loadCategories();
      loadStats();
    } catch {
      toast.error('Error al eliminar categoría');
    }
  };

  const openCategoryModal = (c?: Category) => {
    if (c) {
      setCategoryModal(c);
      setCategoryForm({ name: c.name, slug: c.slug, description: c.description || '', active: c.active });
    } else {
      setCategoryModal(null);
      setCategoryForm({ name: '', slug: '', description: '', active: true });
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      toast.success('Estado del pedido actualizado');
      loadOrders();
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    setUserRoleSaving(userId);
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast.success('Rol actualizado');
      loadUsers();
    } catch {
      toast.error('Error al actualizar rol');
    } finally {
      setUserRoleSaving(null);
    }
  };

  const handleLogout = () => {
    useAuthStore.getState().signOut('/login');
    navigate('/login', { replace: true });
  };

  if (!isAdmin) return null;

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-auto`}>
      <div className="flex items-center justify-between p-6 border-b border-gray-800">
        <Link to="/" className="text-2xl font-bold text-white">YES<span className="text-gray-400">YES</span></Link>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="p-4 space-y-1">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-white text-gray-900' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <Shield className="w-4 h-4 text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );

  const renderContent = () => {
    if (tab === 'dashboard') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Productos" value={stats.totalProducts} icon={Package} color="bg-gray-900" />
            <StatCard title="Pedidos Pendientes" value={stats.pendingOrders} icon={ShoppingBag} color="bg-gray-700" />
            <StatCard title="Usuarios" value={stats.totalUsers} icon={Users} color="bg-gray-500" />
          </div>
          {statsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          )}
        </div>
      );
    }

    if (tab === 'productos') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
            <button onClick={() => openProductModal()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Nuevo producto
            </button>
          </div>
          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Imagen</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Colección</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <img src={p.productImages?.[0]?.url || 'https://via.placeholder.com/60'} alt={p.name} className="w-12 h-12 rounded-xl object-cover" />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{p.name}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">${Number(p.salePrice).toLocaleString('es-CL')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{p.stock ?? 0}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{p.collection?.name || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openProductModal(p)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No hay productos aún</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (tab === 'categorias') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Categorías</h2>
            <button onClick={() => openCategoryModal()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Nueva categoría
            </button>
          </div>
          {categoriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Slug</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Activa</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Productos</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categories.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{c.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.slug}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {c.active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c._count?.products ?? 0}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openCategoryModal(c)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {categories.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No hay categorías aún</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (tab === 'pedidos') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Número</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{o.orderNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{o.user ? `${o.user.name} ${o.user.lastName}` : '-'}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">${Number(o.total).toLocaleString('es-CL')}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {o.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{new Date(o.createdAt).toLocaleDateString('es-CL')}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={o.status}
                              onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            >
                              {ORDER_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No hay pedidos aún</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (tab === 'usuarios') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Rol</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{u.name} {u.lastName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {u.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              disabled={userRoleSaving === u.id}
                              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
                            >
                              {USER_ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No hay usuarios aún</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {renderSidebar()}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden" />}
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 capitalize">{tab === 'productos' ? 'Productos' : tab === 'categorias' ? 'Categorías' : tab === 'pedidos' ? 'Pedidos' : tab === 'usuarios' ? 'Usuarios' : 'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-600">{user?.email}</span>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {productModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900">{productModal ? 'Editar producto' : 'Nuevo producto'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input type="text" value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (CLP)</label>
                <input type="number" value={productForm.salePrice} onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sin categoría</option>
                  {categoriesForSelect.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={productForm.status} onChange={(e) => setProductForm({ ...productForm, status: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {['DRAFT', 'PUBLISHED', 'PAUSED', 'OUT_OF_STOCK', 'ARCHIVED'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setProductModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSaveProduct} disabled={productSaving} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                {productSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900">{categoryModal ? 'Editar categoría' : 'Nueva categoría'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input type="text" value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="flex items-center gap-2">
                <input id="cat-active" type="checkbox" checked={categoryForm.active} onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })} className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                <label htmlFor="cat-active" className="text-sm text-gray-700">Activa</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setCategoryModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSaveCategory} disabled={categorySaving} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                {categorySaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
