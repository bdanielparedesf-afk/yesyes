import { useCallback, useEffect, useState } from 'react';
import { listProperties, createProperty, updateProperty, deleteProperty, uploadBusinessImage } from '@/services/business';

const EMPTY = {
  title: '', description: '', price: '', operation: 'VENTA', type: 'CASA',
  address: '', city: '', region: '', bedrooms: '', bathrooms: '', parking: '',
  areaTotal: '', agent: '', features: '', lat: '', lng: '', featured: false,
  available: true, published: true,
};
type FormState = typeof EMPTY & { images: string[] };

const TYPES = ['CASA', 'DEPARTAMENTO', 'TERRENO', 'OFICINA', 'LOCAL', 'PARCELA', 'BODEGA'];

const numOrNull = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** CRUD de propiedades para inmobiliarias (Property + PropertyImage, nunca Product). */
export default function PropertiesSection({ businessId }: { businessId: string }) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({ ...EMPTY, images: [] });
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProperties(await listProperties(businessId));
    } catch {
      setMsg('Error cargando propiedades');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm({ ...EMPTY, images: [] }); setEditId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setMsg('El título es obligatorio'); return; }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) { setMsg('Precio inválido'); return; }
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      price,
      operation: form.operation,
      type: form.type,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      region: form.region.trim() || null,
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      parking: numOrNull(form.parking),
      areaTotal: numOrNull(form.areaTotal),
      agent: form.agent.trim() || null,
      lat: numOrNull(form.lat),
      lng: numOrNull(form.lng),
      features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
      featured: form.featured,
      available: form.available,
      published: form.published,
      images: form.images,
    };
    setBusy(true);
    try {
      if (editId) await updateProperty(businessId, editId, payload);
      else await createProperty(businessId, payload);
      setMsg(editId ? 'Propiedad actualizada' : 'Propiedad creada');
      reset();
      await load();
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error guardando propiedad');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar esta propiedad?')) return;
    setBusy(true);
    try {
      await deleteProperty(businessId, id);
      setMsg('Propiedad eliminada');
      if (editId === id) reset();
      await load();
    } catch {
      setMsg('Error eliminando propiedad');
    } finally {
      setBusy(false);
    }
  };

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBusinessImage(businessId, 'property', file);
      setForm((f) => ({ ...f, images: [...f.images, url] }));
      setMsg('Imagen agregada');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error subiendo imagen (máx 5MB)');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof FormState, v: string | boolean | string[]) => setForm((f) => ({ ...f, [k]: v } as FormState));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Propiedades</h2>
      <p className="text-xs text-neutral-500">
        Publicadas en <code>/mi-negocio/:slug/propiedad/:id</code>. No se crean como Productos de la tienda.
      </p>
      {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      <form onSubmit={submit} className="bg-white border rounded-xl p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input
          className="border rounded-lg px-3 py-2 sm:col-span-2 lg:col-span-3" placeholder="Título *"
          value={form.title} onChange={(e) => set('title', e.target.value)} required
        />
        <textarea
          className="border rounded-lg px-3 py-2 sm:col-span-2 lg:col-span-3" rows={3} placeholder="Descripción"
          value={form.description} onChange={(e) => set('description', e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2" placeholder="Precio (CLP) *" inputMode="decimal"
          value={form.price} onChange={(e) => set('price', e.target.value)} required
        />
        <select className="border rounded-lg px-3 py-2" value={form.operation} onChange={(e) => set('operation', e.target.value)}>
          <option value="VENTA">Venta</option>
          <option value="ARRIENDO">Arriendo</option>
        </select>
        <select className="border rounded-lg px-3 py-2" value={form.type} onChange={(e) => set('type', e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="border rounded-lg px-3 py-2" placeholder="Dirección" value={form.address} onChange={(e) => set('address', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Ciudad" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Región" value={form.region} onChange={(e) => set('region', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Dormitorios" inputMode="numeric" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Baños" inputMode="numeric" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Estacionamientos" inputMode="numeric" value={form.parking} onChange={(e) => set('parking', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Superficie m²" inputMode="decimal" value={form.areaTotal} onChange={(e) => set('areaTotal', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Agente" value={form.agent} onChange={(e) => set('agent', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Latitud (opcional)" inputMode="decimal" value={form.lat} onChange={(e) => set('lat', e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Longitud (opcional)" inputMode="decimal" value={form.lng} onChange={(e) => set('lng', e.target.value)} />
        <input
          className="border rounded-lg px-3 py-2 sm:col-span-2 lg:col-span-3"
          placeholder="Características (separadas por coma)"
          value={form.features} onChange={(e) => set('features', e.target.value)}
        />
        <div className="flex flex-wrap gap-4 text-sm sm:col-span-2 lg:col-span-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Destacada</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} /> Disponible</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} /> Publicada</label>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="text-xs text-neutral-500 mb-2">Imágenes ({form.images.length})</p>
          <div className="flex flex-wrap gap-2">
            {form.images.map((url, i) => (
              <div key={`${url}-${i}`} className="relative">
                <img src={url} alt={`Imagen ${i + 1}`} className="w-20 h-14 object-cover rounded-lg" loading="lazy" />
                <button
                  type="button" disabled={busy}
                  onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-black/80 text-white text-xs rounded-full w-5 h-5"
                >✕</button>
              </div>
            ))}
            <label className="w-20 h-14 border border-dashed rounded-lg flex items-center justify-center text-xs cursor-pointer hover:bg-neutral-50">
              + Foto
              <input type="file" accept="image/*" className="hidden" disabled={busy}
                onChange={(e) => addImage(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy} type="submit">
            {busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar propiedad'}
          </button>
          {editId && (
            <button className="border rounded-lg px-4 py-2" type="button" onClick={reset} disabled={busy}>Cancelar</button>
          )}
        </div>
      </form>
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {[0, 1].map((i) => <div key={i} className="h-28 bg-neutral-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !properties.length ? (
        <p className="bg-white border rounded-xl p-6 text-sm text-neutral-500 text-center">
          Aún no tienes propiedades publicadas.
        </p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {properties.map((p) => (
            <li key={p.id} className="bg-white border rounded-xl p-3 flex gap-3">
              {p.images?.[0]?.url
                ? <img src={p.images[0].url} alt={p.title} className="w-20 h-16 rounded-lg object-cover" loading="lazy" />
                : <div className="w-20 h-16 rounded-lg bg-neutral-100 flex items-center justify-center text-xs">🏠</div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.title}</p>
                <p className="text-xs text-neutral-500">
                  {p.operation} · {p.type} · ${Number(p.price || 0).toLocaleString('es-CL')}
                  {p.city ? ` · ${p.city}` : ''}
                </p>
                <p className="text-xs text-neutral-400">
                  {p.published ? 'Publicada' : 'Borrador'}{p.available ? '' : ' · no disponible'}{p.featured ? ' · destacada' : ''}
                </p>
                <div className="flex gap-2 text-xs mt-1">
                  <button type="button" className="underline" disabled={busy}
                    onClick={() => {
                      setEditId(p.id);
                      setForm({
                        title: p.title, description: p.description || '', price: String(p.price ?? ''),
                        operation: p.operation, type: p.type, address: p.address || '', city: p.city || '',
                        region: p.region || '', bedrooms: p.bedrooms != null ? String(p.bedrooms) : '',
                        bathrooms: p.bathrooms != null ? String(p.bathrooms) : '',
                        parking: p.parking != null ? String(p.parking) : '',
                        areaTotal: p.areaTotal != null ? String(p.areaTotal) : '',
                        agent: p.agent || '', features: (p.features || []).join(', '),
                        lat: p.lat != null ? String(p.lat) : '', lng: p.lng != null ? String(p.lng) : '',
                        featured: !!p.featured, available: !!p.available, published: !!p.published,
                        images: (p.images || []).map((im: any) => im.url),
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >Editar</button>
                  <button type="button" className="underline text-red-600" disabled={busy} onClick={() => remove(p.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
