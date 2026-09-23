import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { myBusinesses, createBusiness, getBusiness, updateBusiness, uploadBusinessImage, saveGallery as persistGallery, type UploadKind } from '@/services/business';
import { getMercadoPagoStatus, startMercadoPagoConnection, disconnectMercadoPago, type MercadoPagoStatus } from '@/services/mercadoPago';

const CATS = ['HAIR','BARBER','BAKERY','FLOWERS','FOOD','BOUTIQUE','FURNITURE','REAL_ESTATE','MECHANIC','PHONE','CLEANING','PHOTO','TUTORING','CONSTRUCTION','BEAUTY','PET','DETAILING'];

type GalleryItem = { url: string; alt?: string | null };

export default function BusinessDashboard() {
  const { token } = useAuthStore();
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HAIR');
  const [msg, setMsg] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', phone: '', whatsapp: '', address: '', city: '' });
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [mpStatus, setMpStatus] = useState<MercadoPagoStatus | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpMsg, setMpMsg] = useState('');

  useEffect(() => { myBusinesses().then(setList).catch(() => setMsg('Inicia sesión para ver tus negocios')); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpConnected = params.get('mp_connected');
    const mpError = params.get('mp_error');
    if (mpConnected || mpError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      if (selectedId) {
        refreshMpStatus(selectedId);
        if (mpConnected === 'true') setMpMsg('Mercado Pago conectado correctamente');
        else if (mpError) setMpMsg(`Error de conexión: ${decodeURIComponent(mpError)}`);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    getBusiness(selectedId).then((b) => {
      setDetail(b);
      setForm({
        name: b.name || '', slug: b.slug || '', description: b.description || '',
        phone: b.phone || '', whatsapp: b.whatsapp || '', address: b.address || '', city: b.city || '',
      });
      setGallery(Array.isArray(b.gallery) ? b.gallery : []);
      setMsg('');
    }).catch(() => setMsg('No se pudo cargar el negocio'));
    refreshMpStatus(selectedId);
  }, [selectedId]);

  const refreshMpStatus = async (businessId: string) => {
    try {
      const status = await getMercadoPagoStatus(businessId);
      setMpStatus(status);
      setMpMsg('');
    } catch {
      setMpStatus(null);
    }
  };

  const handleConnect = async () => {
    if (!selectedId) return;
    setMpLoading(true);
    setMpMsg('');
    try {
      const { authorizationUrl } = await startMercadoPagoConnection(selectedId);
      window.location.href = authorizationUrl;
    } catch (e: any) {
      setMpMsg(e?.response?.data?.message || 'Error al iniciar conexión');
    } finally {
      setMpLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedId) return;
    setMpLoading(true);
    setMpMsg('');
    try {
      await disconnectMercadoPago(selectedId);
      setMpStatus({ connected: false, status: 'NOT_CONNECTED' });
      setMpMsg('Mercado Pago desconectado');
    } catch (e: any) {
      setMpMsg(e?.response?.data?.message || 'Error al desconectar');
    } finally {
      setMpLoading(false);
    }
  };

  const saveGallery = async (next: GalleryItem[]) => {
    if (!selectedId) return;
    setGallery(next);
    setBusy(true);
    try {
      await persistGallery(selectedId, next.map((g) => ({ url: g.url, alt: g.alt ?? null })));
      setMsg('Galería guardada');
    } catch {
      setMsg('Error guardando galería');
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (kind: UploadKind, file: File | undefined) => {
    if (!file || !selectedId) return;
    setBusy(true);
    try {
      const url = await uploadBusinessImage(selectedId, kind, file);
      if (kind === 'gallery') {
        await saveGallery([...gallery, { url }]);
      } else {
        const updated = await updateBusiness(selectedId, kind === 'logo' ? { logo: url } : { cover: url });
        setDetail((d: any) => ({ ...d, ...updated }));
        setList((l) => l.map((b) => (b.id === selectedId ? { ...b, ...updated } : b)));
      }
      setMsg('Imagen subida');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Error subiendo imagen (max 5MB, JPG/PNG/WEBP)');
    } finally {
      setBusy(false);
    }
  };

  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    try {
      const updated = await updateBusiness(selectedId, form);
      setDetail((d: any) => ({ ...d, ...updated }));
      setList((l) => l.map((b) => (b.id === selectedId ? { ...b, ...updated } : b)));
      setMsg('Negocio actualizado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error guardando (¿slug duplicado?)');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED') => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const updated = await updateBusiness(selectedId, { status } as any);
      setDetail((d: any) => ({ ...d, ...updated }));
      setList((l) => l.map((b) => (b.id === selectedId ? { ...b, ...updated } : b)));
      setMsg(status === 'PUBLISHED' ? 'Negocio publicado' : 'Estado actualizado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error actualizando estado');
    } finally {
      setBusy(false);
    }
  };

  const checks = detail
    ? [
        { label: 'Nombre', ok: Boolean(detail.name) },
        { label: 'Descripción', ok: Boolean(detail.description) },
        { label: 'WhatsApp', ok: Boolean(detail.whatsapp) },
        { label: 'Dirección', ok: Boolean(detail.address) },
        { label: 'Logo', ok: Boolean(detail.logo) },
        { label: 'Portada', ok: Boolean(detail.cover) },
      ]
    : [];
  const pct = checks.length ? Math.round((checks.filter((c) => c.ok).length / checks.length) * 100) : 0;

  if (!token) return <div className="p-8">Debes iniciar sesión.</div>;

  const mpConnected = mpStatus?.connected === true;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Mis negocios</h1>
      <form
        className="bg-white border rounded-xl p-4 grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const b = await createBusiness({ name, category });
            setList([b, ...list]);
            setName('');
            setMsg('Negocio creado');
          } catch { setMsg('Error creando negocio'); }
        }}
      >
        <input className="border rounded-lg px-3 py-2" placeholder="Nombre del negocio" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="border rounded-lg px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="bg-black text-white rounded-lg px-4 py-2" type="submit">Crear negocio</button>
        {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      </form>
      <div className="grid gap-3">
        {list.map((b) => (
          <div key={b.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{b.name}</p>
              <p className="text-sm text-neutral-500">/{b.slug} · {b.status}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button className="underline" onClick={() => setSelectedId(b.id)} type="button">Editar</button>
              <a className="underline" href={`/mi-negocio/${b.slug}`} target="_blank" rel="noreferrer">Ver página</a>
            </div>
          </div>
        ))}
        {!list.length && <p className="text-neutral-500">Aún no tienes negocios.</p>}
      </div>

      {selectedId && detail && (
        <section className="bg-white border rounded-xl p-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{detail.name || 'Editar negocio'}</h2>
              <p className="text-sm text-neutral-500">
                /mi-negocio/{detail.slug} · Estado: <strong>{detail.status}</strong> · Completado: {pct}%
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {detail.status !== 'PUBLISHED' && (
                <button type="button" disabled={busy} onClick={() => setStatus('PUBLISHED')} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">Publicar</button>
              )}
              {detail.status === 'PUBLISHED' && (
                <button type="button" disabled={busy} onClick={() => setStatus('PAUSED')} className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">Pausar</button>
              )}
              {detail.status === 'PAUSED' && (
                <button type="button" disabled={busy} onClick={() => setStatus('PUBLISHED')} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">Reanudar</button>
              )}
              <button type="button" className="underline" onClick={() => { setSelectedId(null); setDetail(null); setMsg(''); setMpStatus(null); }}>Cerrar</button>
            </div>
          </div>

          {mpMsg && (
            <p className={`text-sm ${mpMsg.includes('Error') || mpMsg.includes('error') ? 'text-red-600' : 'text-green-700'}`}>{mpMsg}</p>
          )}

          <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Mercado Pago</h3>
              {mpConnected ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Conectado</span>
              ) : (
                <span className="text-xs bg-neutral-200 text-neutral-600 px-2 py-1 rounded-full">No conectado</span>
              )}
            </div>
            {mpConnected && mpStatus?.mpUserId && (
              <p className="text-xs text-neutral-500">ID de cuenta: {mpStatus.mpUserId}</p>
            )}
            {mpConnected && mpStatus?.expiresAt && (
              <p className="text-xs text-neutral-500">Expira: {new Date(mpStatus.expiresAt).toLocaleDateString()}</p>
            )}
            {mpConnected ? (
              <button
                type="button"
                disabled={mpLoading}
                onClick={handleDisconnect}
                className="bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                {mpLoading ? 'Desconectando…' : 'Desconectar Mercado Pago'}
              </button>
            ) : (
              <button
                type="button"
                disabled={mpLoading}
                onClick={handleConnect}
                className="bg-black hover:bg-neutral-800 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                {mpLoading ? 'Conectando…' : 'Conectar Mercado Pago'}
              </button>
            )}
          </div>

          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className={`rounded-lg px-3 py-2 border ${c.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-neutral-50 text-neutral-500'}`}>
                {c.ok ? '✓' : '○'} {c.label}
              </li>
            ))}
          </ul>

          <form onSubmit={saveInfo} className="grid gap-2 sm:grid-cols-2">
            <input className="border rounded-lg px-3 py-2" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="border rounded-lg px-3 py-2" placeholder="Slug (url)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <textarea className="border rounded-lg px-3 py-2 sm:col-span-2" rows={4} placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50 sm:col-span-2" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar información'}</button>
          </form>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <label className="border border-dashed rounded-xl px-3 py-3 text-center cursor-pointer hover:bg-neutral-50">
              🖼️ Subir logo
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pickImage('logo', e.target.files?.[0])} />
            </label>
            <label className="border border-dashed rounded-xl px-3 py-3 text-center cursor-pointer hover:bg-neutral-50">
              🖼️ Subir portada
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pickImage('cover', e.target.files?.[0])} />
            </label>
            <label className="border border-dashed rounded-xl px-3 py-3 text-center cursor-pointer hover:bg-neutral-50">
              🖼️ Agregar a galería
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pickImage('gallery', e.target.files?.[0])} />
            </label>
          </div>

          {!!gallery?.length && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Galería ({gallery.length})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {gallery.map((g, i) => (
                  <div key={`${g.url}-${i}`} className="relative group">
                    <img src={g.url} alt={g.alt || ''} className="w-full h-24 object-cover rounded-lg" loading="lazy" />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveGallery(gallery.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>
      )}
    </div>
  );
}
