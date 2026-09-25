import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/axios';
import { myBusinesses, createBusiness, getBusiness, deleteBusiness } from '@/services/business';
import DashboardNav, { type DashboardSection } from '@/business/dashboard/DashboardNav';
import ConfigSection, { CATS } from '@/business/dashboard/ConfigSection';
import ServicesSection from '@/business/dashboard/ServicesSection';
import ProductsSection from '@/business/dashboard/ProductsSection';
import PropertiesSection from '@/business/dashboard/PropertiesSection';
import GallerySection from '@/business/dashboard/GallerySection';
import DesignSection from '@/business/dashboard/DesignSection';
import LeadsSection from '@/business/dashboard/LeadsSection';
import ContentSection from '@/business/dashboard/ContentSection';
import BookingsSection from '@/business/dashboard/BookingsSection';
import { Building2, Check, Plus } from 'lucide-react';
import { categoryLabel, categoryDescription, statusLabel } from '@/business/businessLabels';

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
  const { status, checkSession } = useAuthStore();
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
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    myBusinesses()
      .then((items) => setList(Array.from(new Map(items.filter((item) => item.status !== 'ARCHIVED').map((item) => [item.id, item])).values())))
      .catch(() => setMsg('No se pudieron cargar tus negocios'))
      .finally(() => setLoadingList(false));
  }, [status]);

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
    if (status !== 'authenticated') {
      setDetail(null);
      return;
    }
    if (!selectedId) { setDetail(null); return; }
    let alive = true;
    getBusiness(selectedId)
      .then((b) => { if (alive) setDetail(b); })
      .catch(() => { if (alive) setMsg('No se pudo cargar el negocio'); });
    return () => { alive = false; };
  }, [selectedId, status]);

  const selectBusiness = (id: string, target?: string) => {
    navigate(`${target || '/negocio/editor'}?id=${id}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const b = await createBusiness({ name: name.trim(), category });
      setList((l) => [b, ...l]);
      setName('');
      selectBusiness(b.id);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error creando el negocio');
    } finally {
      setBusy(false);
    }
  };

  const quickDelete = async (id: string, businessName: string) => {
    if (!window.confirm(`¿Eliminar “${businessName}”? Desaparecerá del panel y de la web. Los datos quedan archivados de forma segura.`)) return;
    setBusy(true);
    try {
      await deleteBusiness(id);
      setList((items) => items.filter((item) => item.id !== id));
      if (selectedId === id) { setDetail(null); navigate('/negocio'); }
      setMsg('Negocio eliminado del panel.');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'No se pudo eliminar el negocio.');
    } finally { setBusy(false); }
  };

  const quickStatus = async (id: string, action: 'publish' | 'pause') => {
    setBusy(true);
    try {
      const { data } = await api.post(`/businesses/${id}/${action}`);
      const updated = data.business;
      setList((l) => l.map((b) => (b.id === id ? { ...b, ...updated } : b)));
      if (selectedId === id) setDetail((d: any) => (d ? { ...d, ...updated } : d));
      setMsg(action === 'publish' ? 'Negocio publicado' : 'Negocio pausado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error actualizando estado');
    } finally {
      setBusy(false);
    }
  };
  if (status === 'loading') {
    return <div className="p-8 text-center text-neutral-600">Cargando sesión…</div>;
  }
  if (status === 'unauthenticated') {
    return <div className="p-8 text-center text-neutral-600">Debes iniciar sesión para gestionar tus negocios.</div>;
  }

  const subscriptionInfo = (b: any) => b.subscription
    ? `${String(b.subscription.status || 'PENDING').replace('_', ' ')} · $${Number(b.subscription.amount || 0).toLocaleString('es-CL')} ${b.subscription.currency || 'CLP'}/mes`
    : 'Sin suscripción · administración';
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
                {subscriptionInfo(b)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Actualizada {new Date(b.updatedAt).toLocaleDateString('es-CL')}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" className="min-h-11 underline" onClick={() => selectBusiness(b.id)}>Editar</button>
              <a className="inline-flex min-h-11 items-center underline" href={`/mi-negocio/${b.slug}?preview=true`} target="_blank" rel="noreferrer">Vista previa</a>
               <button type="button" className="min-h-11 underline text-red-600" disabled={busy} onClick={() => quickDelete(b.id, b.name)}>Eliminar</button>

              {b.status !== 'PUBLISHED' && b.status !== 'ARCHIVED' && (
                <button type="button" className="min-h-11 underline text-green-700" disabled={busy}
                  onClick={() => quickStatus(b.id, 'publish')}>Publicar</button>
              )}
              {b.status === 'PUBLISHED' && (
                <button type="button" className="min-h-11 underline text-amber-600" disabled={busy}
                  onClick={() => quickStatus(b.id, 'pause')}>Pausar</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )
  );

  const planPrice = list.find((item) => item.subscription?.amount)?.subscription?.amount;
  const formattedPrice = Number(planPrice || 0).toLocaleString('es-CL');
  const createPage = () => navigate('/negocio/nuevo');
  const needsBusiness = section !== 'inicio' && (!selectedId || !detail);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Mis páginas</h1>
        {detail && (
          <p className="text-sm text-neutral-500">
            <span className="font-semibold text-neutral-800">{detail.name}</span>
            {' · '}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[detail.status] || ''}`}>
              {statusLabel(detail.status)}
            </span>
          </p>
        )}
      </div>

      <DashboardNav section={section} businessId={selectedId} />

      {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      {mpMsg && <p className="text-sm text-green-700">{mpMsg}</p>}

      {section === 'inicio' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-950 p-5 text-white">
            <div><p className="text-sm text-neutral-400">Tu sitio web</p><p className="mt-1 text-xl font-bold">{formattedPrice ? `$${formattedPrice} CLP / mes` : 'Consulta el precio de tu página'}</p><p className="text-xs text-neutral-400">por cada página · puedes crear varias</p></div>
            <button type="button" onClick={createPage} className="rounded-xl bg-white px-4 py-2 font-bold text-neutral-950">Crear página web</button>
          </div>
          <div className="mb-8"><p className="text-sm font-semibold text-stone-500">Paso 1 de 6</p><h2 className="mt-1 text-3xl font-bold tracking-tight">¿Qué tipo de negocio tienes?</h2><p className="mt-2 text-stone-500">Elige el rubro que mejor representa tu trabajo.</p></div>
    <fieldset><legend className="sr-only">Selecciona un rubro</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CATS.map((code) => <button key={code} type="button" onClick={() => setCategory(code)} aria-pressed={category === code} className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${category === code ? 'border-stone-900 ring-2 ring-stone-900' : ''}`}>
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-stone-100"><Building2 className="h-5 w-5" aria-hidden /></span>
        <b className="block">{categoryLabel(code)}</b><span className="mt-1 block text-sm leading-5 text-stone-500">{categoryDescription(code)}</span>
        {category === code && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-stone-900 text-white"><Check size={14} aria-hidden /></span>}
      </button>)}
    </div></fieldset>
    <form onSubmit={handleCreate} className="mt-7 rounded-2xl bg-stone-950 p-5 text-white sm:flex sm:items-end sm:gap-3">
      <label className="block flex-1 text-sm font-semibold">Nombre del negocio<input id="business-create-name" className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 p-3 font-normal text-white placeholder:text-white/50" placeholder="Ejemplo: Floristería Luna" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <button className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 font-bold text-stone-950 disabled:opacity-50 sm:mt-0 sm:w-auto" type="submit" disabled={busy || !name.trim()}>{busy ? 'Creando…' : <><Plus size={18} aria-hidden />Continuar con {categoryLabel(category)}</>}</button>
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
          {section === 'diseno' && <DesignSection businessId={selectedId} detail={detail} onSaved={(u) => setDetail((d: any) => ({ ...d, ...u }))} />}
          {section === 'contenido' && <ContentSection businessId={selectedId} />}
          {section === 'reservas' && <BookingsSection businessId={selectedId} />}
          {section === 'leads' && <LeadsSection businessId={selectedId} />}
        </>
      ) : (
        <div className="h-40 bg-neutral-200 rounded-xl animate-pulse" />
      )}
    </div>
  );
}