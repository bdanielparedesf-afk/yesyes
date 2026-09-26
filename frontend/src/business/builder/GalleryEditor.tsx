import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { saveGallery } from '@/services/business';

/**
 * GALERIA EDITABLE.
 *
 * La galeria de la pagina se arma con filas de `BusinessGalleryImage` (NO con
 * `BusinessMedia`: son dos tablas distintas, ver la siembra de ejemplo). Por eso
 * esto no puede pasar por el manifest ni por `ContentListEditor`: escribe con
 * `saveGallery(businessId, [{ url, alt }])`, que es la unica via que expone el
 * backend para esta tabla.
 *
 * Se edita el ALT de verdad, no solo la URL: es lo que lee el lector de
 * pantalla y lo que Google usa para entender la foto de un negocio local.
 */

const input = 'mt-1 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-stone-900';

export default function GalleryEditor({ businessId, business, onChanged }: {
  businessId: string;
  business: any;
  onChanged?: () => void;
}) {
  const [images, setImages] = useState<Array<{ url: string; alt?: string | null }>>(() => (business?.gallery || []).map((g: any) => ({ url: g.url, alt: g.alt })));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncedFrom, setSyncedFrom] = useState(business?.gallery);
  if (business?.gallery !== syncedFrom) {
    setSyncedFrom(business?.gallery);
    setImages((business?.gallery || []).map((g: any) => ({ url: g.url, alt: g.alt })));
  }

  /** Escribe la lista completa: la foto es la unidad, no su posicion. */
  const persist = (next: Array<{ url: string; alt?: string | null }>) => {
    setImages(next);
    setSaving(true);
    saveGallery(businessId, next)
      .then(() => { setError(''); onChanged?.(); })
      .catch((e: any) => setError(e?.response?.data?.message || 'No se pudo guardar la galería.'))
      .finally(() => setSaving(false));
  };

  const patch = (index: number, key: 'url' | 'alt', value: string) => {
    persist(images.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const remove = (index: number) => persist(images.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  return (
    <section className="border-b" data-testid="gallery-editor">
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm leading-6 text-stone-600">
          Edita, reordena o quita las fotos de la galería. La primera es la portada de la sección.
        </p>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <ul className="space-y-3">
          {images.map((row, index) => (
            <li key={`${row.url}-${index}`} className="space-y-2 rounded-2xl border border-stone-200 p-3">
              <div className="flex items-center gap-1">
                {row.url && <img src={row.url} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <label className="block text-sm font-semibold">Foto {index + 1}
                    <input data-testid="gallery-url" className={input} type="url" placeholder="URL de la foto" value={row.url} onChange={(e) => patch(index, 'url', e.target.value)} />
                  </label>
                </div>
                <div className="flex flex-col">
                  <button type="button" aria-label={`Subir foto ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-1.5 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Bajar foto ${index + 1}`} disabled={index === images.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-1.5 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                </div>
                <button type="button" aria-label={`Quitar foto ${index + 1}`} onClick={() => remove(index)} className="rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="block text-sm font-semibold">Texto alternativo
                <input data-testid="gallery-alt" className={input} placeholder="Describe la foto" value={row.alt || ''} onChange={(e) => patch(index, 'alt', e.target.value)} />
                <span className="mt-1 block text-xs font-normal text-stone-500">Lo que leen las personas con lector de pantalla y los buscadores.</span>
              </label>
            </li>
          ))}
        </ul>
        {!images.length && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Todavía no hay fotos en la galería.</p>}
        <button type="button" data-testid="gallery-add" disabled={saving} onClick={() => persist([...images, { url: '', alt: '' }])} className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-900 p-3 text-sm font-semibold disabled:opacity-50">
          <Plus className="h-4 w-4" /> {saving ? 'Guardando...' : 'Agregar foto'}
        </button>
      </div>
    </section>
  );
}
