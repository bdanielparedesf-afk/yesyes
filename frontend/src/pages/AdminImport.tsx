import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Trash2, Eye, Upload, LogOut } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { cleanDescription, translateToSpanish } from '@/lib/html-utils';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

interface ProductImage {
  url: string;
  position: number;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface PreviewVariant {
  sku: string;
  name: string;
  nameEs: string;
  image: string;
  sellPrice: number;
  shipping: number;
  finalPriceCLP: number;
  finalPriceUSD: number;
  price: number;
  stock: number;
  size?: string | null;
  color?: string | null;
}

interface PreviewProduct {
  pid: string;
  titleEs: string;
  description: string;
  productImage: string;
  productImages: string[];
  variants: PreviewVariant[];
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

interface BulkRow {
  index: number;
  url: string;
  ok: boolean;
  name?: string;
  price?: number;
  error?: string;
  detail?: string;
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
    selectedVariantSkus: [] as string[],
  });

  const [dollarRate, setDollarRate] = useState(950);
  const dollarFromBrowser = useRef(false);

  async function fetchDollarRate() {
    try {
      const res = await fetch('https://mindicador.cl/api/dolar');
      if (!res.ok) throw new Error('HTTP error');
      const json = await res.json();
      // mindicador.cl cambió el formato: antes "dolar":[{valor}], ahora "serie":[{valor}]
      const serieEntry = (json.serie && json.serie.length) ? json.serie[0] : null;
      const dolarEntry = (json.dolar && json.dolar.length) ? json.dolar[0] : null;
      const raw = serieEntry ? serieEntry.valor : (dolarEntry ? dolarEntry.valor : null);
      const value = parseFloat(String(raw ?? ''));
      if (Number.isFinite(value) && value > 0) {
        setDollarRate(value);
        dollarFromBrowser.current = true;
      }
    } catch (e) {
      console.warn('Error fetching dollar rate, keeping default 950:', e);
    }
  }

  useEffect(() => {
    fetchDollarRate();
  }, []);

  function roundToTen(value: number): number {
    return Math.round(value / 10) * 10;
  }

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

      // Si cambia shipping o cjPrice, recalcular totalCost
      if (patch.shipping !== undefined || patch.cjPrice !== undefined) {
        next.totalCost = Number((next.cjPrice + next.shipping).toFixed(2));
      }

      // Si cambia totalCost o margin, recalcular finalPriceUSD y finalPriceCLP
      if (patch.totalCost !== undefined || patch.margin !== undefined) {
        next.finalPriceUSD = Number((next.totalCost * next.margin).toFixed(2));
        next.finalPriceCLP = roundToTen(next.finalPriceUSD * dollarRate);
      }

      if (patch.finalPriceUSD !== undefined) {
        next.finalPriceCLP = roundToTen(next.finalPriceUSD * dollarRate);
      }

      if (patch.finalPriceCLP !== undefined) {
        next.finalPriceUSD = Number((next.finalPriceCLP / dollarRate).toFixed(2));
      }

