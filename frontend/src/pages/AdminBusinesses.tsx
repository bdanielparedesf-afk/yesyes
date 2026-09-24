import { useEffect, useState } from 'react';
import api from '@/lib/axios';

export default function AdminBusinesses() {
  const [list, setList] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ ownerId: '', name: '', category: 'HAIR', templateId: '' });
  const [message, setMessage] = useState('');
  useEffect(() => {
    api.get('/admin/businesses').then((r) => setList(r.data.businesses || [])).catch(() => setList([]));
    api.get('/admin/businesses/candidates').then((r) => setCandidates(r.data.users || [])).catch(() => setCandidates([]));
    api.get('/admin/business-categories').then((r) => setCategories(r.data.categories || [])).catch(() => setCategories([]));
  }, []);
  const createForCustomer = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage('');
    try { await api.post('/admin/businesses', { ...form, templateId: form.templateId || null }); setMessage('Business creado en DRAFT'); } catch (err: any) { setMessage(err?.response?.data?.message || 'No se pudo crear'); }
  };
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Negocios</h1>
      <form onSubmit={createForCustomer} className="bg-white rounded-xl border p-4 mb-5 grid gap-2 md:grid-cols-4">
        <select required value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} aria-label="Cliente owner">
          <option value="">Seleccionar cliente</option>
          {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} {u.lastName} · {u.email}</option>)}
        </select>
        <input required placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Nombre del negocio" />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, templateId: '' })} aria-label="Categoría">
          {(categories.length ? categories : ['HAIR','BARBER','BAKERY','FLOWERS','FOOD','BOUTIQUE','FURNITURE','REAL_ESTATE','MECHANIC','PHONE','CLEANING','PHOTO','TUTORING','CONSTRUCTION','BEAUTY','PET','DETAILING'].map((code) => ({ code }))).map((c: any) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
        <input placeholder="Template ID (opcional)" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} aria-label="Template ID" />
        <button className="md:col-span-4 bg-black text-white rounded-lg px-4 py-2 w-fit" type="submit">Crear para cliente</button>
        {message && <p className="md:col-span-4 text-sm">{message}</p>}
      </form>
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Nombre</th>
              <th className="p-3">Propietario</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="p-3">{b.name}</td>
                <td className="p-3">{b.owner?.email}</td>
                <td className="p-3">{b.category}</td>
                <td className="p-3">{b.status}</td>
                <td className="p-3 flex gap-2">
                  <a className="underline" href={`/admin/negocios/${b.id}/editor`}>Editar</a>
                  <a className="underline" href={`/mi-negocio/${b.slug}`} target="_blank" rel="noreferrer">Ver</a>
                  <button className="underline" onClick={() => api.put(`/admin/businesses/${b.id}/status`, { status: 'PUBLISHED' }).then(() => window.location.reload())}>Publicar</button>
                  <button className="underline" onClick={() => api.put(`/admin/businesses/${b.id}/status`, { status: 'PAUSED' }).then(() => window.location.reload())}>Pausar</button>
                  <button className="underline" onClick={() => api.delete(`/businesses/${b.id}`).then(() => window.location.reload())}>Archivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="p-4 text-neutral-500">Sin negocios.</p>}
      </div>
    </div>
  );
}
