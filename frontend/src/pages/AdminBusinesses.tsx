import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Eye, FilePlus2, Filter, Loader2, Pencil, Plus, Search, UserRound, Users, X } from 'lucide-react';
import api from '@/lib/axios';
import { createBusiness, getTemplates } from '@/services/business';

const CATEGORY_NAMES: Record<string, string> = {
  HAIR: 'Peluquerías', BARBER: 'Barberías', BAKERY: 'Panaderías', FLOWERS: 'Florerías', FOOD: 'Restaurantes',
  BOUTIQUE: 'Boutique y moda', FURNITURE: 'Muebles y proyectos', REAL_ESTATE: 'Inmobiliarias',
  MECHANIC: 'Talleres y mecánica', PHONE: 'Celulares y accesorios', CLEANING: 'Servicios de limpieza',
  PHOTO: 'Fotografía', TUTORING: 'Educación y clases', CONSTRUCTION: 'Construcción y proyectos',
  BEAUTY: 'Belleza y bienestar', PET: 'Cuidado de mascotas', DETAILING: 'Detailing vehicular',
};
const FALLBACK_CATEGORIES = Object.keys(CATEGORY_NAMES);
const STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Borrador', className: 'bg-neutral-100 text-neutral-700' },
  PUBLISHED: { label: 'Publicada', className: 'bg-emerald-100 text-emerald-800' },
  PAUSED: { label: 'Pausada', className: 'bg-amber-100 text-amber-800' },
  ARCHIVED: { label: 'Archivada', className: 'bg-rose-100 text-rose-800' },
};
const categoryName = (code: string) => CATEGORY_NAMES[code] || code || 'Sin categoría';
const statusInfo = (code: string) => STATUS[code] || { label: 'Sin estado', className: 'bg-neutral-100 text-neutral-600' };

type Mode = 'cliente' | 'propio';
interface FormState { mode: Mode; ownerId: string; name: string; category: string; templateId: string }
const INITIAL_FORM: FormState = { mode: 'cliente', ownerId: '', name: '', category: 'HAIR', templateId: '' };