      return next;
    });
  };

  const [previewError, setPreviewError] = useState('');

  // ─── Tabs: 1 = CJ individual (1 link), 2 = Importación masiva CJ (30 links) ───
  const [tab, setTab] = useState<'cj' | 'bulk'>('cj');

  // ─── Tab 2: Importación masiva CJ ───
  const [bulkLinks, setBulkLinks] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkResults, setBulkResults] = useState<BulkRow[]>([]);
  const [bulkMargin, setBulkMargin] = useState(2); // default 2 = 100% (x2), same as single importer

  const handlePreview = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? url).trim();
    if (!targetUrl) {
      setPreviewError('Pega primero el link del producto CJ.');
      return;
    }
    setLoading(true);
    setPreviewError('');
    try {
      // Cache busting: agregar timestamp para asegurar llamada fresca
      const cacheBustUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
      const res = await api.post('/admin/preview-cj', { url: cacheBustUrl });
      const data = res.data;
      setPreview(data);
      setEditedTitle(data.titleEs);

      let cjPrice = Number(data.cjPrice || 0);
      let shipping = Number(data.shipping || 0);
      let stock = data.stock && data.stock > 0 ? data.stock : 100;
      const margin = 2;

      // Defaults: si shipping viene 0, poner 9.17 por defecto
      if (shipping === 0) {
        shipping = 9.17;
      }

      // Defaults: si stock viene 0, poner 100 por defecto
      if (stock === 0) {
        stock = 100;
      }

      // Dólar real: prioriza el fetch del navegador; si falló, usa el del backend
      let rate = dollarRate;
      const backendRate = Number(data.dollarRate || 0);
      if (!dollarFromBrowser.current && backendRate > 0) {
        rate = backendRate;
        setDollarRate(backendRate);
      }

      const totalCost = Number((cjPrice + shipping).toFixed(2));

      // Precio de listado por defecto = precio final de la VARIANTE MÁS BARATA.
      // Si el preview no trae variantes, cae al cálculo global (costo * margen * dólar).
      const variantFinals: number[] = Array.isArray(data.variants)
        ? data.variants
            .map((v: any) => Number(v.finalPriceCLP || v.price || 0))
            .filter((n: number) => n > 0)
        : [];
      const cheapestVariant = variantFinals.length ? Math.min(...variantFinals) : 0;
      const finalPriceUSD =
        cheapestVariant > 0 ? Number((cheapestVariant / rate).toFixed(2)) : Number((totalCost * margin).toFixed(2));
      const finalPriceCLP =
        cheapestVariant > 0 ? roundToTen(cheapestVariant) : roundToTen(finalPriceUSD * rate);

      setForm({
        cjPrice,
        shipping,
        totalCost,
        stock,
        margin,
        finalPriceUSD,
        finalPriceCLP,
        selectedVariantSkus: Array.isArray(data.variants) ? data.variants.map((v: any) => String(v.sku)) : [],
      });
      setEditedCollection(data.collectionSlug || data.autoCategory || '');
      // Limpiar HTML sucio y traducir al español antes de mostrar en formulario
      console.log('[AdminImport] Descripción ANTES de cleanDescription:', data.description);
      const cleanedDesc = cleanDescription(data.description || '');
      console.log('[AdminImport] Descripción DESPUÉS de cleanDescription:', cleanedDesc);
      const [translatedTitle, translatedDesc] = await Promise.all([
        translateToSpanish(data.titleEs || ''),
        translateToSpanish(cleanedDesc),
      ]);
      console.log('[AdminImport] Título traducido:', translatedTitle);
      console.log('[AdminImport] Descripción traducida:', translatedDesc);
      setEditedTitle(translatedTitle);
      setEditedDescription(translatedDesc);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        (e.response?.status === 404
          ? 'CJ no devolvió ese producto. Revisa que el link sea de cjdropshipping.com y contenga el ID.'
          : e.response?.status === 400
            ? 'Ese link no trae un ID válido de CJ. Copia el link completo desde el navegador.'
            : 'Error al obtener preview. Intenta de nuevo.');
      setPreviewError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onUrlChange = (value: string) => {
    setUrl(value);
    if (previewError) setPreviewError('');
  };

  const onUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) return;
    // Deja que el input se actualice y luego dispara el preview solo
    setTimeout(() => handlePreview(pasted), 150);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      // Sanitización final defensiva: asegura que no se guarde HTML sucio ni inglés
      const finalTitle = cleanDescription(editedTitle || '').trim();
      const finalDescription = cleanDescription(editedDescription || '').trim();

      await api.post('/admin/import-cj', {
        url,
        titleEs: finalTitle,
        price: form.finalPriceCLP,
        collectionSlug: editedCollection,
        description: finalDescription,
        applyMargin: true,
        productPrice: form.cjPrice,
        shippingPrice: form.shipping,
        totalCost: form.totalCost,
        finalPriceCLP: form.finalPriceCLP,
        stock: form.stock,
        margin: form.margin,
        selectedVariantSkus: form.selectedVariantSkus,
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

  // Tab 1 (CJ 1 link): fotos del preview — foto grande + miniaturas, máximo 5
  const previewImages = preview
    ? [preview.productImage, ...(preview.productImages || [])].filter(Boolean).slice(0, 5)
    : [];

  // Tab 1 (CJ 1 link): helpers para elegir variantes a importar (checkboxes)
  const hasVariants = !!(preview && preview.variants && preview.variants.length > 0);
  const selectedCount = form.selectedVariantSkus.length;
  const selectedVariantSet = new Set(form.selectedVariantSkus);

  const selectAllVariants = () => {
    if (!preview) return;
    setForm((prev) => ({
      ...prev,
      selectedVariantSkus: preview.variants.map((v) => v.sku),
    }));
  };

  const clearVariantSelection = () => {
    setForm((prev) => ({ ...prev, selectedVariantSkus: [] }));
  };

  const toggleVariant = (sku: string) => {
    setForm((prev) => {
      const selected = new Set(prev.selectedVariantSkus);
      if (selected.has(sku)) selected.delete(sku);
      else selected.add(sku);
      return { ...prev, selectedVariantSkus: Array.from(selected) };
    });
  };

  // Tab 2: links parseados del textarea — uno por línea, máximo 30
  const bulkLinkList = bulkLinks
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);

  // Tab 2: importa los links contra POST /api/scrape/cj/bulk, uno por request.
  // Así la barra muestra progreso real (ej: 3/30) y no se muere por el timeout
  // de serverless (30 productos seguidos en un solo request superarían el límite).
  const handleBulkImport = async () => {
    const links = bulkLinkList;
    if (!links.length) {
      toast.error('Pega al menos un link de CJ (uno por línea).');
      return;
    }
    setBulkRunning(true);
    setBulkResults([]);
    setBulkDone(0);
    let okCount = 0;
    for (let i = 0; i < links.length; i++) {
      try {
        const res = await api.post('/scrape/cj/bulk', {
          links: [links[i]],
          collectionSlug: bulkCategory.trim() || undefined,
          margin: bulkMargin,
        });
        const row = res.data?.results?.[0];
        if (row?.ok) {
          okCount++;
          setBulkResults((prev) => [
            ...prev,
            { index: i + 1, url: links[i], ok: true, name: row.name, price: row.price },
          ]);
        } else {
          const errorDetail = row?.detail || row?.error || 'Error desconocido';
          setBulkResults((prev) => [
            ...prev,
            { index: i + 1, url: links[i], ok: false, error: errorDetail, detail: errorDetail },
          ]);
        }
      } catch (e: any) {
        const errorDetail = e.response?.data?.detail || e.response?.data?.message || e.message || 'Error de red';
        setBulkResults((prev) => [
          ...prev,
          {
            index: i + 1,
            url: links[i],
            ok: false,
            error: errorDetail,
            detail: errorDetail,
          },
        ]);
      }
      setBulkDone(i + 1);
    }
    toast.success(`Importación masiva terminada: ${okCount}/${links.length} OK`);
    setBulkRunning(false);
    loadProducts();
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
        {/* ─── Tabs ─── */}
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm w-fit">
          <button
            onClick={() => setTab('cj')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'cj' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            CJ · 1 link
          </button>
          <button
            onClick={() => setTab('bulk')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'bulk' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Importación Masiva CJ - 30 links
          </button>
        </div>

        {tab === 'cj' && (
        <>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">URL del producto CJ</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onPaste={onUrlPaste}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePreview(); }}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Pega aquí el link de CJ, ej: https://www.cjdropshipping.com/product/..."
            />
            <button
              onClick={() => handlePreview()}
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <Eye className="w-5 h-5" />
              {loading ? 'Cargando...' : 'Preview'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Acepta links de cjdropshipping.com (product, list, tienda) o un ID directo. Al pegar se busca solo.
          </p>
          {previewError && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {previewError}
              <div className="text-xs text-red-600 mt-1">
                Tip: abre el producto en CJ, copia la URL completa de la barra del navegador y pégala aquí.
              </div>
            </div>
          )}
          {loading && (
            <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Buscando producto en CJ, espera unos segundos...
            </div>
          )}
        </div>

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
          >
            <h2 className="text-lg font-semibold text-gray-900">Preview del Producto</h2>

            {/* Preview bonito: foto grande a la izquierda + datos a la derecha */}
            <div className="grid md:grid-cols-2 gap-6 bg-gray-50 border border-gray-100 rounded-2xl p-5">
              <div>
                <img
                  src={previewImages[0] || 'https://via.placeholder.com/600'}
                  alt={editedTitle || preview.titleEs}
                  className="w-full aspect-square object-cover rounded-2xl border border-gray-200 bg-white"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {previewImages.length} foto{previewImages.length === 1 ? '' : 's'} · se guardan máximo 5
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500 shrink-0">ID CJ</span>
                  <span className="font-medium text-gray-900 text-right break-all">{preview.pid}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Título</span>
                  <span className="font-medium text-gray-900 text-right">{preview.titleEs}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Precio CJ</span>
                  <span className="font-medium text-gray-900">${Number(preview.cjPrice || 0).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Envío CJ</span>
                  <span className="font-medium text-gray-900">${Number(preview.shipping || 0).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Stock CJ</span>
                  <span className="font-medium text-gray-900">
                    {Number(preview.inventory ?? preview.stock ?? 0).toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Colección sugerida</span>
                  <span className="font-medium text-gray-900">{preview.collectionSlug || preview.autoCategory || '-'}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Precio sugerido</span>
                  <span className="font-medium text-green-700">
                    ${Number(preview.suggestedPriceUSD ?? 0).toFixed(2)} USD /{' '}
                    ${Number(preview.suggestedPriceCLP ?? preview.suggestedPrice ?? 0).toLocaleString('es-CL')} CLP
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-gray-500 block mb-1">Fuente (se guarda como sourceUrl)</span>
                  <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                    {url}
                  </a>
                </div>
              </div>
            </div>

            {/* Miniaturas: solo las primeras 5 fotos */}
            {previewImages.length > 1 && (
              <div className="flex flex-wrap gap-3">
                {previewImages.slice(0, 5).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className={`w-20 h-20 rounded-xl object-cover border-2 ${i === 0 ? 'border-green-500' : 'border-gray-200'}`}
                  />
                ))}
              </div>
            )}

            {/* Variantes del link: 1 producto con N opciones elegibles */}
            {hasVariants && (
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Variantes ({preview!.variants.length})
                    </h3>
                    <button
                      type="button"
                      onClick={selectAllVariants}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 underline"
                    >
                      Seleccionar todas
                    </button>
                    <button
                      type="button"
                      onClick={clearVariantSelection}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 underline"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedCount} seleccionada{selectedCount === 1 ? '' : 's'} · 1 solo producto en YESYES
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Elegir</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Imagen</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Modelo</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Precio CJ (USD)</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Envío (USD)</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Precio final (CLP)</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview!.variants.map((v) => (
                        <tr key={v.sku} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedVariantSet.has(v.sku)}
                              onChange={() => toggleVariant(v.sku)}
                              disabled={importing}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {v.image ? (
                              <img src={v.image} alt={v.nameEs || v.name} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                sin foto
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[220px]">
                            <div className="font-medium truncate">{v.nameEs || v.name}</div>
                            {v.size && <div className="text-xs text-gray-500">Talla: {v.size}</div>}
                            {v.color && <div className="text-xs text-gray-500">Color: {v.color}</div>}
                            <div className="text-[11px] text-gray-400 font-mono truncate">{v.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">${Number(v.sellPrice || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">${Number(v.shipping || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ${Number(v.finalPriceCLP || v.price || 0).toLocaleString('es-CL')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{Number(v.stock || 0).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                  <p className="text-[11px] text-gray-500 mt-1">Si viene 0 → 9.17 por defecto</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Costo Total (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.totalCost}
                    readOnly
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
                  <p className="text-[11px] text-gray-500 mt-1">≈ ${Number((form.finalPriceCLP / dollarRate).toFixed(2))} USD</p>
                </div>
              </div>
              <div className="flex justify-between text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span className="text-gray-700 font-medium">Venta:</span>
                <span className="font-bold text-green-700">
                  ${form.finalPriceUSD.toFixed(2)} USD / ${form.finalPriceCLP.toLocaleString('es-CL')} CLP
                </span>
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
                <p className="text-xs text-gray-500 mt-1">Si viene 0 → 100 por defecto · CJ: {Number(preview.inventory ?? preview.stock ?? 0).toLocaleString('es-CL')} unidades</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
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
        </>
        )}

        {tab === 'bulk' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
          >
            <h2 className="text-lg font-semibold text-gray-900">Importación Masiva CJ - 30 links</h2>
            <p className="text-sm text-gray-500 -mt-4">
              Pega hasta 30 links de CJ (uno por línea). Cada link guarda sourceUrl + 5 fotos y se muestra como OK/Error en la tabla.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Links de productos CJ ({bulkLinkList.length}/30)
              </label>
              <textarea
                value={bulkLinks}
                onChange={(e) => setBulkLinks(e.target.value)}
                rows={10}
                disabled={bulkRunning}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={'https://www.cjdropshipping.com/product/... (link 1)\nhttps://www.cjdropshipping.com/product/... (link 2)\n...\n(30 links máximo, uno por línea)'}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría (colección)</label>
                <input
                  type="text"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  disabled={bulkRunning}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ej: accesorios-telefono (opcional, vacío = autodetecta)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Margen</label>
                <select
                  value={bulkMargin}
                  onChange={(e) => setBulkMargin(Number(e.target.value))}
                  disabled={bulkRunning}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {marginOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleBulkImport}
                  disabled={bulkRunning || bulkLinkList.length === 0}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {bulkRunning
                    ? `Importando ${bulkDone}/${bulkLinkList.length}...`
                    : `IMPORTAR ${bulkLinkList.length || 30} CJ`}
                </button>
              </div>
            </div>

            {(bulkRunning || bulkResults.length > 0) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  <span>Progreso</span>
                  <span>
                    {bulkDone} / {bulkLinkList.length}
                    {bulkResults.filter((r) => r.ok).length > 0 && (
                      <span className="ml-2 text-green-600">({bulkResults.filter((r) => r.ok).length} OK)</span>
                    )}
                    {bulkResults.filter((r) => !r.ok).length > 0 && (
                      <span className="ml-1 text-red-600">({bulkResults.filter((r) => !r.ok).length} Error)</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${bulkLinkList.length ? Math.round((bulkDone / bulkLinkList.length) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {bulkResults.length > 0 && (
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Link</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Precio</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkResults.map((r) => (
                        <tr key={r.index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">{r.index}</td>
                          <td className="px-4 py-3 text-xs max-w-[220px] truncate">
                            <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              {r.url}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            {r.ok ? (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">OK</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Error</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[220px] truncate">{r.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {r.price ? `$${Number(r.price).toLocaleString('es-CL')}` : '-'}
                          </td>
                           <td className="px-4 py-3 text-xs text-red-600 max-w-[220px] truncate" title={r.detail || r.error || ''}>
                             {r.error || ''}
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
