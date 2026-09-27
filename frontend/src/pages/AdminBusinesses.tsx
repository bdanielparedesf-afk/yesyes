import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookMarked, Building2, Eye, Filter, Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import api from '@/lib/axios';

const CATEGORY_NAMES: Record<string, string> = {
  HAIR: 'Peluquerías', BARBER: 'Barberías', BAKERY: 'Panaderías', FLOWERS: 'Florerías', FOOD: 'Restaurantes',
  BOUTIQUE: 'Boutique y moda', FURNITURE: 'Muebles y proyectos', REAL_ESTATE: 'Inmobiliarias',
  MECHANIC: 'Talleres y mecánica', PHONE: 'Celulares y accesorios', CLEANING: 'Servicios de limpieza',
  PHOTO: 'Fotografía', TUTORING: 'Educación y clases', CONSTRUCTION: 'Construcción y proyectos',
  BEAUTY: 'Belleza y bienestar', PET: 'Cuidado de mascotas', DETAILING: 'Detailing vehicular',
};
const STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Borrador', className: 'bg-neutral-100 text-neutral-700' },
  PUBLISHED: { label: 'Publicada', className: 'bg-emerald-100 text-emerald-800' },
  PAUSED: { label: 'Pausada', className: 'bg-amber-100 text-amber-800' },
  ARCHIVED: { label: 'Archivada', className: 'bg-rose-100 text-rose-800' },
};
const categoryName = (code: string) => CATEGORY_NAMES[code] || code || 'Sin categoría';
const statusInfo = (code: string) => STATUS[code] || { label: 'Sin estado', className: 'bg-neutral-100 text-neutral-600' };

