import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Trash2, Pencil, Plus, Package, ShoppingBag, Users, ArrowRight } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

interface Product {
  id: string;
  name: string;
  slug: string;
  salePrice: number;
  compareAtPrice?: number;
  productImages: { url: string }[];
  collection?: { name: string; slug: string };
  status?: string;
}

export default function Admin() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'productos' | 'pedidos' | 'usuarios'>('productos');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.email === 'Bdanielparedesf@gmail.com';

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/recent-products');
      setProducts(res.data.products);
    } catch (e) {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && tab === 'productos') {
      loadProducts();
    }
  }, [isAdmin, tab]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success('Producto eliminado');
      loadProducts();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al eliminar');
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setEditName(p.name);
    setEditPrice(String(p.salePrice));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/products/${editing.id}`, {
        name: editName,
        salePrice: Number(editPrice),
      });
      toast.success('Producto actualizado');
      setEditing(null);
      loadProducts();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">No autorizado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
          <Link to="/" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
            Volver al inicio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">Panel Admin YESYES</h1>
            <div className="flex items-center gap-3">
              <Link
                to="/admin/import"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear producto
              </Link>
              <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
                Salir
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'productos', label: 'Productos', icon: Package },
                { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag },
                { key: 'usuarios', label: 'Usuarios', icon: Users },
              ].map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key as any)}
                    className={`${
                      active
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 transition-colors`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {tab === 'productos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
                  <button
                    onClick={loadProducts}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Actualizar
                  </button>
                </div>
                {loading ? (
                  <div className="py-12 text-center text-gray-500">Cargando...</div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Imagen</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Precio</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Colección</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {products.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <img
                                  src={p.productImages?.[0]?.url || 'https://via.placeholder.com/60'}
                                  alt={p.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{p.name}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                ${Number(p.salePrice).toLocaleString('es-CL')}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {p.collection?.name || '-'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openEdit(p)}
                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(p.id)}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {products.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                No hay productos aún
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'pedidos' && (
              <div className="py-12 text-center text-gray-500">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg font-medium text-gray-900">Pedidos</p>
                <p className="text-sm">Esta sección estará disponible próximamente.</p>
              </div>
            )}

            {tab === 'usuarios' && (
              <div className="py-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg font-medium text-gray-900">Usuarios</p>
                <p className="text-sm">Esta sección estará disponible próximamente.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Editar producto</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (CLP)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
