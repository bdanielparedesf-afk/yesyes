import { useCallback, useEffect, useState } from 'react';
import { getBusiness, saveGallery, uploadBusinessImage } from '@/services/business';

type Item = { url: string; alt?: string | null };

/** Galería del negocio: subir, reordenar y eliminar (persistencia por PUT completo). */
export default function GallerySection({ businessId }: { businessId: string }) {
  const [images, setImages] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getBusiness(businessId);
      setImages(Array.isArray(b.gallery) ? b.gallery : []);
    } catch {
      setMsg('Error cargando galería');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: Item[]) => {
    setBusy(true);
    try {
      await saveGallery(businessId, next);
      setImages(next);
      setMsg('Galería guardada');
    } catch {
      setMsg('Error guardando galería');
    } finally {
      setBusy(false);
    }
  };

  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBusinessImage(businessId, 'gallery', file);
      await persist([...images, { url }]);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error subiendo imagen (máx 5MB)');
    } finally {
      setBusy(false);
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    await persist(next);
  };

  const remove = async (i: number) => {
    if (!window.confirm('¿Eliminar esta imagen de la galería?')) return;
    await persist(images.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Galería</h2>
      {msg && <p className="text-sm text-neutral-600">{msg}</p>}

      <label className="block border border-dashed rounded-xl px-4 py-6 text-center text-sm cursor-pointer hover:bg-neutral-50 bg-white">
        {busy ? 'Subiendo…' : '➕ Subir imagen a la galería'}
        <input type="file" accept="image/*" className="hidden" disabled={busy}
          onChange={(e) => add(e.target.files?.[0])} />
      </label>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-neutral-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !images.length ? (
        <p className="bg-white border rounded-xl p-6 text-sm text-neutral-500 text-center">
          La galería está vacía. Sube fotos de tu trabajo para mostrarlas en tu página.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div key={`${img.url}-${i}`} className="relative group bg-white border rounded-xl overflow-hidden">
              <img src={img.url} alt={img.alt || `Galería ${i + 1}`} className="w-full h-28 object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/60 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" className="text-white text-xs px-2" disabled={busy || i === 0}
                  onClick={() => move(i, -1)} aria-label="Mover antes">←</button>
                <button type="button" className="text-white text-xs px-2" disabled={busy || i === images.length - 1}
                  onClick={() => move(i, 1)} aria-label="Mover después">→</button>
                <button type="button" className="text-white text-xs px-2 text-red-300" disabled={busy}
                  onClick={() => remove(i)} aria-label="Eliminar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