export default function AdminBusinesses() {
  const [list, setList] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [businesses, users, categoryResponse] = await Promise.all([api.get('/admin/businesses'), api.get('/admin/businesses/candidates'), api.get('/admin/business-categories')]);
      setList(businesses.data.businesses || []); setCandidates(users.data.users || []); setCategories(categoryResponse.data.categories || []);
    } catch { setMessage({ type: 'error', text: 'No se pudo cargar la información de negocios.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (form.category) getTemplates(form.category).then(setTemplates).catch(() => setTemplates([])); }, [form.category]);

  const filtered = useMemo(() => list.filter((business) => {
    const term = search.trim().toLocaleLowerCase('es');
    const matchesText = !term || business.name?.toLocaleLowerCase('es').includes(term) || business.owner?.email?.toLocaleLowerCase('es').includes(term);
    return matchesText && (statusFilter === 'TODOS' || business.status === statusFilter);
  }), [list, search, statusFilter]);
  const closeWizard = () => { setWizardOpen(false); setStep(1); setForm(INITIAL_FORM); setMessage(null); };
  const canContinue = step === 1 ? (form.mode === 'propio' || Boolean(form.ownerId)) : step === 2 ? form.name.trim().length >= 2 : true;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canContinue) return;
    if (step < 3) { setStep((value) => value + 1); return; }
    setSaving(true); setMessage(null);
    try {
      if (form.mode === 'propio' && !form.ownerId) await createBusiness({ name: form.name.trim(), category: form.category, templateId: form.templateId || null });
      else await api.post('/admin/businesses', { ownerId: form.ownerId, name: form.name.trim(), category: form.category, templateId: form.templateId || null });
      closeWizard(); await load(); setMessage({ type: 'ok', text: 'Negocio creado. Ya puedes configurarlo.' });
    } catch (error: any) { setMessage({ type: 'error', text: error?.response?.data?.message || 'No se pudo crear el negocio.' }); }
    finally { setSaving(false); }
  };
  const updateStatus = async (business: any, status: 'PUBLISHED' | 'PAUSED') => {
    setActionId(business.id); setMessage(null);
    try { await api.put(`/admin/businesses/${business.id}/status`, { status }); await load(); setMessage({ type: 'ok', text: status === 'PUBLISHED' ? 'Negocio publicado.' : 'Negocio pausado.' }); }
    catch (error: any) { setMessage({ type: 'error', text: error?.response?.data?.message || 'No se pudo actualizar el estado.' }); }
    finally { setActionId(''); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-primary-700">YesYes Business</p><h1 className="mt-1 text-3xl font-black text-neutral-950">Negocios</h1><p className="mt-1 text-sm text-neutral-500">Crea y administra las páginas profesionales de tus clientes.</p></div>
        <button type="button" onClick={() => { setMessage(null); setWizardOpen(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 font-bold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"><Plus className="h-4 w-4" />Crear negocio</button>
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


      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
          <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary-700">Nuevo proyecto</p><h2 id="wizard-title" className="mt-1 text-2xl font-black text-neutral-950">Crear un negocio</h2></div><button type="button" onClick={closeWizard} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" aria-label="Cerrar creación de negocio"><X className="h-5 w-5" /></button></div>
            <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Pasos de creación">{['Propiedad', 'Información', 'Diseño'].map((label, index) => <li key={label}><div className={`h-1.5 rounded-full ${step >= index + 1 ? 'bg-primary-700' : 'bg-neutral-200'}`} /><p className="mt-2 text-center text-xs font-semibold text-neutral-600">{index + 1}. {label}</p></li>)}</ol>
            {step === 1 && <fieldset className="mt-7"><legend className="text-lg font-bold text-neutral-950">¿Quién será el propietario?</legend><p className="mt-1 text-sm text-neutral-500">Elige si la página es para un cliente o para un proyecto propio.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{([['cliente', 'Para un cliente', 'Asigna el negocio a una cuenta de cliente.', UserRound], ['propio', 'Proyecto propio', 'Crea el proyecto a nombre del administrador.', Building2]] as const).map(([value, title, text, Icon]) => <label key={value} className={`cursor-pointer rounded-2xl border p-4 transition ${form.mode === value ? 'border-primary-700 bg-primary-50 ring-2 ring-primary-200' : 'border-neutral-200 hover:border-primary-300'}`}><span className="flex items-start gap-3"><input type="radio" name="mode" value={value} checked={form.mode === value} onChange={() => setForm({ ...form, mode: value as Mode, ownerId: '' })} className="mt-1 accent-primary-700" /><Icon className="h-5 w-5 text-primary-700" /><span><span className="block font-bold text-neutral-950">{title}</span><span className="mt-1 block text-xs leading-relaxed text-neutral-500">{text}</span></span></span></label>)}</div><label className="mt-5 block text-sm font-semibold text-neutral-800">{form.mode === 'cliente' ? 'Cliente' : 'Cliente opcional'}<select required={form.mode === 'cliente'} value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 px-3 font-normal focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"><option value="">{form.mode === 'cliente' ? 'Selecciona un cliente' : 'Dejar sin asignar'}</option>{candidates.map((user) => <option key={user.id} value={user.id}>{[user.name, user.lastName].filter(Boolean).join(' ')} · {user.email}</option>)}</select></label></fieldset>}
            {step === 2 && <fieldset className="mt-7 space-y-5"><legend className="text-lg font-bold text-neutral-950">Información del negocio</legend><label className="block text-sm font-semibold text-neutral-800">Nombre del negocio<input autoFocus required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej: Peluquería Luna" className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 px-3 font-normal focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200" /></label><label className="block text-sm font-semibold text-neutral-800">Categoría<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, templateId: '' })} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 px-3 font-normal focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200">{(categories.length ? categories : FALLBACK_CATEGORIES.map((code) => ({ code }))).map((category: any) => <option key={category.code} value={category.code}>{categoryName(category.name || category.code)}</option>)}</select></label></fieldset>}


            {step === 3 && <fieldset className="mt-7"><legend className="text-lg font-bold text-neutral-950">Elige un diseño</legend><p className="mt-1 text-sm text-neutral-500">Puedes elegir una plantilla ahora o seleccionarla después al configurar la página.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{templates.map((template) => <label key={template.id} className={`cursor-pointer rounded-2xl border p-4 ${form.templateId === template.id ? 'border-primary-700 bg-primary-50 ring-2 ring-primary-200' : 'border-neutral-200'}`}><span className="flex items-center gap-3"><input type="radio" name="template" checked={form.templateId === template.id} onChange={() => setForm({ ...form, templateId: template.id })} className="accent-primary-700" /><FilePlus2 className="h-5 w-5 text-primary-700" /><span className="font-bold text-neutral-900">{template.name}</span></span></label>)}</div>{!templates.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">No hay plantillas activas para esta categoría. Podrás elegir una al configurar el negocio.</div>}</fieldset>}
            {message && step === 3 && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{message.text}</p>}
            <div className="mt-8 flex justify-between gap-3 border-t border-neutral-200 pt-5"><button type="button" onClick={() => step === 1 ? closeWizard() : setStep((value) => value - 1)} className="rounded-xl border border-neutral-300 px-5 py-2.5 font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">{step === 1 ? 'Cancelar' : 'Atrás'}</button><button type="submit" disabled={!canContinue || saving} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? 'Creando…' : step < 3 ? 'Continuar' : 'Crear negocio'}</button></div>
          </form>
        </div>
      )}

      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cargando negocios" aria-busy="true">{[0, 1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-neutral-200 bg-white" />)}</div> : !filtered.length ? <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center"><Building2 className="mx-auto h-10 w-10 text-neutral-300" aria-hidden /><h2 className="mt-3 font-bold text-neutral-900">{list.length ? 'No encontramos negocios' : 'Todavía no hay negocios'}</h2><p className="mt-1 text-sm text-neutral-500">{list.length ? 'Prueba con otra búsqueda o cambia los filtros.' : 'Crea el primer proyecto para comenzar.'}</p></div> : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Negocios">
          {filtered.map((business) => { const info = statusInfo(business.status); return <article key={business.id} className="flex min-h-56 flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100"><Building2 className="h-5 w-5 text-primary-800" /></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${info.className}`}>{info.label}</span></div><h2 className="mt-4 line-clamp-1 font-bold text-neutral-950">{business.name}</h2><p className="mt-1 text-sm text-neutral-500">{categoryName(business.category)}</p><p className="mt-2 truncate text-xs text-neutral-400">{business.owner?.name || business.owner?.email || 'Sin propietario asignado'}{business.template?.name ? ` · ${business.template.name}` : ''}</p><div className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4 text-xs"><Link to={`/admin/negocios/${business.id}/editor`} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"><Pencil className="h-3.5 w-3.5" />Editar</Link><a href={`/mi-negocio/${business.slug}?preview=true`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"><Eye className="h-3.5 w-3.5" />Vista previa</a>{business.status === 'PUBLISHED' ? <button type="button" disabled={actionId === business.id} onClick={() => updateStatus(business, 'PAUSED')} className="rounded-lg px-2.5 py-1.5 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Pausar</button> : business.status !== 'ARCHIVED' ? <button type="button" disabled={actionId === business.id} onClick={() => updateStatus(business, 'PUBLISHED')} className="rounded-lg px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Publicar</button> : null}</div></article>; })}
        </section>
      )}
    </div>
  );
}
