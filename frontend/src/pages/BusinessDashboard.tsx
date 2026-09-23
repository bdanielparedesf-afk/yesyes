import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { myBusinesses, createBusiness, getBusiness, updateBusiness } from '@/services/business';
import DashboardNav, { type DashboardSection } from '@/business/dashboard/DashboardNav';
import ConfigSection, { CATS } from '@/business/dashboard/ConfigSection';
import ServicesSection from '@/business/dashboard/ServicesSection';
import ProductsSection from '@/business/dashboard/ProductsSection';
import PropertiesSection from '@/business/dashboard/PropertiesSection';
import GallerySection from '@/business/dashboard/GallerySection';
import LeadsSection from '@/business/dashboard/LeadsSection';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

/**
 * Shell del dashboard Business. Secciones via rutas:
 * /negocio, /negocio/configuracion, /negocio/servicios, /negocio/productos,
 * /negocio/propiedades, /negocio/galeria, /negocio/leads
 * El negocio activo se mantiene en ?id=.
 */
export default function BusinessDashboard({ section = 'inicio' }: { section?: DashboardSection }) {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const [list, setList] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [msg, setMsg] = useState('');
  const [mpMsg, setMpMsg] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HAIR');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setLoadingList(false); return; }
    setLoadingList(true);
    myBusinesses()
      .then(setList)
      .catch(() => setMsg('No se pudieron cargar tus negocios'))
      .finally(() => setLoadingList(false));
  }, [token]);

  // Callback de Mercado Pago: limpia los query params y muestra el resultado.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('mp_connected');
    const error = params.get('mp_error');
    if (connected || error) {
      params.delete('mp_connected');
      params.delete('mp_error');
      const qs = params.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (qs ? `?${qs}` : ''));
      if (connected === 'true') setMpMsg('Mercado Pago conectado correctamente');
      else if (error) setMpMsg(`Error de conexión: ${decodeURIComponent(error)}`);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let alive = true;
    getBusiness(selectedId)
      .then((b) => { if (alive) setDetail(b); })
      .catch(() => { if (alive) setMsg('No se pudo cargar el negocio'); });
    return () => { alive = false; };
  }, [selectedId]);

  const selectBusiness = (id: string, target?: string) => {
    navigate(`${target || '/negocio/configuracion'}?id=${id}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const b = await createBusiness({ name: name.trim(), category });
      setList((l) => [b, ...l]);
      setName('');
      setMsg(`Negocio "${b.name}" creado. Ahora completa su configuración.`);
      selectBusiness(b.id);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error creando el negocio');
    } finally {
      setBusy(false);
    }
  };

  const quickStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      await updateBusiness(id, { status } as any);
      setList((l) => l.map((b) => (b.id === id ? { ...b, status } : b)));
      if (selectedId === id) setDetail((d: any) => (d ? { ...d, status } : d));
      setMsg('Estado actualizado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error actualizando estado');
    } finally {
      setBusy(false);
    }
  };
  if (!token) return <div className="p-8 text-center text-neutral-600">Debes iniciar sesión para gestionar tus negocios.</div>;

  const renderList = (compact = false) => (
    loadingList ? (
      <div className="grid gap-2">
        {[0, 1].map((i) => <div key={i} className="h-20 bg-neutral-200 rounded-xl animate-pulse" />)}
      </div>
    ) : !list.length ? (
      <p className="bg-white border rounded-xl p-6 text-sm text-neutral-500 text-center">
        Aún no tienes negocios. Crea el primero con el formulario{compact ? ' superior' : ''}.
      </p>
    ) : (
      <ul className="grid gap-2">
        {list.map((b) => (
          <li key={b.id} className="bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{b.name}</p>
              <p className="text-xs text-neutral-500">
                /mi-negocio/{b.slug} · {b.category}{' '}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[b.status] || ''}`}>
                  {b.status}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" className="underline" onClick={() => selectBusiness(b.id)}>Editar</button>
              <a className="underline" href={`/mi-negocio/${b.slug}?preview=true`} target="_blank" rel="noreferrer">Vista previa</a>
              {b.status !== 'PUBLISHED' && b.status !== 'ARCHIVED' && (
                <button type="button" className="underline text-green-700" disabled={busy}
                  onClick={() => quickStatus(b.id, 'PUBLISHED')}>Publicar</button>
              )}
              {b.status === 'PUBLISHED' && (
                <button type="button" className="underline text-amber-600" disabled={busy}
                  onClick={() => quickStatus(b.id, 'PAUSED')}>Pausar</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )
  );

  const needsBusiness = section !== 'inicio' && (!selectedId || !detail);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Panel de negocios</h1>
        {detail && (
          <p className="text-sm text-neutral-500">
            <span className="font-semibold text-neutral-800">{detail.name}</span>
            {' · '}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[detail.status] || ''}`}>
              {detail.status}
            </span>
          </p>
        )}
      </div>

      <DashboardNav section={section} businessId={selectedId} />

      {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      {mpMsg && <p className="text-sm text-green-700">{mpMsg}</p>}

      {section === 'inicio' ? (
        <>
          <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="border rounded-lg px-3 py-2" placeholder="Nombre del nuevo negocio (ej: Peluquería Luna)"
              value={name} onChange={(e) => setName(e.target.value)} required
            />
            <select className="border rounded-lg px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50" type="submit" disabled={busy}>
              {busy ? 'Creando…' : 'Crear negocio'}
            </button>
          </form>
          {renderList()}
        </>
      ) : needsBusiness ? (
        <div className="space-y-4">
          <p className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            Selecciona un negocio para gestionar esta sección.
          </p>
          {renderList(true)}
        </div>
      ) : detail && selectedId ? (
        <>
          {section === 'configuracion' && (
            <ConfigSection
              businessId={selectedId}
              detail={detail}
              onSaved={(u) => setDetail((d: any) => ({ ...d, ...u }))}
            />
          )}
          {section === 'servicios' && <ServicesSection businessId={selectedId} />}
          {section === 'productos' && <ProductsSection businessId={selectedId} />}
          {section === 'propiedades' && <PropertiesSection businessId={selectedId} />}
          {section === 'galeria' && <GallerySection businessId={selectedId} />}
          {section === 'leads' && <LeadsSection businessId={selectedId} />}
        </>
      ) : (
        <div className="h-40 bg-neutral-200 rounded-xl animate-pulse" />
      )}
    </div>
  );
}