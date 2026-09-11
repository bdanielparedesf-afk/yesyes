import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Trash2, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

interface Product {
  id: string; name: string; slug: string; salePrice: number; status?: string; stock?: number;
  productImages: { url: string; position?: number }[];
  collection?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  hasAlert?: boolean;
  alert?: string | null;
  alertLevel?: string | null;
}

interface Category {
  id: string; name: string; slug: string; description?: string; active: boolean; _count?: { products: number };
}

export default function AdminProducts() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.email?.toLowerCase() === ADMIN_EMAIL) || user?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'alerts'>('all');
  const [productModal, setProductModal] = useState<Product | null | undefined>(undefined);
  const [productForm, setProductForm] = useState({ name: '', slug: '', description: '', salePrice: '', categoryId: '', collectionId: '', status: 'PUBLISHED', stock: '0' });
  const [productSaving, setProductSaving] = useState(false);
  const [categoriesForSelect, setCategoriesForSelect] = useState<Category[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryModal, setCategoryModal] = useState<Category | null | undefined>(undefined);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', active: true });
  const [categorySaving, setCategorySaving] = useState(false);

  // FEATURE A: bulk delete — selección múltiple de productos
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const allProductsSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id));
  const toggleSelectAll = () => {
    setSelectedIds(allProductsSelected ? [] : products.map((p) => p.id));
  };
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`¿Eliminar ${selectedIds.length} producto(s)? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/products/bulk-delete`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Error al eliminar los productos');
        return;
      }
      setProducts((current) => current.filter((product) => !selectedIds.includes(product.id)));
      setSelectedIds([]);
      toast.success(`${data.deleted ?? selectedIds.length} producto(s) eliminado(s)`);
    } catch {
      toast.error('Error al eliminar los productos');
    } finally {
      setDeleting(false);
    }
  };

  const loadProducts = async (filter?: 'all' | 'alerts') => {
    setProductsLoading(true);
    try {
      const f = filter ?? alertFilter;
      const params = f === 'alerts' ? { hasAlert: 'true' } : {};
      const r = await api.get('/admin/products', { params });
      setProducts(r.data.products);
    } catch { toast.error('Error al cargar productos'); }
    finally { setProductsLoading(false); }
  };
  const loadCategoriesForSelect = async () => { try { const r = await api.get('/admin/categories'); setCategoriesForSelect(r.data.categories); } catch {} };
  const loadCategories = async () => { setCategoriesLoading(true); try { const r = await api.get('/admin/categories'); setCategories(r.data.categories); } catch { toast.error('Error al cargar categorías'); } finally { setCategoriesLoading(false); } };

  useEffect(() => { loadProducts(); loadCategoriesForSelect(); loadCategories(); }, []);

  const handleAlertFilterChange = (filter: 'all' | 'alerts') => {
    setAlertFilter(filter);
    loadProducts(filter);
  };

  if (!isAdmin) return null;

  const openProductModal = (p?: Product) => {
    if (p) { setProductModal(p); setProductForm({ name: p.name, slug: p.slug, description: (p as any).description || '', salePrice: String(p.salePrice), categoryId: p.category?.id || '', collectionId: p.collection?.id || '', status: p.status || 'PUBLISHED', stock: String(p.stock || 0) }); }
    else { setProductModal(null); setProductForm({ name: '', slug: '', description: '', salePrice: '', categoryId: '', collectionId: '', status: 'PUBLISHED', stock: '0' }); }
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.salePrice) { toast.error('Nombre y precio son obligatorios'); return; }
    setProductSaving(true);
    try {
      if (productModal) { await api.put(`/admin/products/${productModal.id}`, { name: productForm.name, salePrice: Number(productForm.salePrice), description: productForm.description, status: productForm.status, categoryId: productForm.categoryId, collectionId: productForm.collectionId, stock: Number(productForm.stock) }); toast.success('Producto actualizado'); }
      else { await api.post('/admin/products', { name: productForm.name, slug: productForm.slug || productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: productForm.description, salePrice: Number(productForm.salePrice), categoryId: productForm.categoryId, collectionId: productForm.collectionId, status: productForm.status, stock: Number(productForm.stock) }); toast.success('Producto creado'); }
      setProductModal(undefined); loadProducts();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error al guardar producto'); } finally { setProductSaving(false); }
  };

  const handleDeleteProduct = async (id: string) => { if (!confirm('¿Eliminar producto?')) return; try { await api.delete(`/admin/products/${id}`); toast.success('Producto eliminado'); loadProducts(); } catch { toast.error('Error al eliminar producto'); } };
  const openCategoryModal = (c?: Category) => { if (c) { setCategoryModal(c); setCategoryForm({ name: c.name, slug: c.slug, description: c.description || '', active: c.active }); } else { setCategoryModal(null); setCategoryForm({ name: '', slug: '', description: '', active: true }); } };

  const handleSaveCategory = async () => {
    if (!categoryForm.name || !categoryForm.slug) { toast.error('Nombre y slug son obligatorios'); return; }
    setCategorySaving(true);
    try {
      if (categoryModal) { await api.put(`/admin/categories/${categoryModal.id}`, categoryForm); toast.success('Categoría actualizada'); }
      else { await api.post('/admin/categories', categoryForm); toast.success('Categoría creada'); }
      setCategoryModal(undefined); loadCategories(); loadCategoriesForSelect();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error al guardar categoría'); } finally { setCategorySaving(false); }
  };

  const handleDeleteCategory = async (id: string) => { if (!confirm('¿Eliminar categoría?')) return; try { await api.delete(`/admin/categories/${id}`); toast.success('Categoría eliminada'); loadCategories(); loadCategoriesForSelect(); } catch { toast.error('Error al eliminar categoría'); } };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAlertFilterChange('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${alertFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => handleAlertFilterChange('alerts')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${alertFilter === 'alerts' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            >
              <AlertTriangle className="w-3 h-3" /> Solo con alertas
            </button>
            <button onClick={() => openProductModal()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"><Plus className="w-4 h-4" /> Nuevo producto</button>
          </div>
        </div>
        {productsLoading ? (<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr>
            {/* FEATURE A: seleccionar todo */}
            <th className="text-left px-4 py-3">
              <input
                type="checkbox"
                checked={allProductsSelected}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                title="Seleccionar todo"
              />
            </th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Imagen</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Precio</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Colección</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Original</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
          </tr></thead><tbody className="divide-y divide-gray-100">
            {products.map((p) => (<tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(p.id) ? 'bg-gray-50' : ''}`}>
              {/* FEATURE A: checkbox por fila */}
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleSelectRow(p.id)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                />
              </td>
              <td className="px-6 py-4"><img src={p.productImages?.[0]?.url || 'https://via.placeholder.com/60'} alt={p.name} className="w-12 h-12 rounded-xl object-cover" /></td>
              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{p.name}</td>
              <td className="px-6 py-4 text-sm font-medium text-gray-900">${Number(p.salePrice).toLocaleString('es-CL')}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{p.stock ?? 0}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{p.collection?.name || '-'}</td>
              <td className="px-6 py-4">
                {p.sourceUrl ? (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium" title={p.sourceUrl}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    {p.sourcePlatform || 'Ver'}
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
                {p.hasAlert && (
                  <span className={`ml-1 inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full ${p.alertLevel === 'danger' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`} title={p.alert || 'Alerta'}>
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}
              </td>
              <td className="px-6 py-4"><div className="flex items-center gap-2"><button onClick={() => openProductModal(p)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button><button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></div></td>
            </tr>))}
            {products.length === 0 && (<tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No hay productos aún</td></tr>)}
          </tbody></table></div></div>
        )}
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Categorías</h2>
          <button onClick={() => openCategoryModal()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"><Plus className="w-4 h-4" /> Nueva categoría</button>
        </div>
        {categoriesLoading ? (<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Slug</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Activa</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Productos</th><th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
          </tr></thead><tbody className="divide-y divide-gray-100">
            {categories.map((c) => (<tr key={c.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-sm text-gray-900">{c.name}</td><td className="px-6 py-4 text-sm text-gray-600">{c.slug}</td>
              <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.active ? 'Activa' : 'Inactiva'}</span></td>
              <td className="px-6 py-4 text-sm text-gray-600">{c._count?.products ?? 0}</td>
              <td className="px-6 py-4"><div className="flex items-center gap-2"><button onClick={() => openCategoryModal(c)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button><button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></div></td>
            </tr>))}
            {categories.length === 0 && (<tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No hay categorías aún</td></tr>)}
          </tbody></table></div></div>
        )}
      </div>

      {/* Modal producto */}
      {productModal !== undefined && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setProductModal(undefined)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{productModal ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => setProductModal(undefined)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><Plus className="w-5 h-5 rotate-45" /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nombre" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              {!productModal && <input value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} placeholder="Slug (opcional)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />}
              <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Descripción" rows={4} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input value={productForm.salePrice} onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })} placeholder="Precio CLP" type="number" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="Stock" type="number" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Sin categoría</option>
                {categoriesForSelect.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <select value={productForm.collectionId} onChange={(e) => setProductForm({ ...productForm, collectionId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Sin colección</option>
                {categoriesForSelect.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              {productModal?.sourceUrl && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium">Fuente:</span>{' '}
                  <a href={productModal.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                    {productModal.sourcePlatform || 'Link'} — {productModal.sourceUrl.slice(0, 60)}... <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              <select value={productForm.status} onChange={(e) => setProductForm({ ...productForm, status: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="PUBLISHED">Publicado</option>
                <option value="DRAFT">Borrador</option>
              </select>
              <button onClick={handleSaveProduct} disabled={productSaving} className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                {productSaving ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE A: barra flotante de bulk delete */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-1 text-sm rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-4 py-1 text-sm rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal categoría */}
      {categoryModal !== undefined && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCategoryModal(undefined)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{categoryModal ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button onClick={() => setCategoryModal(undefined)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><Plus className="w-5 h-5 rotate-45" /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Nombre" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="Slug" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} placeholder="Descripción" rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={categoryForm.active} onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })} />
                Activa
              </label>
              <button onClick={handleSaveCategory} disabled={categorySaving} className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                {categorySaving ? 'Guardando...' : 'Guardar categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
