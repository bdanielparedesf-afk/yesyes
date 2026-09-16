import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, Unplug, ShieldAlert, Search, Upload, PackageCheck } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

interface Account {
  account: string; sellerId: string | null; expiresAt: string; refreshExpiresAt: string;
  isActive: boolean; tokenUnexpired: boolean;
}
interface ConnectionStatus {
  configured: boolean; authenticationVerified: boolean; refreshAvailable: boolean;
  dropshipAvailable: boolean; orderExecutionEnabled: boolean; accounts: Account[];
}
interface PreviewVariant {
  supplierVariantId: string; skuAttr: string;
  attributes: { name: string; value: string; image?: string }[];
  image?: string; costUsd: number | null; stock: number | null; stockKnown: boolean;
}
interface ImportPreview {
  sourceUrl: string; aliexpressId: string; name: string; description: string;
  images: string[]; categoryId?: string; variants: PreviewVariant[];
  stockKnown: boolean; totalStock: number | null;
  costUsdCents: number | null; shippingUsdCents: number | null; shippingUnknown: boolean;
  fx: number; salePriceClp: number | null; duplicateOfProductId: string | null;
  wholesaleTiers: { minQuantity: string; price: string }[];
}
interface ImportJob {
  id: string; status: string; total: number; processed: number; succeeded: number; failed: number;
  items: { id: string; sourceUrl: string; aliexpressId: string | null; status: string;
    attempts: number; createdProductId: string | null }[];
}

const MARGINS = [50, 100, 150, 200, 250, 300, 350, 400];

function PreviewCard({ preview }: { preview: ImportPreview }) {
  return <div className="border rounded-xl p-4 space-y-3">
    <div className="flex gap-4">
      {preview.images[0] && <img src={preview.images[0]} alt="" className="w-24 h-24 object-cover rounded-lg" />}
      <div className="min-w-0">
        <p className="font-semibold break-words">{preview.name}</p>
        <p className="text-sm text-gray-500">ID {preview.aliexpressId} · FX {preview.fx}</p>
        {preview.duplicateOfProductId && <p className="text-sm text-amber-700">Ya importado (producto {preview.duplicateOfProductId}).</p>}
      </div>
    </div>
    <div className="grid sm:grid-cols-3 gap-2 text-sm">
      <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500">Costo producto</p>
        <p className="font-semibold">{preview.costUsdCents === null ? 'Desconocido' : `$${(preview.costUsdCents / 100).toFixed(2)} USD`}</p></div>
      <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500">Envío</p>
        <p className="font-semibold">{preview.shippingUnknown ? 'No informado' : `$${((preview.shippingUsdCents ?? 0) / 100).toFixed(2)} USD`}</p></div>
      <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500">Precio venta (CLP)</p>
        <p className="font-semibold">{preview.salePriceClp === null ? '—' : `$${preview.salePriceClp.toLocaleString('es-CL')}`}</p></div>
    </div>
    <div>
      <p className="text-sm font-medium mb-1">Variantes ({preview.variants.length})</p>
      <div className="max-h-48 overflow-auto text-sm space-y-1">
        {preview.variants.map(v => <div key={v.supplierVariantId} className="flex justify-between gap-2 border-b py-1">
          <span className="truncate">{v.attributes.map(a => a.value).join(' / ') || v.supplierVariantId}</span>
          <span className="text-gray-500 whitespace-nowrap">{v.costUsd === null ? '—' : `$${v.costUsd.toFixed(2)}`} · {v.stockKnown ? `${v.stock} u.` : 'stock n/d'}</span>
        </div>)}
      </div>
    </div>
  </div>;
}

