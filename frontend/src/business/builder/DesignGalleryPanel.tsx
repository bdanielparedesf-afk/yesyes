import { useEffect, useState } from 'react';
import { Check, Eye, Loader2, X } from 'lucide-react';
import { getBusinessDesigns, previewBusinessDesign, applyBusinessDesign } from '@/services/business';

export interface EditorDesign {
  id: string;
  templateId: string;
  label: string;
  styleLabel: string;
  description: string;
  layout: string;
  sections: Array<{ id: string; label: string; blocks: Array<{ block: string; label: string; variants: Array<{ id: string; label: string }> }> }>;
}

export interface DesignGalleryProps {
  businessId: string;
  /** Manifest que se está mostrando. Solo se usa para pintar la vista previa. */
  business: any;
  /** Recibe el manifest resultante. SOLO se llama al APLICAR, nunca al previsualizar. */
  onApply: (manifest: any, updatedAt?: string | null) => void;
  /**
   * FASE 5 §9 — Manifest de la VISTA PREVIA, en memoria.
   *
   * Antes el preview llamaba a `onApply`, y como `onApply` en el editor hace
   * `setManifest` + `autosave`, previsualizar un diseño GUARDABA ese diseño: el
   * usuario cerraba la galería creyendo que no había pasado nada y su página ya
   * había cambiado (y persistido). Ahora el preview es un estado local efímero y
   * el manifest real no se toca hasta que se pulsa "Aplicar".
   */
  onPreview?: (manifest: any) => void;
  onClose: () => void;
}

/**
 * GALERÍA DE DISEÑOS DENTRO DEL EDITOR (Fase 4.1 · FASE 5 §9).
 *
 * Es el requisito central de la fase: la plantilla elegida al crear la página
 * es solo un PUNTO DE PARTIDA. Desde acá el usuario puede cambiar de diseño
 * cuando quiera, sin perder nada de lo que ya escribió.
 *
 * El flujo es el que pide la fase:
 *
 *   Cambiar diseño -> elegir -> Vista previa -> Aplicar
 *
 * Si el usuario cancela, NO se aplica nada: la vista previa se calcula en el
 * backend y solo se usa para pintar. El manifest real no se toca hasta que el
 * usuario pulsa "Aplicar".
 */
export function DesignGallery({ businessId, onApply, onPreview, onClose }: DesignGalleryProps) {
  const [designs, setDesigns] = useState<EditorDesign[]>([]);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<EditorDesign | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let active = true;
    getBusinessDesigns(businessId)
      .then((data) => {
        if (!active) return;
        setDesigns(data.designs || []);
        setCategoryLabel(data.categoryLabel || '');
      })
      .catch(() => active && setError('No se pudieron cargar los diseños. Puedes reintentar o continuar.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [businessId]);

  // FASE 5 §9 — Vista previa SIN aplicar: el backend calcula el manifest
  // resultante y lo devuelve, pero solo se PINTA (`onPreview`). No entra al
  // documento ni al autosave: cerrar la galería sin aplicar no deja rastro.
  const startPreview = async (design: EditorDesign) => {
    setPreviewing(true);
    setError('');
    try {
      const result = await previewBusinessDesign(businessId, design.templateId);
      onPreview?.(result.manifest);
      setSelected(design);
    } catch {
      setError('No se pudo generar la vista previa de ese diseño.');
    } finally {
      setPreviewing(false);
    }
  };

  const apply = async (design: EditorDesign) => {
    setApplying(true);
    setError('');
    try {
      const result = await applyBusinessDesign(businessId, design.templateId);
      // FASE 5 §12 — se propaga el sello real de la instancia para que el editor
      // refresque su optimistic locking y el siguiente autosave no se choque.
      onApply(result.manifest, result.updatedAt);
      onClose();
    } catch (caught: any) {
      setError(caught?.response?.data?.message || 'No se pudo aplicar el diseño.');
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Cambiar diseno">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-stone-950 px-5 py-4 text-white">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-stone-400">Diseno</p>
          <h2 className="truncate text-lg font-bold">{categoryLabel ? `Disenos para ${categoryLabel}` : 'Elige el diseno de tu pagina'}</h2>
          <p className="mt-0.5 text-xs text-stone-400">Tu contenido se conserva. Solo cambia como se ve.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar galeria de disenos" className="rounded-xl border border-white/20 p-2 hover:bg-white/10">
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-5">
        {loading && <p className="flex items-center gap-2 text-sm text-stone-300"><Loader2 size={16} className="animate-spin" /> Cargando disenos...</p>}
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-950/80 p-3 text-sm text-red-100">{error}</p>}
        {!loading && !designs.length && !error && (
          <p className="rounded-2xl border border-dashed border-white/25 p-8 text-center text-sm text-stone-300">
            Todavia no hay disenos disponibles para tu rubro. Puedes seguir editando tu pagina con normalidad.
          </p>
        )}

        <div data-testid="editor-design-gallery" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {designs.map((design) => {
            const isSelected = selected?.id === design.id;
            return (
              <article
                key={design.id}
                data-testid={`design-option-${design.id}`}
                className={`overflow-hidden rounded-2xl border bg-white text-left transition ${isSelected ? 'border-white ring-2 ring-white' : 'border-stone-700 hover:border-stone-400'}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold leading-tight text-stone-900">{design.label}</h3>
                    {isSelected && <span className="flex shrink-0 items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[11px] font-semibold text-white"><Check size={12} /> Viendo</span>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">{design.description}</p>

                  <ul className="mt-3 flex flex-wrap gap-1">
                    {design.sections.slice(0, 6).map((section) => (
                      <li key={section.id} className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">{section.label}</li>
                    ))}
                    {design.sections.length > 6 && <li className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">+{design.sections.length - 6}</li>}
                  </ul>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void startPreview(design)}
                      disabled={previewing || applying}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold text-stone-900 disabled:opacity-50"
                    >
                      {previewing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Ver diseno
                    </button>
                    <button
                      type="button"
                      onClick={() => void apply(design)}
                      disabled={applying || previewing}
                      className="rounded-xl bg-stone-900 px-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {applying ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {selected && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-stone-950 px-5 py-3 text-white">
          <p className="text-sm text-stone-300">Estas viendo <strong className="text-white">{selected.label}</strong>. Pulsa Aplicar para conservarlo o cierra para volver.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold">Seguir probando</button>
            <button type="button" onClick={() => void apply(selected)} disabled={applying} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-stone-950 disabled:opacity-50">
              {applying ? 'Aplicando...' : 'Aplicar este diseno'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