export default function AdminBusinesses() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const businesses = await api.get('/admin/businesses');
      setList(businesses.data.businesses || []);
    } catch { setMessage({ type: 'error', text: 'No se pudo cargar la información de negocios.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter((business) => {
    const term = search.trim().toLocaleLowerCase('es');
    const matchesText = !term || business.name?.toLocaleLowerCase('es').includes(term) || business.owner?.email?.toLocaleLowerCase('es').includes(term);
    return matchesText && (statusFilter === 'TODOS' || business.status === statusFilter);
  }), [list, search, statusFilter]);
  const updateStatus = async (business: any, status: 'PUBLISHED' | 'PAUSED') => {
    setActionId(business.id); setMessage(null);
    try { await api.put(`/admin/businesses/${business.id}/status`, { status }); await load(); setMessage({ type: 'ok', text: status === 'PUBLISHED' ? 'Negocio publicado.' : 'Negocio pausado.' }); }
    catch (error: any) { setMessage({ type: 'error', text: error?.response?.data?.message || 'No se pudo actualizar el estado.' }); }
    finally { setActionId(''); }
  };

  /** Guardar la página como ejemplo reutilizable (biblioteca del admin). */
  const guardarEjemplo = async (business: any) => {
    setActionId(business.id); setMessage(null);
    try {
      await api.post('/admin/page-library', { businessId: business.id });
      setMessage({ type: 'ok', text: `“${business.name}” se guardó en la biblioteca como ejemplo.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'No se pudo guardar el ejemplo.' });
    } finally { setActionId(''); }
  };
  /** El admin puede borrar cualquier página; la UI no pone barreras. */
  /**
   * ELIMINAR la página. Va con `force` desde el PRIMER intento: el admin pidió
   * poder borrar sin que el sistema le vuelva a preguntar si está seguro. La
   * única protección que queda no es una duda, es dinero: si hay un cobro vivo
   * en Mercado Pago, el backend lo cancela antes de borrar y avisa si no pudo.
   */
  const eliminar = async () => {
    if (!confirmDelete) return;
    const objetivo = confirmDelete;
    setActionId(objetivo.id); setMessage(null);
    try {
      const { data } = await api.delete(`/admin/business-pages/${objetivo.id}`, { data: { force: true } });
      setConfirmDelete(null);
      await load();
      setMessage({
        type: 'ok',
        text: data?.cancelledInProvider
          ? `Se eliminó “${objetivo.name}” y se canceló su cobro en Mercado Pago.`
          : `Se eliminó “${objetivo.name}” y todo su contenido.`,
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'No se pudo eliminar la página.' });
    } finally { setActionId(''); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-primary-700">YesYes Business</p><h1 className="mt-1 text-3xl font-black text-neutral-950">Negocios</h1><p className="mt-1 text-sm text-neutral-500">Crea y administra las páginas profesionales de tus clientes.</p></div>
        <button type="button" onClick={() => { setMessage(null); navigate('/negocio/nuevo?admin=1'); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 font-bold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"><Plus className="h-4 w-4" />Crear negocio</button>
      </header>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Estadísticas de negocios">
        {[{ label: 'Total de negocios', value: list.length, icon: Building2 }, { label: 'Páginas publicadas', value: list.filter((item) => item.status === 'PUBLISHED').length, icon: Eye }, { label: 'Clientes activos', value: new Set(list.map((item) => item.ownerId).filter(Boolean)).size, icon: Users }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-neutral-500">{label}</p><Icon className="h-5 w-5 text-primary-700" aria-hidden /></div><p className="mt-2 text-3xl font-black text-neutral-950">{value}</p></div>)}
      </section>
      {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Buscar y filtrar negocios">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative"><span className="sr-only">Buscar negocios</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo del cliente" className="min-h-11 w-full rounded-xl border border-neutral-300 pl-10 pr-4 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200" /></label>
          <label className="relative"><span className="sr-only">Filtrar por estado</span><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-300 pl-10 pr-4 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"><option value="TODOS">Todos los estados</option>{Object.entries(STATUS).map(([code, item]) => <option key={code} value={code}>{item.label}</option>)}</select></label>
        </div>
      </section>



      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cargando negocios" aria-busy="true">{[0, 1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-neutral-200 bg-white" />)}</div> : !filtered.length ? <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center"><Building2 className="mx-auto h-10 w-10 text-neutral-300" aria-hidden /><h2 className="mt-3 font-bold text-neutral-900">{list.length ? 'No encontramos negocios' : 'Todavía no hay negocios'}</h2><p className="mt-1 text-sm text-neutral-500">{list.length ? 'Prueba con otra búsqueda o cambia los filtros.' : 'Crea el primer proyecto para comenzar.'}</p></div> : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Negocios">
          {filtered.map((business) => { const info = statusInfo(business.status); return <article key={business.id} className="flex min-h-56 flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100"><Building2 className="h-5 w-5 text-primary-800" /></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${info.className}`}>{info.label}</span></div><h2 className="mt-4 line-clamp-1 font-bold text-neutral-950">{business.name}</h2><p className="mt-1 text-sm text-neutral-500">{categoryName(business.category)}</p><p className="mt-2 truncate text-xs text-neutral-400">{business.owner?.name || business.owner?.email || 'Sin propietario asignado'}{business.template?.name ? ` · ${business.template.name}` : ''}</p><div className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4 text-xs"><Link to={`/admin/negocios/${business.id}/editor`} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"><Pencil className="h-3.5 w-3.5" />Editar</Link><a href={`/mi-negocio/${business.slug}?preview=true`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"><Eye className="h-3.5 w-3.5" />Vista previa</a>{business.status === 'PUBLISHED' ? <button type="button" disabled={actionId === business.id} onClick={() => updateStatus(business, 'PAUSED')} className="rounded-lg px-2.5 py-1.5 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Pausar</button> : business.status !== 'ARCHIVED' ? <button type="button" disabled={actionId === business.id} onClick={() => updateStatus(business, 'PUBLISHED')} className="rounded-lg px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Publicar</button> : null}<button type="button" disabled={actionId === business.id} onClick={() => guardarEjemplo(business)} data-testid="save-as-example" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"><BookMarked className="h-3.5 w-3.5" />Guardar como ejemplo</button><button type="button" disabled={actionId === business.id} onClick={() => setConfirmDelete(business)} data-testid="delete-business" className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Eliminar</button></div></article>; })}
        </section>
      )}

      {/*
        CONFIRMACIÓN OBLIGATORIA. Un borrado en cascada no tiene vuelta atrás:
        no queda copia de los servicios, fotos ni textos que el dueño escribió.
        Se nombra el negocio y se dice exactamente qué se pierde, para que nadie
        pulse "Eliminar" creyendo que es una pausa.
      */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" data-testid="confirm-delete-business">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="confirm-delete-title" className="text-lg font-black text-neutral-950">¿Eliminar “{confirmDelete.name}”?</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Se borra todo: servicios, productos, fotos y textos, sin forma de recuperarlos.
              Si tuviera un cobro activo en Mercado Pago, también se cancela.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button type="button" onClick={eliminar} disabled={actionId === confirmDelete.id} data-testid="confirm-delete-button" className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60">
                {actionId === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
