import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Trash2, Eye, Upload, LogOut } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
  price: number;
  comparePrice: number;
  collectionSlug: string;
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<PreviewProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedPrice, setEditedPrice] = useState('');
  const [editedCollection, setEditedCollection] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      loadProducts();
    }
  }, [isLoggedIn]);

  const loadProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/recent-products`);
      setProducts(res.data.products);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    if (email === adminEmail && password === adminPassword) {
      setIsLoggedIn(true);
      toast.success('Sesión iniciada');
    } else {
      toast.error('Credenciales incorrectas');
    }
  };

  const handlePreview = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/preview-cj`, { url });
      const data = res.data;
      setPreview(data);
      setEditedTitle(data.titleEs);
      setEditedPrice(String(data.price));
      setEditedCollection(data.collectionSlug);
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
      await axios.post(`${API_BASE}/admin/import-cj`, {
        url,
        titleEs: editedTitle,
        price: Number(editedPrice),
        collectionSlug: editedCollection,
        description: editedDescription,
      });
      toast.success('Producto publicado en yesyes.cl');
      setPreview(null);
      setUrl('');
      loadProducts();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/admin/products/${id}`);
      toast.success('Producto eliminado');
      loadProducts();
    } catch (e: any) {
      toast.error('Error al eliminar');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full space-y-6">
          <h1 className="text-2xl font-bold text-center text-gray-900">Admin YESYES</h1>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="admin@yesyes.cl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
          >
            Ingresar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Importar CJ Dropshipping</h1>
        <button
          onClick={() => setIsLoggedIn(false)}
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
                    value={editedPrice}
                    onChange={(e) => setEditedPrice(e.target.value)}
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

        <div>
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
