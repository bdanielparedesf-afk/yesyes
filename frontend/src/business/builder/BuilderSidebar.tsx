/**
 * SIDEBAR DEL EDITOR (Fase 4.2 · C · §8).
 *
 * La lista viene EXCLUSIVAMENTE de `manifest.sections` (ver
 * `manifestSidebarSections`). Cada entrada se identifica por su `instanceId`,
 * su `type` (bloque) y su `enabled`. NO lee `business.visual.sections`.
 *
 * Las acciones estructurales (ocultar, mover, duplicar, eliminar) NO persisten
 * por sí mismas: devuelven un manifest nuevo y el autosave lo guarda por la vía
 * V2 (`PUT /business/:id/manifest` → BusinessSiteInstance → revisión).
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, EyeOff, GripVertical, MoreHorizontal, Plus, X } from 'lucide-react';
import type { BuilderSidebarSection } from './types';
import { capabilityOfManifestSection } from './types';

/** Capability de un bloque del manifest (misma traducción que usa el inspector). */
const capabilityOfType = (block: string) => capabilityOfManifestSection({ id: block, blocks: [{ block }] });

export interface AddableSection {
  capability: string;
  label: string;
  block: string;
  blockLabel: string;
  variants: Array<{ id: string; label: string }>;
}

/**
 * FASE 5 §8 — Variantes disponibles de una sección YA EXISTENTE.
 *
 * La lista la declara el backend (`GET /addable-sections` y el catálogo de
 * variantes). El frontend no inventa variantes: si el backend no ofrece ninguna
 * para ese bloque, la sección no tiene selector de variante.
 */
export interface SectionVariant {
  block: string;
  blockLabel: string;
  variants: Array<{ id: string; label: string }>;
}

export interface BuilderSidebarProps {
  sections: BuilderSidebarSection[];
  selected: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  /** Secciones que el BACKEND ofrece para este rubro (GET /addable-sections). */
  addable?: AddableSection[];
  /** Agrega una sección al manifest (el backend la valida y la persiste). */
  onAdd?: (capability: string) => void;
  adding?: boolean;
  /**
   * FASE 5 §8 — Variante activa de cada sección (`sectionId -> variantId`) y las
   * variantes que el backend ofrece para su bloque. `onVariant` recibe la
   * sección y la variante: el cambio conserva el contenido (la variante solo
   * aporta overrides de presentación).
   */
  variantsOf?: Record<string, SectionVariant>;
  currentVariant?: Record<string, string>;
  onVariant?: (sectionId: string, variantId: string) => void;
  changingVariant?: string | null;
}

