import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Trash2, Eye, Upload, LogOut } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

interface ProductImage {
  url: string;
  position: number;
}

interface ProductVariant {
  sku: string;
  price: number;
  stock: number;
  size?: string;
  color?: string;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface PreviewProduct {
  pid: string;
  titleEs: string;
  description: string;
  productImage: string;
  productImages: string[];
  variants: ProductVariant[];
  cjPrice: number;
  shipping?: number;
  totalCost?: number;
  stock?: number;
  inventory?: number;
  suggestedPriceUSD?: number;
  suggestedPriceCLP?: number;
  suggestedPrice?: number;
  comparePrice?: number;
  collectionSlug: string;
  autoCategory?: string;
  collections: Collection[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  salePrice: number;
  compareAtPrice?: number;
  productImages: ProductImage[];
  collection: { name: string; slug: string };
}

export default function AdminImport() {
  const navigate = useNavigate();
  const { user, status, checkSession } = useAuthStore();
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<PreviewProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedCollection, setEditedCollection] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [form, setForm] = useState({
    cjPrice: 0,
    shipping: 0,
    totalCost: 0,
    stock: 100,
    margin: 2,
    finalPriceUSD: 0,
    finalPriceCLP: 0,
  });

  const DOLLAR_RATE = 950;

  const marginOptions = [
    { value: 1.5, label: '50% (x1.5)' },
    { value: 2, label: '100% (x2)' },
    { value: 2.5, label: '150% (x2.5)' },
    { value: 3, label: '200% (x3)' },
    { value: 4, label: '300% (x4)' },
  ];

  const isAdmin =
    user?.email?.toLowerCase().trim() === ADMIN_EMAIL || user?.role === 'ADMIN';

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
    }
  }, [isAdmin]);

  const loadProducts = async () => {
    try {
      const res = await api.get('/admin/recent-products');
      setProducts(res.data.products);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Error al cargar productos');
    }
  };

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.shipping !== undefined || patch.cjPrice !== undefined) {
        next.totalCost = Number((next.cjPrice + next.shipping).toFixed(2));
      }
      if (patch.totalCost !== undefined || patch.margin !== undefined) {
        next.finalPriceUSD = Number((next.totalCost * next.margin).toFixed(2));
        next.finalPriceCLP = Math.round(next.finalPriceUSD * DOLLAR_RATE);
      }
      if (patch.finalPriceUSD !== undefined) {
        next.finalPriceCLP = Math.round(next.finalPriceUSD * DOLLAR_RATE);
      }
      if (patch.finalPriceCLP !== undefined) {
        next.finalPriceUSD = Number((next.finalPriceCLP / DOLLAR_RATE).toFixed(2));
      }
      return next;
    });
  };

  const handlePreview = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/preview-cj', { url });
      const data = res.data;
      setPreview(data);
      setEditedTitle(data.titleEs);
      const cjPrice = Number(data.cjPrice || 0);
      const shipping = Number(data.shipping || 0);
      const totalCost = Number((cjPrice + shipping).toFixed(2));
      const stock = data.stock && data.stock > 0 ? data.stock : 100;
      const margin = 2;
      const finalPriceUSD = Number((totalCost * margin).toFixed(2));
      const finalPriceCLP = Math.round(finalPriceUSD * DOLLAR_RATE);
      setForm({ cjPrice, shipping, totalCost, stock, margin, finalPriceUSD, finalPriceCLP });
      setEditedCollection(data.autoCategory || data.collectionSlug);
      setEditedDescription(data.description);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al obtener preview');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      await api.post('/admin/import-cj', {
        url,
        titleEs: editedTitle,
        price: form.finalPriceCLP,
        collectionSlug: editedCollection,
        description: editedDescription,
        applyMargin: true,
        productPrice: form.cjPrice,
        shippingPrice: form.shipping,
        totalCost: form.totalCost,
        finalPriceCLP: form.finalPriceCLP,
        stock: form.stock,
        margin: form.margin,
      });
      toast.success('Producto publicado en yesyes.cl');
      setPreview(null);
      setUrl('');
      setEditedTitle('');
      setEditedCollection('');
      setEditedDescription('');
      setProducts([]);
      setTimeout(() => {
        loadProducts();
      }, 400);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success('Producto eliminado');
      loadProducts();
    } catch (e: any) {
      toast.error('Error al eliminar');
    }
  };

  if (status === 'loading' || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
            ← Panel
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Importar CJ Dropshipping</h1>
        </div>
        <button
          onClick={() => useAuthStore.getState().signOut('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">URL del producto CJ</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://www.cjdropshipping.com/product/..."
            />
            <button
              onClick={handlePreview}
              disabled={loading}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <Eye className="w-5 h-5" />
              {loading ? 'Cargando...' : 'Preview'}
            </button>
          </div>
        </div>

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
          >
            <h2 className="text-lg font-semibold text-gray-900">Preview del Producto</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Costos CJ</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Precio CJ (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.cjPrice}
                    onChange={(e) => updateForm({ cjPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Envío CJ (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.shipping}
                    onChange={(e) => updateForm({ shipping: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Editable si CJ no lo informa</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Costo Total (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.totalCost}
                    onChange={(e) => updateForm({ totalCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Auto: precio + envío</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Margen</label>
                  <select
                    value={form.margin}
                    onChange={(e) => updateForm({ margin: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {marginOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Precio Final Sugerido (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.finalPriceUSD}
                    onChange={(e) => updateForm({ finalPriceUSD: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">≈ ${form.finalPriceCLP.toLocaleString('es-CL')} CLP</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Precio Final (CLP)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.finalPriceCLP}
                    onChange={(e) => updateForm({ finalPriceCLP: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">≈ ${Number((form.finalPriceCLP / DOLLAR_RATE).toFixed(2))} USD</p>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ganancia real:</span>
                <span className="font-medium text-green-600">${Number((form.totalCost * (form.margin - 1)).toFixed(2))} USD</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock en tu tienda</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => updateForm({ stock: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">CJ: {Number(preview.inventory ?? preview.stock ?? 0).toLocaleString('es-CL')} unidades</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (CLP)</label>
                  <input
                    type="number"
                    value={form.finalPriceCLP}
                    onChange={(e) => updateForm({ finalPriceCLP: Number(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Colección</label>
                  <select
                    value={editedCollection}
                    onChange={(e) => setEditedCollection(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {preview.collections.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imágenes</label>
                <div className="grid grid-cols-2 gap-3">
                  {preview.productImages.map((img, i) => (
                    <img key={i} src={img} alt="" className="rounded-lg object-cover aspect-square w-full" />
                  ))}
                  {preview.productImages.length === 0 && preview.productImage && (
                    <img src={preview.productImage} alt="" className="rounded-lg object-cover aspect-square w-full" />
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-6 h-6" />
              {importing ? 'Importando...' : 'Importar a yesyes.cl'}
            </button>
          </motion.div>
        )}

        <div key={`products-${products.length}-${Date.now()}`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Últimos 20 productos</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Imagen</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Precio</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Colección</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <img
                          src={p.productImages[0]?.url || 'https://via.placeholder.com/60'}
                          alt={p.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{p.name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">${Number(p.salePrice).toLocaleString('es-CL')}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.collection?.name || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No hay productos aún
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
