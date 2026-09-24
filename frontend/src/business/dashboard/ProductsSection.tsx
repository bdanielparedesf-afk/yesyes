import { useCallback, useEffect, useState } from 'react';
import { listBusinessProducts, createBusinessProduct, updateBusinessProduct, deleteBusinessProduct, duplicateBusinessProduct, uploadBusinessImage } from '@/services/business';

const EMPTY = { name: '', slug: '', shortDescription: '', description: '', price: '', compareAtPrice: '', currency: 'CLP', category: '', cta: 'Consultar', image: '', additionalImages: [] as string[], featured: false, active: true, sortOrder: 0, metadata: {} as Record<string, unknown> };

/** Catálogo privado del Business. Nunca consulta Product, Category ni la tienda. */
export default function ProductsSection({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { setLoading(true); try { setProducts(await listBusinessProducts(businessId)); } catch { setMsg('Error cargando productos'); } finally { setLoading(false); } }, [businessId]);
  useEffect(() => { void load(); }, [load]);
  const reset = () => { setForm(EMPTY); setEditId(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) { setMsg('Completa nombre y precio válido.'); return; }
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), slug: form.slug.trim() || undefined, shortDescription: form.shortDescription.trim(), description: form.description.trim(), price, compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null, currency: form.currency.trim() || 'CLP', category: form.category.trim(), cta: form.cta, image: form.image || null, additionalImages: form.additionalImages, featured: form.featured, active: form.active, sortOrder: Number(form.sortOrder) || 0, metadata: form.metadata };
      if (editId) await updateBusinessProduct(businessId, editId, payload); else await createBusinessProduct(businessId, payload);
      setMsg(editId ? 'Producto actualizado.' : 'Producto creado.'); reset(); await load();
    } catch (err: any) { setMsg(err?.response?.data?.message || 'Error guardando producto.'); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { if (!window.confirm('¿Eliminar este producto?')) return; setBusy(true); try { await deleteBusinessProduct(businessId, id); if (editId === id) reset(); await load(); } catch { setMsg('Error eliminando producto.'); } finally { setBusy(false); } };
  const toggle = async (p: any) => { setBusy(true); try { await updateBusinessProduct(businessId, p.id, { active: !p.active }); await load(); } catch { setMsg('Error cambiando estado.'); } finally { setBusy(false); } };
  const pickImage = async (file: File | undefined) => { if (!file) return; setBusy(true); try { const image = await uploadBusinessImage(businessId, 'product', file); setForm(f => ({ ...f, image })); } catch (err: any) { setMsg(err?.response?.data?.message || 'Error subiendo imagen.'); } finally { setBusy(false); } };
  const pickAdditional = async (files: FileList | null) => { if (!files?.length) return; setBusy(true); try { const urls = await Promise.all(Array.from(files).slice(0, 12 - form.additionalImages.length).map((file) => uploadBusinessImage(businessId, 'product', file))); setForm((current) => ({ ...current, additionalImages: [...current.additionalImages, ...urls] })); } catch { setMsg('No se pudieron subir todas las imágenes.'); } finally { setBusy(false); } };
  const move = async (index: number, delta: number) => { const next = [...products]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setProducts(next); try { await Promise.all(next.map((item, order) => updateBusinessProduct(businessId, item.id, { sortOrder: (order + 1) * 10 }))); await load(); } catch { setMsg('No se pudo guardar el orden.'); await load(); } };
  return <div className="space-y-4">
    <div><h2 className="text-lg font-bold">Catálogo de tu negocio</h2><p className="text-xs text-neutral-500">Estos productos son independientes de la tienda YesYes y no se sincronizan con proveedores.</p></div>
    {msg && <p className="text-sm text-neutral-600" role="status">{msg}</p>}
    <form onSubmit={submit} className="bg-white border rounded-xl p-4 grid gap-2 sm:grid-cols-2">
      <input className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Nombre *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
      <input className="border rounded-lg px-3 py-2" placeholder="Slug (opcional)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
      <input className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Descripción corta" value={form.shortDescription} onChange={e => setForm({ ...form, shortDescription: e.target.value })} />
      <textarea className="border rounded-lg px-3 py-2 sm:col-span-2" rows={3} placeholder="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <input className="border rounded-lg px-3 py-2" placeholder="Precio *" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
      <input className="border rounded-lg px-3 py-2" placeholder="Precio anterior (opcional)" inputMode="decimal" value={form.compareAtPrice} onChange={e => setForm({ ...form, compareAtPrice: e.target.value })} />
      <select className="border rounded-lg px-3 py-2" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}><option>CLP</option><option>USD</option><option>EUR</option><option>ARS</option></select>
      <label className="text-sm">Orden<input type="number" min="0" className="w-full border rounded-lg px-3 py-2" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
      <input className="border rounded-lg px-3 py-2" placeholder="Categoría" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
      <select className="border rounded-lg px-3 py-2" value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })}><option>Consultar</option><option>WhatsApp</option><option>Pedir</option><option>Reservar</option><option>Cotizar</option></select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} /> Destacado</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Activo</label>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3 text-sm">{form.image ? <img src={form.image} alt="Producto" className="w-14 h-14 rounded-lg object-cover" /> : <span className="w-14 h-14 grid place-items-center rounded-lg bg-neutral-100">Imagen</span>}<label className="underline cursor-pointer">Subir imagen<input type="file" accept="image/*" className="hidden" onChange={e => pickImage(e.target.files?.[0])} /></label><label className="underline cursor-pointer">Imágenes adicionales<input type="file" accept="image/*" multiple className="hidden" onChange={e => pickAdditional(e.target.files)} /></label></div>
      {!!form.additionalImages.length && <div className="flex flex-wrap gap-2 sm:col-span-2">{form.additionalImages.map((url, index) => <div key={url} className="relative"><img src={url} alt={`Imagen adicional ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" /><button type="button" aria-label={`Eliminar imagen adicional ${index + 1}`} onClick={() => setForm((current) => ({ ...current, additionalImages: current.additionalImages.filter((item) => item !== url) }))} className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">×</button></div>)}</div>}
      <div className="flex gap-2 sm:col-span-2"><button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy} type="submit">{busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar producto'}</button>{editId && <button className="border rounded-lg px-4 py-2" type="button" onClick={reset}>Cancelar</button>}</div>
    </form>
    {loading ? (
      <div className="h-24 rounded-xl bg-neutral-200 animate-pulse" />
    ) : !products.length ? (
      <p className="rounded-xl border bg-white p-6 text-center text-sm text-neutral-500">Aún no tienes productos en tu catálogo.</p>
    ) : (
      <ul className="grid gap-2 sm:grid-cols-2">
        {products.map((p, productIndex) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border bg-white p-3">
            {p.image ? <img src={p.image} alt={p.name} className="h-14 w-14 rounded-lg object-cover" loading="lazy" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-neutral-100 text-xs">Producto</span>}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-neutral-500">{p.currency || 'CLP'} {Number(p.price || 0).toLocaleString('es-CL')} · {p.category || 'Catálogo'} · {p.active ? 'Activo' : 'Oculto'}</p><div className="mt-2 flex flex-wrap gap-3 text-xs"><button type="button" className="underline" onClick={() => { setEditId(p.id); setForm({ name: p.name, slug: p.slug || '', shortDescription: p.shortDescription || '', description: p.description || '', price: String(p.price ?? ''), compareAtPrice: String(p.compareAtPrice ?? ''), currency: p.currency || 'CLP', category: p.category || '', cta: p.cta || 'Consultar', image: p.image || '', additionalImages: Array.isArray(p.additionalImages) ? p.additionalImages : [], featured: Boolean(p.featured), active: p.active, sortOrder: p.sortOrder || 0, metadata: p.metadata || {} }); }}>Editar</button><button type="button" className="underline" onClick={async () => { setBusy(true); try { await duplicateBusinessProduct(businessId, p.id); await load(); setMsg('Producto duplicado.'); } catch { setMsg('No se pudo duplicar.'); } finally { setBusy(false); } }}>Duplicar</button><button type="button" className="underline" onClick={() => toggle(p)}>{p.active ? 'Ocultar' : 'Activar'}</button><button type="button" className="text-red-600 underline" onClick={() => remove(p.id)}>Eliminar</button></div></div>
            <div className="flex flex-col gap-1"><button type="button" aria-label={`Subir ${p.name}`} disabled={busy || productIndex === 0} onClick={() => move(productIndex, -1)}>↑</button><button type="button" aria-label={`Bajar ${p.name}`} disabled={busy || productIndex === products.length - 1} onClick={() => move(productIndex, 1)}>↓</button></div>
          </li>
        ))}
      </ul>
    )}
  </div>;
}