export function BuilderSidebar({ sections, selected, onSelect, onToggle, onMove, onRemove, onDuplicate, addable = [], onAdd, adding = false, variantsOf = {}, currentVariant = {}, onVariant, changingVariant = null }: BuilderSidebarProps) {
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const closeOnEscape = useCallback(() => setPicker(false), []);
  useEffect(() => {
    if (!picker) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeOnEscape(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [picker, closeOnEscape]);
  // Solo se ofrecen las que el backend habilitó para este rubro y todavía no
  // están en el manifest: la lista no se inventa en el frontend.
  const disponibles = addable.filter((entry) => !sections.some((section) => capabilityOfType(section.type) === entry.capability));
  return (
    <aside data-testid="builder-sidebar" className="flex h-full flex-col border-r bg-white">
      <div className="flex items-center justify-between border-b p-5">
        <h2 className="text-xs font-bold uppercase tracking-[.18em] text-stone-500">Página</h2>
        <button data-testid="builder-add-section" type="button" onClick={() => setPicker(true)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold"><Plus size={14} /> Agregar</button>
      </div>
      <div className="flex-1 space-y-1 overflow-auto p-3">
        {sections.map((section, index) => (
          <div
            key={section.instanceId}
            data-testid={`builder-section-${section.instanceId}`}
            data-section-type={section.type}
            data-section-enabled={String(section.enabled)}
            className={`relative flex items-center gap-2 rounded-xl p-2 ${selected === section.id ? 'bg-stone-900 text-white' : 'hover:bg-stone-100'}`}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from) && from !== index) onMove(section.instanceId, from); }}
          >
            <button type="button" className="cursor-grab p-1" aria-label={`Mover ${section.label}`}><GripVertical size={16} /></button>
            <button type="button" data-testid={`builder-section-select-${section.instanceId}`} className="min-w-0 flex-1 truncate text-left text-sm font-semibold" onClick={() => onSelect(section.id)}>{section.label}</button>
            <button type="button" aria-label={section.enabled ? 'Ocultar sección' : 'Mostrar sección'} onClick={() => onToggle(section.instanceId)}>{section.enabled ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            <button type="button" aria-label="Más opciones" onClick={() => setMenu(menu === section.instanceId ? null : section.instanceId)}><MoreHorizontal size={16} /></button>
            {menu === section.instanceId && (
              <div className="absolute right-1 top-12 z-20 w-52 rounded-xl border bg-white p-1 text-stone-800 shadow-xl">
                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100" onClick={() => { onSelect(section.id); setMenu(null); }}>Editar</button>
                {/*
                  FASE 5 §8 — Cambio de VARIANTE de una sección existente.
                  Solo aparece si el backend declara variantes para el bloque de
                  esta sección. El nombre es humano; nunca se muestra el id.
                */}
                {variantsOf[section.instanceId]?.variants?.length ? (
                  <div className="border-t border-stone-100 pt-1" data-testid={`builder-variants-${section.instanceId}`}>
                    <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-stone-400">Diseño de la sección</p>
                    {variantsOf[section.instanceId].variants.map((variant) => {
                      const active = currentVariant[section.instanceId] === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          data-testid={`builder-variant-${section.instanceId}-${variant.id}`}
                          data-variant-active={String(active)}
                          disabled={changingVariant === section.instanceId || active}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 disabled:opacity-60"
                          onClick={() => { onVariant?.(section.instanceId, variant.id); setMenu(null); }}
                        >
                          <span>{variant.label}</span>
                          {active && <Check size={14} className="shrink-0 text-stone-900" />}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100" onClick={() => { onDuplicate(section.instanceId); setMenu(null); }}>Duplicar</button>
                <button type="button" disabled={index === 0} className="w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40" onClick={() => { onMove(section.instanceId, index - 1); setMenu(null); }}>Subir</button>
                <button type="button" disabled={index === sections.length - 1} className="w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40" onClick={() => { onMove(section.instanceId, index + 1); setMenu(null); }}>Bajar</button>
                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => { onRemove(section.instanceId); setMenu(null); }}>Eliminar</button>
              </div>
            )}
          </div>
        ))}
        {!sections.length && <p className="p-5 text-sm text-stone-600">Tu página todavía no tiene secciones. Agrega una o cambia el diseño.</p>}
      </div>
      {picker && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950/40" role="dialog" aria-modal="true" aria-label="Agregar sección">
          <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={() => setPicker(false)} />
          <div className="relative max-h-[80vh] w-[min(92vw,720px)] overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="text-lg font-bold">Agregar sección</h3><p className="text-sm text-stone-600">Solo se ofrecen las secciones disponibles para tu rubro.</p></div>
              <button type="button" onClick={() => setPicker(false)} className="rounded-xl border p-2" aria-label="Cerrar"><X size={16} /></button>
            </div>
            {disponibles.length === 0 && <p className="text-sm text-stone-600">Tu página ya tiene todas las secciones disponibles para este rubro.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {disponibles.map((entry) => (
                <button
                  key={entry.capability}
                  type="button"
                  data-testid={`builder-addable-${entry.capability}`}
                  disabled={adding}
                  onClick={() => { onAdd?.(entry.capability); setPicker(false); }}
                  className="rounded-2xl border p-4 text-left hover:border-stone-900 disabled:opacity-50"
                >
                  <strong className="block font-semibold">{entry.label}</strong>
                  <span className="text-xs text-stone-500">{entry.blockLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
