import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, Unplug, PlugZap, ShieldAlert, Search, Upload, PackageCheck } from 'lucide-react';
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
  quantity: number; selectedSkuId?: string;
  shippingStatus: 'AVAILABLE' | 'FREE' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_ERROR' | 'UNKNOWN';
  shippingSource: 'ALIEXPRESS' | 'MANUAL' | 'NONE'; shippingMessage: string;
  fxRate: number; fxSource: string;
  taxUsdCents: number | null; otherUsdCents: number | null; totalUsdCents: number | null;
  acquisition: { productCostUsdCents: number | null };
  wholesaleTiers: { minQuantity: string; price: string }[];
}
interface ImportJob {
  id: string; status: string; total: number; processed: number; succeeded: number; failed: number;
  items: { id: string; sourceUrl: string; aliexpressId: string | null; status: string;
    attempts: number; createdProductId: string | null; error: string | null }[];
}
interface SyncSettingsData {
  id: string; enabled: boolean; intervalMinutes: number;
  stalePricePolicy: 'AUTO_UPDATE' | 'REQUIRE_REVIEW' | 'BLOCK_ORDER';
  noQuotePolicy: string; batchSize: number;
  lastRunAt: string | null; lastCursor: string | null;
}
interface SyncStatsData {
  settings: SyncSettingsData; lastRunAt: string | null; nextRunAt: string | null;
  affectedProducts: number; errors: number; noShippingQuote: number;
  totalImported: number; priceChanges: number; stockChanges: number;
}
interface SyncLogData {
  id: string; productId: string | null; aliexpressId: string; skuId: string | null;
  status: string; costBeforeUsd: number | null; costAfterUsd: number | null;
  stockBefore: number | null; stockAfter: number | null;
  shippingBeforeUsdCents: number | null; shippingAfterUsdCents: number | null;
  shippingStatus: string | null; error: string | null; createdAt: string;
}

const MARGINS = [50, 100, 150, 200, 250, 300, 350, 400];

