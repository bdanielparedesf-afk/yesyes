import { useEffect, useState } from 'react';
import { getBusinessContent, createBusinessContent, updateBusinessContent, deleteBusinessContent } from '@/services/business';

type Section = 'testimonials' | 'faqs' | 'promotions' | 'team';
const TABS: { id: Section; label: string }[] = [
  { id: 'testimonials', label: 'Testimonios' }, { id: 'faqs', label: 'Preguntas' },
  { id: 'promotions', label: 'Promociones' }, { id: 'team', label: 'Equipo' },
];
const fields: Record<Section, { key: string; label: string; multiline?: boolean; required?: boolean }[]> = {
  testimonials: [{ key: 'name', label: 'Nombre', required: true }, { key: 'role', label: 'Cargo' }, { key: 'content', label: 'Testimonio', multiline: true, required: true }, { key: 'rating', label: 'Valoración' }],
  faqs: [{ key: 'question', label: 'Pregunta', required: true }, { key: 'answer', label: 'Respuesta', multiline: true, required: true }],
  promotions: [{ key: 'title', label: 'Título', required: true }, { key: 'description', label: 'Descripción', multiline: true }],
  team: [{ key: 'name', label: 'Nombre', required: true }, { key: 'role', label: 'Rol' }, { key: 'bio', label: 'Presentación', multiline: true }],
};

export default function ContentSection({ businessId }: { businessId: string }) {
  const [section, setSection] = useState<Section>('testimonials');
  const [items, setItems] = useState<any[]>([]);
  const [all, setAll] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { const data = await getBusinessContent(businessId); setAll(data); setItems(data[section] || []); };
  useEffect(() => { setItems(all[section] || []); }, [section, all]);
  useEffect(() => { void load().catch(() => setMessage('No se pudo cargar el contenido.')); }, [businessId]);
  const reset = () => { setEditId(null); setForm({}); setMessage(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload: any = { ...form, active: true };
      if (section === 'testimonials') payload.rating = Math.min(5, Math.max(1, Number(form.rating || 5)));
      if (editId) await updateBusinessContent(businessId, section, editId, payload);
      else await createBusinessContent(businessId, section, payload);
      setMessage('Contenido guardado.'); reset(); await load();
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Error al guardar.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => { if (!confirm('¿Eliminar este contenido?')) return; try { await deleteBusinessContent(businessId, section, id); await load(); } catch { setMessage('No se pudo eliminar.'); } };
  const title = (item: any) => item.name || item.title || item.question || 'Contenido';
  return <div className="space-y-5">
    <div><h2 className="text-lg font-bold">Contenido de tu página</h2><p className="text-sm text-neutral-500">Estos elementos pertenecen únicamente a este negocio.</p></div>
    <div className="flex gap-2 overflow-x-auto" role="tablist">{TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={section === tab.id} onClick={() => { setSection(tab.id); reset(); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${section === tab.id ? 'bg-neutral-950 text-white' : 'border bg-white'}`}>{tab.label}</button>)}</div>
    <p className="text-sm" role="status" aria-live="polite">{message}</p>
    <form onSubmit={save} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
      {fields[section].map((field) => <label key={field.key} className="text-sm">{field.label}{field.multiline ? <textarea required={field.required} rows={3} value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} /> : field.key === 'rating' ? <select value={form.rating || '5'} onChange={(e) => setForm({ ...form, rating: e.target.value })}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n}</option>)}</select> : <input required={field.required} value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />}</label>)}
      <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-neutral-950 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar'}</button>{editId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2">Cancelar</button>}</div>
    </form>
    {!items.length ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-neutral-500">Aún no hay elementos en esta sección.</p> : <ul className="space-y-2">{items.map((item) => <li key={item.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{title(item)}</p><p className="truncate text-sm text-neutral-500">{item.role || item.description || item.answer || item.bio}</p></div><button type="button" onClick={() => { setEditId(item.id); setForm(Object.fromEntries(fields[section].map((f) => [f.key, String(item[f.key] ?? '')]))); }}>Editar</button><button type="button" className="text-red-600" onClick={() => remove(item.id)}>Eliminar</button></li>)}</ul>}
  </div>;
}
