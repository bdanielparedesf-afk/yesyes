import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Smartphone, Tablet, X } from 'lucide-react';
import BusinessShell from '../BusinessShell';
import BusinessPageRenderer from '../BusinessPageRenderer';
import { buildPreviewFixture } from '../fixtures/previewFixture';
import { categoryLabel, sectionLabel } from '../businessLabels';
import ErrorBoundary from '@/components/ErrorBoundary';

/** Si la plantilla del diseño no se pudo cargar, se avisa SIN romper el flujo. */
function PreviewFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-stone-50 p-8 text-center">
      <p className="text-lg font-bold text-stone-900">No pudimos mostrar este diseño</p>
      <p className="max-w-sm text-sm text-stone-600">
        Puede ser que tu navegador tenga guardada una versión anterior de la página.
        Recarga para intentarlo de nuevo, o elige otro diseño.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => window.location.reload()} className="min-h-10 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white">
          Recargar
        </button>
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-800">
          Elegir otro diseño
        </button>
      </div>
    </div>
  );
}

/** Diseño que la galería necesita mostrar, ya con nombre y estilo legibles. */
export interface DesignOption {
  id: string;
  code: string;
  category: string;
  label: string;
  style: string;
  legacy?: boolean;
  functions?: string[];
}

const VIEWPORTS = {
  desktop: { label: 'Escritorio', width: '100%', icon: Monitor },
  tablet: { label: 'Tableta', width: '768px', icon: Tablet },
  mobile: { label: 'Móvil', width: '390px', icon: Smartphone },
} as const;
type Viewport = keyof typeof VIEWPORTS;

/** Monta el render solo cuando la tarjeta entra en pantalla (galería liviana). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  return { ref, visible };
}

/** Miniatura: la página real escalada, con contenido real del rubro. */
function DesignThumbnail({ design, category }: { design: DesignOption; category: string }) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const fixture = useMemo(() => buildPreviewFixture(category, design.code), [category, design.code]);
  return (
    <div ref={ref} className="relative h-56 overflow-hidden bg-stone-100" aria-hidden="true">
      {visible && (
        <div className="pointer-events-none absolute left-1/2 top-0 w-[1280px] -translate-x-1/2 origin-top scale-[0.28]">
          {/* Una miniatura rota no puede dejar la tarjeta en blanco para
              siempre: se muestra un marcador y el diseño sigue siendo elegible. */}
          <ErrorBoundary fallback={<div className="h-56 w-[1280px] bg-stone-100" />}>
            <BusinessShell business={fixture.business}>
              <BusinessPageRenderer {...fixture} preview />
            </BusinessShell>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

/** Vista previa completa: página real, scrolleable y responsive. */
export function DesignFullPreview({ design, category, onClose, onSelect }: {
  design: DesignOption; category: string; onClose: () => void; onSelect?: () => void;
}) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const fixture = useMemo(() => buildPreviewFixture(category, design.code), [category, design.code]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  const width = VIEWPORTS[viewport].width;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Vista previa de ${design.label}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 bg-stone-950 px-4 py-3 text-white">
        <div className="min-w-0"><p className="truncate text-sm font-bold">{design.label}</p><p className="text-xs text-stone-400">{categoryLabel(category)} · {design.style}</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/15 p-1" role="group" aria-label="Tamaño de la vista previa">
            {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => {
              const Icon = VIEWPORTS[key].icon;
              return <button key={key} type="button" onClick={() => setViewport(key)} aria-pressed={viewport === key} aria-label={VIEWPORTS[key].label} className={`rounded-lg p-2 ${viewport === key ? 'bg-white text-stone-900' : 'text-white'}`}><Icon size={17} /></button>;
            })}
          </div>
          {onSelect && <button type="button" onClick={onSelect} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-stone-950">Elegir este diseño</button>}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar vista previa" className="rounded-xl border border-white/20 p-2"><X size={17} /></button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto overflow-hidden rounded-2xl bg-white shadow-2xl transition-all" style={{ width, maxWidth: '100%' }}>
          <Suspense fallback={<div className="min-h-[60vh] animate-pulse bg-stone-100" />}>
            {/* Si una plantilla no carga, el preview se cae SOLO: el asistente
                sigue vivo y el usuario puede elegir otro diseño o continuar. */}
            <ErrorBoundary fallback={<PreviewFallback onClose={onClose} />}>
              <BusinessShell business={fixture.business}>
                <BusinessPageRenderer {...fixture} preview />
              </BusinessShell>
            </ErrorBoundary>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * Galería de diseños: cada tarjeta muestra la página real (mismo renderer que la
 * web publicada) y abre una vista previa completa, scrolleable y responsive.
 * Nunca se muestran códigos técnicos de plantilla ni de sección.
 */
export function DesignGallery({ designs, category, selectedId, onSelect, emptyHint }: {
  designs: DesignOption[];
  category: string;
  selectedId?: string | null;
  onSelect: (design: DesignOption) => void;
  emptyHint?: string;
}) {
  const [preview, setPreview] = useState<DesignOption | null>(null);
  if (!designs.length) {
    return <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">{emptyHint || `Todavía no hay diseños disponibles para ${categoryLabel(category)}. Escríbenos y los publicamos pronto.`}</p>;
  }
  return (
    <>
      <div data-testid="design-gallery" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {designs.map((design) => {
          const selected = selectedId === design.id;
          return (
            <article
              key={design.id}
              data-testid={`design-option-${design.id}`}
              className={`overflow-hidden rounded-2xl border bg-white text-left transition ${selected ? 'border-stone-900 ring-2 ring-stone-900' : 'border-stone-200 hover:border-stone-400'}`}
            >
              <DesignThumbnail design={design} category={category} />
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold leading-tight">{design.label}</h3>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{design.style}</span>
                </div>
                <p className="text-xs text-stone-500">{categoryLabel(design.category || category)}</p>
                {!!design.functions?.length && (
                  <ul className="flex flex-wrap gap-1">
                    {design.functions.slice(0, 4).map((item) => <li key={item} className="rounded-md bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600">{sectionLabel(item)}</li>)}
                  </ul>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setPreview(design)} className="min-h-10 flex-1 rounded-xl border px-3 text-sm font-semibold">Ver página completa</button>
                  <button type="button" onClick={() => onSelect(design)} aria-pressed={selected} className={`min-h-10 flex-1 rounded-xl px-3 text-sm font-bold ${selected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-900'}`}>
                    {selected ? 'Elegido' : 'Elegir'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {preview && <DesignFullPreview design={preview} category={category} onClose={() => setPreview(null)} onSelect={() => { onSelect(preview); setPreview(null); }} />}
    </>
  );
}

/** Convierte la respuesta de la API en opciones de galería legibles. */
export function toDesignOptions(templates: any[], category: string): DesignOption[] {
  return (templates || []).map((template) => ({
    id: template.id,
    code: template.code,
    category: template.category || category,
    label: template.label || `${categoryLabel(template.category || category)} · ${template.styleLabel || template.style || 'Moderno'}`,
    style: template.style || template.styleLabel || 'Moderno',
    legacy: template.legacy,
    functions: template.functions || template.capabilities || [],
  }));
}

