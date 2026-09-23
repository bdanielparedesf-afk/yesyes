import { useCallback, useEffect, useState } from 'react';
import { listBusinessProducts, createBusinessProduct, updateBusinessProduct, deleteBusinessProduct, uploadBusinessImage } from '@/services/business';

const EMPTY = { name: '', description: '', salePrice: '', stock: '', image: '' };

/** CRUD de catálogo Business (Product.businessId != NULL). Aislado del dropshipping. */
export default function ProductsSection({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await listBusinessProducts(businessId));
    } catch {
      setMsg('Error cargando productos');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(EMPTY); setEditId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setMsg('El nombre es obligatorio'); return; }
    const salePrice = Number(form.salePrice);
    if (!Number.isFinite(salePrice) || salePrice < 0) { setMsg('Precio inválido'); return; }
    const stock = form.stock === '' ? 0 : Math.round(Number(form.stock));
    if (!Number.isFinite(stock) || stock < 0) { setMsg('Stock inválido'); return; }
    setBusy(true);
    try {
      if (editId) {
        await updateBusinessProduct(businessId, editId, {
          name: form.name.trim(),
          description: form.description.trim() || form.name.trim(),
          salePrice, stock,
          ...(form.image ? { images: [form.image] } : {}),
        });
        setMsg('Producto actualizado');
      } else {
        await createBusinessProduct(businessId, {
          name: form.name.trim(),
          description: form.description.trim() || form.name.trim(),
          salePrice, stock,
          images: form.image ? [form.image] : [],
        });
        setMsg('Producto creado');
      }
      reset();
      await load();
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error guardando producto');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    setBusy(true);
    try {
      const r = await deleteBusinessProduct(businessId, id);
      setMsg(r.mode === 'ARCHIVED' ? 'Producto archivado (tiene órdenes asociadas)' : 'Producto eliminado');
      if (editId === id) reset();
      await load();
    } catch {
      setMsg('Error eliminando producto');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (p: any) => {
    setBusy(true);
    try {
      await updateBusinessProduct(businessId, p.id, { status: p.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED' });
      await load();
    } catch {
      setMsg('Error cambiando estado');
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBusinessImage(businessId, 'product', file);
      setForm((f) => ({ ...f, image: url }));
      setMsg('Imagen lista');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error subiendo imagen (máx 5MB)');
    } finally {
      setBusy(false);
    }
  };

  const imgOf = (p: any): string => {
    const first = Array.isArray(p?.images) ? p.images[0] : null;
    return typeof first === 'string' ? first : first?.url || '';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Productos del catálogo</h2>
      <p className="text-xs text-neutral-500">
        Estos productos pertenecen a tu negocio (businessId) y NO se sincronizan con AliExpress/CJ/Temu ni aparecen en la tienda YesYes.
      </p>
      {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      <form onSubmit={submit} className="bg-white border rounded-xl p-4 grid gap-2 sm:grid-cols-2">
        <input
          className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Nombre del producto *"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
        />
        <textarea
          className="border rounded-lg px-3 py-2 sm:col-span-2" rows={2} placeholder="Descripción"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="border rounded-lg px-3 py-2" placeholder="Precio (CLP) *" inputMode="decimal"
          value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} required
        />
        <input
          className="border rounded-lg px-3 py-2" placeholder="Stock" inputMode="numeric"
          value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
        <div className="sm:col-span-2 flex items-center gap-3 text-sm">
          {form.image
            ? <img src={form.image} alt="Producto" className="w-14 h-14 rounded-lg object-cover" />
            : <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center text-xs">🖼️</div>}
          <label className="underline cursor-pointer">
            Subir imagen
            <input type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e) => pickImage(e.target.files?.[0])} />
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy} type="submit">
            {busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar producto'}
          </button>
          {editId && (
            <button className="border rounded-lg px-4 py-2" type="button" onClick={reset} disabled={busy}>Cancelar</button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {[0, 1].map((i) => <div key={i} className="h-24 bg-neutral-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !products.length ? (
        <p className="bg-white border rounded-xl p-6 text-sm text-neutral-500 text-center">
          Aún no tienes productos en tu catálogo.
        </p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {products.map((p) => (
            <li key={p.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
              {imgOf(p)
                ? <img src={imgOf(p)} alt={p.name} className="w-14 h-14 rounded-lg object-cover" loading="lazy" />
                : <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center text-xs">🛍️</div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <p className="text-xs text-neutral-500">
                  ${Number(p.salePrice || 0).toLocaleString('es-CL')} · stock {p.stock ?? 0}
                  {' · '}
                  <span className={p.status === 'PUBLISHED' ? 'text-green-700' : 'text-amber-600'}>{p.status}</span>
                </p>
                <div className="flex gap-2 text-xs mt-1">
                  <button type="button" className="underline" disabled={busy}
                    onClick={() => {
                      setEditId(p.id);
                      setForm({
                        name: p.name, description: p.description || '',
                        salePrice: String(p.salePrice ?? ''), stock: String(p.stock ?? 0),
                        image: imgOf(p),
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >Editar</button>
                  <button type="button" className="underline" disabled={busy} onClick={() => toggleStatus(p)}>
                    {p.status === 'PUBLISHED' ? 'Pausar' : 'Publicar'}
                  </button>
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