export default function AdminAliExpress() {
  const { user, status } = useAuthStore();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmAccount, setConfirmAccount] = useState<string | null>(null);
  // Import panel state
  const [searchKeywords, setSearchKeywords] = useState('');
  const [searchResults, setSearchResults] = useState<{ productId: string; subject: string; image_url?: string; price?: string }[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [margin, setMargin] = useState(100);
  const [customMargin, setCustomMargin] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [bulkUrls, setBulkUrls] = useState('');
  const [job, setJob] = useState<ImportJob | null>(null);
  const isAdmin = status === 'authenticated' && user?.role === 'ADMIN';
  const effectiveMargin = customMargin !== '' ? Number(customMargin) : margin;

  async function reload() {
    setBusy(true); setError('');
    try { setConnection((await api.get<ConnectionStatus>('/admin/aliexpress/status')).data); }
    catch { setError('No fue posible consultar AliExpress. Comprueba tu sesion y la conexion con el servidor.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (isAdmin) void reload(); }, [isAdmin]);

  async function search() {
    setBusy(true); setError('');
    try {
      const data = await api.post<{ result: { item_id: string; subject: string; image_url?: string; price?: string }[] }>(
        '/admin/aliexpress/dropship/search', { keywords: searchKeywords });
      setSearchResults(data.data.result.map(item => ({
        productId: String(item.item_id), subject: item.subject, image_url: item.image_url, price: item.price })));
    } catch { setError('Busqueda no disponible.'); }
    finally { setBusy(false); }
  }

  async function doPreview(url: string) {
    setBusy(true); setError(''); setPreview(null);
    try {
      const data = await api.post<ImportPreview>('/admin/aliexpress/dropship/import/preview',
        { url, marginPercent: effectiveMargin });
      setPreview(data.data);
      setImportUrl(url);
    } catch { setError('No fue posible obtener la vista previa del producto.'); }
    finally { setBusy(false); }
  }

  async function publish(publishFlag: boolean) {
    if (!preview) return;
    setBusy(true); setError('');
    try {
      await api.post('/admin/aliexpress/dropship/import/publish',
        { categoryId, marginPercent: effectiveMargin, publish: publishFlag, preview });
      setMessage(publishFlag ? 'Producto publicado.' : 'Producto guardado como borrador.');
      setPreview(null);
    } catch { setError('No fue posible publicar el producto.'); }
    finally { setBusy(false); }
  }

  async function startBulkImport() {
    const urls = bulkUrls.split(/\s+/).map(u => u.trim()).filter(Boolean);
    if (!urls.length) { setError('Ingresa al menos una URL.'); return; }
    setBusy(true); setError('');
    try {
      const data = await api.post<{ id: string }>('/admin/aliexpress/dropship/import/jobs',
        { urls, marginPercent: effectiveMargin, categoryId: categoryId || null });
      const jobId = data.data.id;
      setMessage(`Cola creada (${jobId}). Procesando...`);
      setBulkUrls('');
      const poll = window.setInterval(async () => {
        try {
          const status = await api.get<ImportJob>(`/admin/aliexpress/dropship/import/jobs/${jobId}`);
          setJob(status.data);
          if (status.data.status === 'DONE') { window.clearInterval(poll); setMessage('Importacion masiva terminada.'); }
        } catch { window.clearInterval(poll); }
      }, 2000);
    } catch { setError('No fue posible crear la cola de importacion.'); }
    finally { setBusy(false); }
  }

  async function retryItem(itemId: string) {
    setBusy(true); setError('');
    try { await api.post(`/admin/aliexpress/dropship/import/items/${itemId}/retry`, {}); setMessage('Item reencolado.'); }
    catch { setError('No fue posible reencolar el item.'); }
    finally { setBusy(false); }
  }

  async function disconnect(account: string) {
    setBusy(true); setError('');
    try {
      await api.post('/admin/aliexpress/disconnect', { account }, { headers: { 'x-yesyes-admin': '1' } });
      setConfirmAccount(null);
      await reload();
    } catch { setError('No fue posible desconectar la cuenta.'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return <p role="status">Comprobando sesion...</p>;
  if (!isAdmin) return <Navigate to="/login" replace />;
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900">AliExpress</h1>
        <p className="text-sm text-gray-500">Dropshipping: busqueda, importacion y sincronizacion</p></div>
      <button disabled={busy} onClick={() => void reload()} className="flex items-center gap-2 bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">
        <RefreshCw size={16} /> Actualizar estado
      </button>
    </div>
    {error && <p role="alert" className="bg-red-50 text-red-800 p-4 rounded-xl">{error}</p>}
    {message && <p role="status" className="bg-green-50 text-green-800 p-4 rounded-xl">{message}</p>}
    {connection && !connection.configured && <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-900">
      <h2 className="font-semibold flex gap-2 items-center"><ShieldAlert size={20} /> Credenciales backend no configuradas</h2>
      <p className="mt-2 text-sm">Define ALIEXPRESS_APP_KEY y ALIEXPRESS_APP_SECRET como variables de entorno del backend. No las ingreses en esta pantalla.</p>
    </div>}
    {connection && <div className="grid sm:grid-cols-3 gap-4">
      {[
        ['Credenciales backend', connection.configured ? 'Configuradas' : 'Falta configuracion'],
        ['Ejecucion de ordenes', connection.orderExecutionEnabled ? 'Habilitada (env)' : 'Bloqueada (env)'],
        ['Cuentas autorizadas', String(connection.accounts.filter(a => a.isActive).length)],
      ].map(([label, value]) => <div key={label} className="bg-white border rounded-xl p-5"><p className="text-sm text-gray-500">{label}</p><p className="font-semibold mt-2">{value}</p></div>)}
    </div>}

    <section className="bg-white border rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Search size={18} /> Buscar en AliExpress</h2>
      <div className="flex gap-2">
        <input value={searchKeywords} onChange={e => setSearchKeywords(e.target.value)}
          placeholder="Palabras clave" className="flex-1 border rounded-lg px-3 py-2" />
        <button disabled={busy || !searchKeywords.trim()} onClick={() => void search()}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Buscar</button>
      </div>
      {searchResults.length > 0 && <div className="space-y-2">
        {searchResults.map(item => <div key={item.productId} className="flex items-center gap-3 border rounded-lg p-3">
          {item.image_url && <img src={item.image_url} alt="" className="w-12 h-12 object-cover rounded" />}
          <span className="flex-1 truncate text-sm">{item.subject}</span>
          {item.price && <span className="text-sm text-gray-500">${item.price}</span>}
          <button onClick={() => void doPreview(`https://es.aliexpress.com/item/${item.productId}.html`)}
            className="text-sm underline">Previsualizar</button>
        </div>)}
      </div>}
    </section>

    <section className="bg-white border rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Upload size={18} /> Importar producto</h2>
      <div className="flex gap-2">
        <input value={importUrl} onChange={e => setImportUrl(e.target.value)}
          placeholder="URL de producto AliExpress" className="flex-1 border rounded-lg px-3 py-2" />
        <button disabled={busy || !importUrl.trim()} onClick={() => void doPreview(importUrl)}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Vista previa</button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-500">Margen:</span>
        {MARGINS.map(m => <button key={m} onClick={() => { setMargin(m); setCustomMargin(''); }}
          className={`text-sm px-3 py-1 rounded-full border ${!customMargin && margin === m ? 'bg-gray-900 text-white' : ''}`}>{m}%</button>)}
        <input value={customMargin} onChange={e => setCustomMargin(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Personalizado" className="w-28 border rounded-lg px-3 py-1 text-sm" />
      </div>
      <input value={categoryId} onChange={e => setCategoryId(e.target.value)}
        placeholder="ID de categoria YesYes" className="border rounded-lg px-3 py-2 w-full" />
      {preview && <PreviewCard preview={preview} />}
      {preview && <div className="flex gap-3">
        <button disabled={busy || !categoryId.trim() || Boolean(preview.duplicateOfProductId)} onClick={() => void publish(false)}
          className="border rounded-lg px-4 py-2 disabled:opacity-50">Guardar borrador</button>
        <button disabled={busy || !categoryId.trim() || Boolean(preview.duplicateOfProductId)} onClick={() => void publish(true)}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Publicar</button>
      </div>}
    </section>

    <section className="bg-white border rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><PackageCheck size={18} /> Importacion masiva</h2>
      <textarea value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} rows={4}
        placeholder="Una URL por linea (maximo 50)" className="w-full border rounded-lg px-3 py-2" />
      <button disabled={busy || !bulkUrls.trim() || !categoryId.trim()} onClick={() => void startBulkImport()}
        className="bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Encolar importacion</button>
      {job && <div className="border rounded-lg p-3 text-sm space-y-2">
        <p>Progreso: {job.processed}/{job.total} · OK {job.succeeded} · Fallos {job.failed} · Estado {job.status}</p>
        <div className="space-y-1 max-h-40 overflow-auto">
          {job.items.map(item => <div key={item.id} className="flex justify-between gap-2 border-b py-1">
            <span className="truncate">{item.sourceUrl}</span>
            <span className={item.status === 'DONE' ? 'text-green-700' : item.status === 'FAILED' ? 'text-red-700' : 'text-gray-500'}>
              {item.status}{item.status === 'FAILED' && <button onClick={() => void retryItem(item.id)} className="underline ml-2">Reintentar</button>}
            </span>
          </div>)}
        </div>
      </div>}
    </section>

    {connection && <section className="bg-white border rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-4">Cuentas guardadas</h2>
      {!connection.accounts.length && <p className="text-gray-500">No hay autorizaciones guardadas.</p>}
      <div className="space-y-4">{connection.accounts.map(account => <div key={account.account} className="border rounded-lg p-4">
        <p className="font-medium break-all">{account.account}</p>
        <p className="text-sm text-gray-600">{!account.isActive ? 'Desconectada localmente' : account.tokenUnexpired ? 'Token no vencido; acceso remoto no verificado' : 'Token vencido'}</p>
        <p className="text-sm text-gray-600">Vencimiento: {new Date(account.expiresAt).toLocaleString('es-CL')}</p>
        {account.isActive && (confirmAccount === account.account ? <div className="mt-3 flex gap-3 items-center">
          <span className="text-sm">¿Desconectar en YesYes?</span>
          <button disabled={busy} onClick={() => void disconnect(account.account)} className="text-red-700 underline">Confirmar</button>
          <button disabled={busy} onClick={() => setConfirmAccount(null)} className="underline">Cancelar</button>
        </div> : <button disabled={busy} onClick={() => setConfirmAccount(account.account)} className="flex gap-2 items-center text-red-700 mt-3"><Unplug size={16} /> Desconectar</button>)}
      </div>)}</div>
      <p className="text-xs text-gray-500 mt-4">La desconexion local no revoca la autorizacion en AliExpress. Los tokens nunca se envian a esta pagina.</p>
    </section>}
  </div>;
}