function PreviewCard({ preview }: { preview: ImportPreview }) {
  return <div className="border rounded-xl p-4 space-y-3">
    <div className="flex gap-4">
      {preview.images[0] && <img src={preview.images[0]} alt="" className="w-24 h-24 object-cover rounded-lg" />}
      <div className="min-w-0">
        <p className="font-semibold break-words">{preview.name}</p>
        <p className="text-sm text-gray-500">ID {preview.aliexpressId} · SKU {preview.selectedSkuId} · Cantidad {preview.quantity}</p>
        <p className="text-sm text-gray-500">FX USD → CLP: {preview.fxRate} · {preview.fxSource}</p>
        {preview.duplicateOfProductId && <p className="text-sm text-amber-700">Ya importado (producto {preview.duplicateOfProductId}).</p>}
      </div>
    </div>
    <div className="grid sm:grid-cols-3 gap-2 text-sm">
      {[
        ['Producto (cantidad cotizada)', preview.acquisition.productCostUsdCents],
        ['Envío AliExpress a Chile', preview.shippingUsdCents],
        ['Impuestos informados', preview.taxUsdCents],
        ['Otros cargos informados', preview.otherUsdCents],
        ['Costo total de adquisición estimado', preview.totalUsdCents],
      ].map(([label, cents]) => <div key={String(label)} className="bg-gray-50 rounded-lg p-3">
        <p className="text-gray-500">{label}</p>
        <p className="font-semibold">{typeof cents === 'number' ? `$${(cents / 100).toFixed(2)} USD` : 'No informado'}</p>
      </div>)}
      <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500">Precio venta (CLP)</p>
        <p className="font-semibold">{preview.salePriceClp === null ? '—' : `$${preview.salePriceClp.toLocaleString('es-CL')}`}</p></div>
    </div>
    <p className="text-sm">Fuente envío: <strong>{preview.shippingSource}</strong> · Estado: {preview.shippingStatus}</p>
    {preview.shippingUnknown && <p className="text-sm text-amber-700">AliExpress no proporcionó costo de envío para esta variante/destino.</p>}
    {preview.shippingSource === 'MANUAL' && <p className="text-sm text-amber-700">Envío ingresado manualmente; no confirmado por AliExpress.</p>}
    <p className="text-xs text-gray-500">Los cargos no informados no se presumen cero ni se añaden al estimado. No es una cotización de checkout.</p>
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
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [manualShippingUsd, setManualShippingUsd] = useState('');
  const [quotedKey, setQuotedKey] = useState('');
  const [margin, setMargin] = useState(100);
  const [customMargin, setCustomMargin] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [bulkUrls, setBulkUrls] = useState('');
  const [job, setJob] = useState<ImportJob | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStatsData | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogData[] | null>(null);
  const [syncInterval, setSyncInterval] = useState('60');
  const isAdmin = status === 'authenticated' && user?.role === 'ADMIN';
  const effectiveMargin = customMargin !== '' ? Number(customMargin) : margin;
  const quoteKey = (url: string) => JSON.stringify([url.trim(), selectedSkuId.trim(), quantity,
    provinceCode.trim(), cityCode.trim(), postalCode.trim(), manualShippingUsd, effectiveMargin]);
  const quoteStale = quotedKey !== quoteKey(importUrl);

  async function reload() {
    setBusy(true); setError('');
    try { setConnection((await api.get<ConnectionStatus>('/admin/aliexpress/status')).data); }
    catch { setError('No fue posible consultar AliExpress. Comprueba tu sesion y la conexion con el servidor.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (isAdmin) void reload(); }, [isAdmin]);
  useEffect(() => { if (isAdmin) void loadSync(); }, [isAdmin]);

  async function loadSync() {
    setBusy(true); setError('');
    try {
      const stats = (await api.get<SyncStatsData>('/admin/aliexpress/dropship/sync-stats')).data;
      setSyncStats(stats);
      setSyncInterval(String(stats.settings.intervalMinutes));
    } catch { setError('No fue posible leer la configuración de sincronización.'); }
    finally { setBusy(false); }
  }
  async function runSyncNow() {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api.post<{ processed: number; changed: number; errors: number }>(
        '/admin/aliexpress/dropship/sync-run', {});
      setMessage(`Sincronización completada: ${result.data.processed} productos, ${result.data.changed} con cambios, ${result.data.errors} errores.`);
      await loadSync();
    } catch { setError('La sincronización falló; revisa los logs del backend.'); }
    finally { setBusy(false); }
  }
  async function saveSyncInterval() {
    setBusy(true); setError('');
    try {
      await api.put('/admin/aliexpress/dropship/sync-settings', { intervalMinutes: Number(syncInterval) });
      setMessage('Intervalo de sincronización guardado.');
      await loadSync();
    } catch { setError('Intervalo inválido. Permitidos: 30 min, 1 h, 6 h, 12 h, diario.'); }
    finally { setBusy(false); }
  }
  async function loadSyncHistory() {
    setBusy(true); setError('');
    try { setSyncLogs((await api.get<SyncLogData[]>('/admin/aliexpress/dropship/sync-logs', { params: { take: 50 } })).data); }
    catch { setError('No fue posible leer el historial de sincronización.'); }
    finally { setBusy(false); }
  }


  // Reads the OAuth landing result once. The callback never places a token or authorization
  // code in the URL, so nothing sensitive is parsed, stored, or rendered here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('aliexpress');
    if (!result) return;
    const reason = params.get('code') || '';
    window.history.replaceState({}, '', window.location.pathname);
    if (result === 'connected') {
      setMessage('AliExpress conectado. Autorizacion OAuth verificada y tokens guardados cifrados.');
    } else {
      setError(`No fue posible completar la reconexion OAuth. La cuenta permanece desconectada.`
        + (/^[A-Z_]{3,40}$/.test(reason) ? ` Motivo: ${reason}.` : ''));
    }
  }, []);

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
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 10000
      || !Number.isInteger(effectiveMargin) || effectiveMargin < 0 || effectiveMargin > 10000
      || (manualShippingUsd !== '' && (!Number.isFinite(Number(manualShippingUsd)) || Number(manualShippingUsd) < 0))) {
      setError('Revisa cantidad, margen y costo de envío.'); return;
    }
    const key = quoteKey(url);
    setBusy(true); setError(''); setPreview(null);
    try {
      const data = await api.post<ImportPreview>('/admin/aliexpress/dropship/import/preview', {
        url, marginPercent: effectiveMargin, quantity: Number(quantity), countryCode: 'CL',
        ...(selectedSkuId.trim() ? { selectedSkuId: selectedSkuId.trim() } : {}),
        ...(provinceCode.trim() ? { provinceCode: provinceCode.trim() } : {}),
        ...(cityCode.trim() ? { cityCode: cityCode.trim() } : {}),
        ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
        ...(manualShippingUsd !== '' ? { manualShippingUsd: Number(manualShippingUsd) } : {}),
      });
      setPreview(data.data);
      setQuotedKey(key);
      setImportUrl(url);
    } catch { setError('No fue posible obtener la vista previa del producto.'); }
    finally { setBusy(false); }
  }

  async function publish(publishFlag: boolean) {
    if (!preview || quoteStale || preview.shippingUnknown || preview.salePriceClp === null) return;
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

  /** Redeems the official authorization code server-side; only the OAuth URL reaches the browser. */
  async function reconnect(account: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data: payload } = await api.post<{ authorizationUrl: string }>('/admin/aliexpress/oauth/connect',
        { account }, { headers: { 'x-yesyes-admin': '1' } });
      if (!payload?.authorizationUrl) {
        setError('AliExpress no devolvió una URL de autorización.');
        setBusy(false);
        return;
      }
      window.location.assign(payload.authorizationUrl);
    } catch (err: any) {
      const status = err?.response?.status;
      const code = status ? ` · Código: ${status}` : '';
      setError(`No se pudo iniciar la reconexión con AliExpress.${code}`);
      setBusy(false);
    }
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
      <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-3 text-sm">
        <label>SKU (vacío: SKU de la URL o primera variante)
          <input value={selectedSkuId} onChange={e => setSelectedSkuId(e.target.value)} list="aliexpress-skus"
            className="border rounded-lg px-3 py-2 w-full" />
          <datalist id="aliexpress-skus">{preview?.variants.map(v => <option key={v.supplierVariantId}
            value={v.supplierVariantId}>{v.attributes.map(a => a.value).join(' / ')}</option>)}</datalist>
        </label>
        <label>Cantidad
          <input type="number" min="1" max="10000" step="1" value={quantity} onChange={e => setQuantity(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full" />
        </label>
        <label>Destino<input value="Chile (CL)" readOnly className="border rounded-lg px-3 py-2 w-full" /></label>
        <label>Código de provincia / región (opcional)
          <input value={provinceCode} onChange={e => setProvinceCode(e.target.value)} className="border rounded-lg px-3 py-2 w-full" />
        </label>
        <label>Código de ciudad (opcional)
          <input value={cityCode} onChange={e => setCityCode(e.target.value)} className="border rounded-lg px-3 py-2 w-full" />
        </label>
        <label>Código postal (conservado; estos métodos no lo admiten)
          <input value={postalCode} onChange={e => setPostalCode(e.target.value)} className="border rounded-lg px-3 py-2 w-full" />
        </label>
        <label>Envío manual total en USD (fallback opcional)
          <input type="number" min="0" max="1000000" step="0.01" value={manualShippingUsd}
            onChange={e => setManualShippingUsd(e.target.value)} className="border rounded-lg px-3 py-2 w-full" />
        </label>
        <p className="text-gray-500">Sólo se aplica si AliExpress no entrega freight. Se marca MANUAL y corresponde a toda la cantidad cotizada, no a cada unidad.</p>
      </fieldset>
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
            <span className="truncate" title={item.error ?? undefined}>{item.sourceUrl}</span>
            <span className={item.status === 'DONE' ? 'text-green-700' : item.status === 'FAILED' ? 'text-red-700' : 'text-gray-500'}>
              {item.status}{item.error && ` · ${item.error}`}
              {item.status === 'FAILED' && <button onClick={() => void retryItem(item.id)} className="underline ml-2">Reintentar</button>}
            </span>
          </div>)}
        </div>
      </div>}
    </section>

    <section className="bg-white border rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><RefreshCw size={18} /> Sincronización</h2>
      {syncStats && <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {[
          ['Última sincronización', syncStats.lastRunAt ? new Date(syncStats.lastRunAt).toLocaleString('es-CL') : 'Nunca'],
          ['Próxima sincronización', syncStats.nextRunAt ? new Date(syncStats.nextRunAt).toLocaleString('es-CL') : 'No programada'],
          ['Productos sincronizados', String(syncStats.totalImported)],
          ['Cambios de precio', String(syncStats.priceChanges)],
          ['Cambios de stock', String(syncStats.stockChanges)],
          ['Errores', String(syncStats.errors)],
          ['Productos sin cotización de envío', String(syncStats.noShippingQuote)],
          ['Productos afectados', String(syncStats.affectedProducts)],
        ].map(([label, value]) => <div key={label} className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500">{label}</p><p className="font-semibold mt-1">{value}</p></div>)}
      </div>}
      <div className="flex flex-wrap gap-2 items-center">
        <button disabled={busy} onClick={() => void runSyncNow()}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Sincronizar ahora</button>
        <span className="text-sm text-gray-500">Intervalo:</span>
        <select value={syncInterval} onChange={e => setSyncInterval(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          {[30, 60, 360, 720, 1440].map(m => <option key={m} value={m}>
            {m === 30 ? 'Cada 30 minutos' : m === 60 ? 'Cada 1 hora' : m === 360 ? 'Cada 6 horas'
              : m === 720 ? 'Cada 12 horas' : 'Diario'}</option>)}
        </select>
        <button disabled={busy} onClick={() => void saveSyncInterval()}
          className="border rounded-lg px-4 py-2 disabled:opacity-50">Configurar intervalo</button>
        <button disabled={busy} onClick={() => void loadSyncHistory()}
          className="border rounded-lg px-4 py-2 disabled:opacity-50">Ver historial</button>
      </div>
      {syncLogs && <div className="border rounded-lg p-3 text-sm space-y-1 max-h-72 overflow-auto">
        {!syncLogs.length && <p className="text-gray-500">Sin registros todavía.</p>}
        {syncLogs.map(log => <div key={log.id} className="border-b py-1">
          <span className="text-gray-500">{new Date(log.createdAt).toLocaleString('es-CL')} · </span>
          <span className="font-mono">{log.aliexpressId}{log.skuId ? ` / ${log.skuId}` : ''}</span>
          <span className={`ml-2 ${log.status === 'ERROR' ? 'text-red-700' : log.status === 'CHANGED' ? 'text-amber-700' : 'text-gray-500'}`}>{log.status}</span>
          {log.costBeforeUsd !== log.costAfterUsd && (log.costAfterUsd !== null || log.costBeforeUsd !== null) &&
            <span className="ml-2">precio ${log.costBeforeUsd ?? '—'} → ${log.costAfterUsd ?? '—'} USD</span>}
          {log.stockBefore !== log.stockAfter && (log.stockAfter !== null || log.stockBefore !== null) &&
            <span className="ml-2">stock {log.stockBefore ?? '—'} → {log.stockAfter ?? '—'}</span>}
          {log.shippingBeforeUsdCents !== log.shippingAfterUsdCents &&
            <span className="ml-2">envío {log.shippingBeforeUsdCents ?? '—'} → {log.shippingAfterUsdCents ?? '—'} cUSD{log.shippingStatus ? ` (${log.shippingStatus})` : ''}</span>}
        </div>)}
      </div>}
    </section>

    {connection && <section className="bg-white border rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-4">Cuentas guardadas</h2>
      {!connection.accounts.length && <p className="text-gray-500">No hay autorizaciones guardadas.</p>}
      <div className="space-y-4">{connection.accounts.map(account => <div key={account.account} className="border rounded-lg p-4">
        <p className="font-medium break-all">{account.account}</p>
        <p className={account.isActive ? 'text-sm font-medium text-green-700' : 'text-sm font-medium text-gray-600'}>
          {account.isActive ? 'AliExpress conectado' : 'AliExpress desconectado'}
        </p>
        {account.sellerId && <p className="text-sm text-gray-600">Seller ID: {account.sellerId}</p>}
        {account.isActive
          ? <>
            <p className="text-sm text-gray-600">Token válido hasta: {new Date(account.expiresAt).toLocaleString('es-CL')}</p>
            {!account.tokenUnexpired && <p className="text-sm text-amber-700">Access Token vencido; la renovación automática lo reemplazará en la próxima llamada.</p>}
          </>
          : <p className="text-sm text-gray-600">Sin autorización OAuth válida. Vuelve a autorizar en AliExpress para reactivar la cuenta.</p>}
        {account.isActive ? (confirmAccount === account.account ? <div className="mt-3 flex gap-3 items-center">
          <span className="text-sm">¿Desconectar en YesYes?</span>
          <button disabled={busy} onClick={() => void disconnect(account.account)} className="text-red-700 underline">Confirmar</button>
          <button disabled={busy} onClick={() => setConfirmAccount(null)} className="underline">Cancelar</button>
        </div> : <button disabled={busy} onClick={() => setConfirmAccount(account.account)} className="flex gap-2 items-center text-red-700 mt-3"><Unplug size={16} /> Desconectar AliExpress</button>)
          : <button disabled={busy} onClick={() => void reconnect(account.account)} className="flex gap-2 items-center bg-gray-900 text-white rounded-lg px-4 py-2 mt-3 disabled:opacity-50">
            <PlugZap size={16} /> Reconectar AliExpress
          </button>}
      </div>)}</div>
      <p className="text-xs text-gray-500 mt-4">La reconexion usa el OAuth oficial server-side: el App Secret y los tokens permanecen en el backend y solo se guardan cifrados. La desconexion local no revoca la autorizacion en AliExpress.</p>
    </section>}
  </div>;
}
