import { useCallback, useEffect, useState } from 'react';
import { listServices, createService, updateService, deleteService, uploadBusinessImage } from '@/services/business';

type Service = {
  id: string; name: string; description?: string | null; image?: string | null;
  price?: number | null; durationMin?: number | null; featured: boolean; active: boolean; order: number;
};

const EMPTY = { name: '', description: '', price: '', durationMin: '', featured: false, active: true };

/** CRUD de servicios del negocio (HAIR/BAKERY/etc). */
export default function ServicesSection({ businessId }: { businessId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServices(await listServices(businessId));
    } catch {
      setMsg('Error cargando servicios');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(EMPTY); setEditId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setMsg('El nombre es obligatorio'); return; }
    const price = form.price === '' ? null : Number(form.price);
    if (price != null && (!Number.isFinite(price) || price < 0)) { setMsg('Precio inválido'); return; }
    const duration = form.durationMin === '' ? null : Math.round(Number(form.durationMin));
    if (duration != null && (!Number.isFinite(duration) || duration <= 0)) { setMsg('Duración inválida'); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      durationMin: duration,
      featured: form.featured,
      active: form.active,
    };
    setBusy(true);
    try {
      if (editId) await updateService(businessId, editId, payload);
      else await createService(businessId, payload);
      setMsg(editId ? 'Servicio actualizado' : 'Servicio creado');
      reset();
      await load();
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error guardando servicio');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar este servicio?')) return;
    setBusy(true);
    try {
      await deleteService(businessId, id);
      setMsg('Servicio eliminado');
      if (editId === id) reset();
      await load();
    } catch {
      setMsg('Error eliminando servicio');
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (service: Service, file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBusinessImage(businessId, 'service', file);
      await updateService(businessId, service.id, { image: url });
      setMsg('Imagen actualizada');
      await load();
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error subiendo imagen (máx 5MB)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Servicios</h2>
      {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      <form onSubmit={submit} className="bg-white border rounded-xl p-4 grid gap-2 sm:grid-cols-2">
        <input
          className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Nombre del servicio *"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
        />
        <textarea
          className="border rounded-lg px-3 py-2 sm:col-span-2" rows={2} placeholder="Descripción"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="border rounded-lg px-3 py-2" placeholder="Precio (CLP)" inputMode="numeric"
          value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          className="border rounded-lg px-3 py-2" placeholder="Duración (min)" inputMode="numeric"
          value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          Destacado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Activo
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy} type="submit">
            {busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar servicio'}
          </button>
          {editId && (
            <button className="border rounded-lg px-4 py-2" type="button" onClick={reset} disabled={busy}>Cancelar</button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-16 bg-neutral-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !services.length ? (
        <p className="bg-white border rounded-xl p-6 text-sm text-neutral-500 text-center">
          Aún no tienes servicios. Agrega el primero con el formulario superior.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
              {s.image
                ? <img src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover" loading="lazy" />
                : <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-xs">🖼️</div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {s.name} {!s.active && <span className="text-xs text-neutral-400">(inactivo)</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {s.price != null ? `$${Number(s.price).toLocaleString('es-CL')}` : 'Sin precio'}
                  {s.durationMin ? ` · ${s.durationMin} min` : ''}
                  {s.featured ? ' · destacado' : ''}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <label className="underline cursor-pointer">
                  Imagen
                  <input type="file" accept="image/*" className="hidden" disabled={busy}
                    onChange={(e) => pickImage(s, e.target.files?.[0])} />
                </label>
                <button
                  type="button" className="underline"
                  onClick={() => {
                    setEditId(s.id);
                    setForm({
                      name: s.name, description: s.description || '',
                      price: s.price != null ? String(s.price) : '',
                      durationMin: s.durationMin != null ? String(s.durationMin) : '',
                      featured: s.featured, active: s.active,
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >Editar</button>
                <button type="button" className="underline text-red-600" disabled={busy} onClick={() => remove(s.id)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
