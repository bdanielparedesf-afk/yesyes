/**
 * YESYES BUSINESS — EDITOR (Fase 4.2 · C).
 *
 * FLUJO UNICO DE ESTA FASE:
 *
 *   BusinessBuilder ? Manifest V2 ? SiteInstance ? autosave ? preview ? publish
 *
 * El manifest V2 es la fuente de verdad del editor: la sidebar lo lista, la
 * preview lo compone y el guardado lo persiste. NO existe un `useState(manifest)`
 * paralelo: el manifest vive en `useBuilderState`.
 *
 * `business.visual.sections` (V3) queda únicamente como camino de compatibilidad
 * para páginas antiguas sin SiteInstance: nunca se lee para construir la lista
 * de secciones ni para persistir la estructura de la página.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBusiness, getBusinessCapabilities, pauseBusinessPage, publishBusinessPage, updateBusiness, getBusinessContent, listBusinessProducts, listServices, loadBusinessSite, saveBusinessManifest, getAddableSections, addBusinessSection, setBusinessBlockVariant } from '@/services/business';
import BusinessPageRenderer from '@/business/BusinessPageRenderer';
import BuilderTopBar from '@/business/builder/BuilderTopBar';
import { BuilderSidebar } from '@/business/builder/BuilderSidebar';
import BuilderInspector from '@/business/builder/BuilderInspector';
import { useBuilderState, createManifestAutosave, isUsableManifest, moveSection, removeSection, duplicateSection, setSectionHidden, undoRedoIntent, type ManifestAutosave } from '@/business/builder/useBuilderState';
import { manifestSidebarSections, capabilityOfManifestSection, activeVariantBySection, canUndo, canRedo, type BuilderManifest, type BuilderManifestSection } from '@/business/builder/types';
import { DesignGallery } from '@/business/builder/DesignGalleryPanel';

/** Datos del negocio que siguen yendo por la API V3 de contenido. */
const EMPTY_CONTENT = { services: [], products: [], properties: [], gallery: [], testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [] };

export default function BusinessBuilder() {
  const [params] = useSearchParams(); const id = params.get('id') || '';
  const { state, dispatch, changeBusiness, setManifest, editManifest } = useBuilderState();
  const [content, setContent] = useState<any>(EMPTY_CONTENT);
  const [loadError, setLoadError] = useState(''); const [publishError, setPublishError] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'structure' | 'inspector' | null>(null);
  const [showDesigns, setShowDesigns] = useState(false);
  /**
   * FASE 5 §9 — Manifest de la VISTA PREVIA de diseño.
   *
   * Es estado EFÍMERO del editor: solo se pinta, nunca se guarda ni entra al
   * historial. Mientras vale, la previsualización muestra el diseño probado; en
   * cuanto se aplica, se descarta y manda el manifest real. `null` = mostrar el
   * manifest real.
   */
  const [previewManifest, setPreviewManifest] = useState<any>(null);
  // `updatedAt` de la instancia: token de optimistic locking del autosave (§11).
  const instanceStamp = useRef<string | null>(null);
  const autosaveRef = useRef<ManifestAutosave<any> | null>(null);
  // Espejo del estado: el autosave lee lo último sin recrearse en cada tecla.
  const manifestRef = useRef<any>(null); manifestRef.current = state.manifest;
  const businessRef = useRef<any>(null); businessRef.current = state.business;

  // C1 — CARGA. El manifest se pide al backend, que garantiza la SiteInstance
  // (V2) y la deriva del DISEÑO si la página es antigua. Nunca de visual.sections.
  useEffect(() => {
    if (!id) return;
    let active = true;
    void Promise.all([getBusiness(id), getBusinessCapabilities(id), loadBusinessSite(id), getBusinessContent(id), listBusinessProducts(id), listServices(id)])
      .then(([business, capabilities, site, extra, products, services]) => {
        if (!active) return;
        instanceStamp.current = site.updatedAt || null;
        dispatch({ type: 'LOAD', business, manifest: site.manifest, legacySections: capabilities.sections || [] });
        setContent({ ...extra, products, services, properties: (business as any).properties || [], gallery: (business as any).gallery || [], bookingSlots: [] });
      })
      .catch(() => active && setLoadError('No se pudo cargar la página.'));
    return () => { active = false; };
  }, [id, dispatch]);

  // Guardado de los DATOS del negocio (siguen siendo columnas de Business).
  const saveBusinessProfile = useCallback(async (): Promise<void> => {
    if (!id || !businessRef.current) return;
    const business = businessRef.current;
    const payload = { name: business.name, slug: business.slug, category: business.category, description: business.description || null, phone: business.phone || null, whatsapp: business.whatsapp || null, email: business.email || null, address: business.address || null, city: business.city || null, region: business.region || null, mapsUrl: business.mapsUrl || null, lat: business.lat ?? null, lng: business.lng ?? null, hours: business.hours ?? null, socials: business.socials ?? null, cta: business.cta ?? null, settings: business.settings ?? null, visual: business.visual ?? null, logo: business.logo || null, cover: business.cover || null, seoTitle: business.seoTitle || null, seoDescription: business.seoDescription || null, ogImage: business.ogImage || null, canonical: business.canonical || null };
    await updateBusiness(id, payload);
  }, [id]);

  /**
   * AUTOSAVE (§11). Se crea una sola vez: `schedule` encola con debounce,
   * nunca hay dos saves simultáneos y el estado más reciente gana.
   */
  useEffect(() => {
    if (!id) return;
    const autosave = createManifestAutosave<any>({
      save: async (manifest) => {
        const result = await saveBusinessManifest(id, manifest, instanceStamp.current, 'Guardado automático del editor');
        instanceStamp.current = result.updatedAt || instanceStamp.current;
        return result;
      },
      reload: async () => (await loadBusinessSite(id)).manifest,
      onStatus: (status) => {
        if (status.conflict) dispatch({ type: 'SAVE_CONFLICT', error: status.error });
        else if (status.state === 'SAVING') dispatch({ type: 'SAVE_START' });
        else if (status.state === 'SAVED') dispatch({ type: 'SAVE_DONE' });
      },
      onConflict: (serverManifest) => {
        // Conflicto: se recarga el manifest del servidor. Nunca se pisa.
        if (serverManifest) dispatch({ type: 'SET_MANIFEST', manifest: serverManifest });
      },
    });
    autosaveRef.current = autosave;
    return () => { autosave.stop(); autosaveRef.current = null; };
  }, [id, dispatch]);

  /**
   * E §7/§8/§9/§10 — PERSISTENCIA DE UNDO/REDO.
   *
   * El Undo y el Redo NO son solo un movimiento de UI: cambian el documento y deben
   * terminar en el servidor igual que una edición normal. El reducer sube
   * `persistTick` en CUALQUIER cambio persistible (editar, undo, redo, discard), así
   * que este efecto es la única vía de guardado y no puede quedar ninguno fuera.
   * `LOAD` deja `persistTick` en 0: abrir el editor no guarda nada.
   */
  const businessTimer = useRef<any>(null);
  useEffect(() => {
    if (!id || !state.persistTick) return;
    const manifest = manifestRef.current;
    // 1) Manifest V2 por la vía V2 (SiteInstance), con su debounce y latest-wins.
    if (manifest) autosaveRef.current?.schedule(manifest);
    // 2) Datos del negocio: son columnas de Business. Van con su propio debounce
    //    para no escribir en cada tecla.
    if (businessTimer.current) window.clearTimeout(businessTimer.current);
    businessTimer.current = window.setTimeout(() => {
      businessTimer.current = null;
      void saveBusinessProfile().catch(() => { /* el estado DIRTY reintenta al próximo cambio */ });
    }, 1200);
    return () => { if (businessTimer.current) { window.clearTimeout(businessTimer.current); businessTimer.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.persistTick]);

  // Guardado explícito: manifest V2 + datos del negocio. NUNCA publica.
  const save = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    dispatch({ type: 'SAVE_START' });
    try {
      const manifest = manifestRef.current;
      if (manifest) {
        autosaveRef.current?.schedule(manifest);
        const ok = await autosaveRef.current?.flush();
        if (ok === false) return false;
      }
      await saveBusinessProfile();
      dispatch({ type: 'SAVE_DONE' });
      return true;
    } catch (error: any) {
      const conflict = error?.response?.status === 409;
      dispatch({ type: conflict ? 'SAVE_CONFLICT' : 'SAVE_ERROR', error: conflict ? 'La página cambió en otra pestaña. Recargamos la versión más reciente.' : 'Intenta nuevamente.' } as any);
      return false;
    }
  }, [id, dispatch, saveBusinessProfile]);

  // C3 — edición estructural del manifest (la sidebar dispara estas acciones).
  const applyManifest = useCallback((next: any) => { if (next) setManifest(next); }, [setManifest]);
  const onToggleSection = useCallback((sectionId: string) => {
    const manifest = manifestRef.current; if (!manifest) return;
    const current = (manifest.sections || []).find((s: any) => s.id === sectionId);
    // FASE 5 §5 — BUG REAL: la expresion era `!(current && current.hidden !== true)`.
    // Con `hidden === false` (seccion visible) eso daba `!(true)` = `false`: NUNCA
    // ocultaba. O sea, el ojo no hacia nada y el usuario no podia esconder una
    // seccion. La negacion correcta es sobre `hidden === true`.
    applyManifest(setSectionHidden(manifest, sectionId, !(current && current.hidden === true)));
  }, [applyManifest]);
  const onMoveSection = useCallback((sectionId: string, toIndex: number) => {
    const manifest = manifestRef.current; if (!manifest) return;
    applyManifest(moveSection(manifest, sectionId, toIndex));
  }, [applyManifest]);
  const onRemoveSection = useCallback((sectionId: string) => {
    if (!window.confirm('¿Eliminar esta sección de tu página?')) return;
    const manifest = manifestRef.current; if (!manifest) return;
    applyManifest(removeSection(manifest, sectionId));
  }, [applyManifest]);
  const onDuplicateSection = useCallback((sectionId: string) => {
    const manifest = manifestRef.current; if (!manifest) return;
    applyManifest(duplicateSection(manifest, sectionId));
  }, [applyManifest]);

  // C3 — agregar sección: la lista la decide el backend (GET /addable-sections)
  // y la persistencia ocurre por la vía V2 (POST /business/:id/sections).
  const [addable, setAddable] = useState<Array<{ capability: string; label: string; block: string; blockLabel: string; variants: Array<{ id: string; label: string }> }>>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  useEffect(() => {
    if (!id) return;
    let active = true;
    getAddableSections(id)
      .then((data) => { if (active) setAddable(data.sections || []); })
      .catch(() => { if (active) setAddError('No se pudieron cargar las secciones disponibles.'); });
    return () => { active = false; };
  }, [id]);

  const onAddSection = useCallback(async (capability: string) => {
    if (!id) return;
    setAdding(true);
    setAddError('');
    try {
      const result = await addBusinessSection(id, capability);
      setManifest(result.manifest);
      // FASE 5 §12 — El backend YA guardó la sección. Se refresca el sello para
      // que el siguiente autosave no se choque con un 409 consigo mismo, y no
      // se encola un guardado redundante del mismo manifest.
      instanceStamp.current = result.updatedAt || instanceStamp.current;
    } catch (error: any) {
      // FASE 5 §10 — El backend rechaza (409 duplicado / 422 capability no
      // permitida). El manifest local NO se toca: la UI sigue mostrando
      // exactamente lo que el servidor tiene.
      setAddError(error?.response?.data?.message || 'No se pudo agregar la sección.');
    } finally {
      setAdding(false);
    }
  }, [id, setManifest]);

  /**
   * FASE 5 §8 — CAMBIAR LA VARIANTE de una sección existente.
   *
   * El backend conserva el contenido: la variante solo aporta overrides de
   * presentación sobre el `config` del bloque. El cambio entra al historial
   * (`setManifest`), así que es deshacible con Undo como cualquier otra
   * operación estructural.
   */
  const [changingVariant, setChangingVariant] = useState<string | null>(null);
  const onChangeVariant = useCallback(async (sectionId: string, variantId: string) => {
    if (!id) return;
    const section = (manifestRef.current?.sections || []).find((item: any) => item.id === sectionId);
    const block = section?.blocks?.[0];
    if (!block?.instanceId) return;
    setChangingVariant(sectionId);
    setAddError('');
    try {
      const result = await setBusinessBlockVariant(id, block.instanceId, variantId);
      setManifest(result.manifest);
      instanceStamp.current = result.updatedAt || instanceStamp.current;
    } catch (error: any) {
      setAddError(error?.response?.data?.message || 'No se pudo cambiar el diseño de la sección.');
    } finally {
      setChangingVariant(null);
    }
  }, [id, setManifest]);

  /**
   * FASE 5 §8 — Variantes disponibles por sección, tomadas de lo que el backend
   * declaró en `GET /addable-sections`. Si el backend no declara variantes para
   * un bloque, la sección no tiene selector: la UI no inventa diseños.
   */
  const variantsBySection = useMemo(() => {
    const byBlock = new Map<string, { blockLabel: string; variants: Array<{ id: string; label: string }> }>();
    for (const entry of addable) {
      if (!entry.variants?.length) continue;
      // Una capability puede mapear al mismo bloque que otra (PRODUCTS/CATALOG).
      // Se conserva la lista más completa para no perder variantes.
      const actual = byBlock.get(entry.block);
      if (!actual || entry.variants.length > actual.variants.length) {
        byBlock.set(entry.block, { blockLabel: entry.blockLabel, variants: entry.variants });
      }
    }
    const out: Record<string, { block: string; blockLabel: string; variants: Array<{ id: string; label: string }> }> = {};
    for (const section of state.manifest?.sections || []) {
      const block = (section.blocks || [])[0]?.block;
      const found = block ? byBlock.get(String(block)) : undefined;
      if (found) out[section.id] = { block: String(block), blockLabel: found.blockLabel, variants: found.variants };
    }
    return out;
  }, [addable, state.manifest]);

  const activeVariants = useMemo(() => activeVariantBySection(state.manifest), [state.manifest]);

  // C13 — publicar es una acción EXPRESA, separada del guardado: primero se
  // guarda el borrador (para no perder trabajo) y solo después se publica.
  const publish = async () => {
    if (!id) return;
    setPublishError('');
    try {
      if (state.saveState === 'DIRTY' || state.saveState === 'ERROR') {
        const saved = await save();
        if (!saved) return;
      }
      const result = await publishBusinessPage(id);
      dispatch({ type: 'LOAD', business: result.business, manifest: manifestRef.current, legacySections: state.legacySections });
      window.setTimeout(() => window.alert('Cambios publicados correctamente.'), 50);
    } catch (error: any) {
      setPublishError(error?.response?.data?.message || 'El backend no permitió publicar la página.');
    }
  };

  const pause = async () => {
    if (!id || !window.confirm('¿Pausar esta página?')) return;
    const business = await pauseBusinessPage(id);
    dispatch({ type: 'LOAD', business, manifest: manifestRef.current, legacySections: state.legacySections });
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // E §16 — Ctrl/Cmd+Z, +Shift+Z y +Y. Se decide con una función pura para que
      // el comportamiento Windows/macOS sea el mismo y se pueda probar.
      const intent = undoRedoIntent(event);
      if (!intent) return;
      // preventDefault: dentro de un input del editor, Ctrl+Z NO debe disparar el
      // Undo nativo del navegador, sino el del editor.
      event.preventDefault();
      dispatch({ type: intent === 'undo' ? 'UNDO' : 'REDO' });
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  if (!id) return <main className="p-8">Falta seleccionar una página.</main>;
  if (!state.business) return <main className="p-8" aria-busy="true">{loadError || 'Cargando editor…'}</main>;

  // C2 — la lista de secciones sale EXCLUSIVAMENTE del manifest.
  const sidebarSections = manifestSidebarSections(state.manifest);
  // C6 — la preview usa el manifest ACTUAL (incluye cambios sin publicar).
  // Si el manifest no es utilizable (página V3 antigua sin instancia), se cae al
  // camino legacy con `visual.sections`: esa página sigue funcionando.
  //
  // FASE 5 §9 — si hay una VISTA PREVIA de diseño activa, se pinta ESA. Es
  // estado efímero: no se guarda, no entra al historial y se descarta al aplicar
  // o al cerrar la galería.
  const v2 = isUsableManifest(state.manifest);
  const paintedManifest: any = previewManifest || state.manifest;
  const previewBusiness = isUsableManifest(paintedManifest)
    ? { ...state.business, siteInstance: { manifest: paintedManifest as BuilderManifest } }
    : { ...state.business, visual: { ...(state.business as any)?.visual, sections: state.legacySections } };
  // C3 — el inspector trabaja sobre la capability que corresponde al bloque del
  // manifest seleccionado. Sigue siendo la UI de siempre, pero la selección ya
  // no viene de `visual.sections`.
  const selectedManifestSection: BuilderManifestSection | null =
    (state.manifest?.sections || []).find((section) => section.id === state.selectedSection) || null;
  const selectedCapability = v2
    ? capabilityOfManifestSection(selectedManifestSection) || state.selectedSection
    : state.selectedSection;
  /**
   * FASE 5 §8 — props compartidas por la sidebar de escritorio y la de móvil.
   * Que las dos monten EXACTAMENTE lo mismo importa: si el panel móvil no tuviera
   * el selector de variante, en el móvil la capacidad existiría y en el escritorio
   * no, y eso no es una diferencia de diseño sino un bug.
   */
  const sidebarProps = {
    sections: sidebarSections,
    selected: selectedCapability,
    onSelect: (section: string) => dispatch({ type: 'SELECT', section }),
    onToggle: onToggleSection,
    onMove: onMoveSection,
    onRemove: onRemoveSection,
    onDuplicate: onDuplicateSection,
    addable,
    onAdd: onAddSection,
    adding,
    variantsOf: variantsBySection,
    currentVariant: activeVariants,
    onVariant: onChangeVariant,
    changingVariant,
  };
  return <main data-testid="business-builder" className="min-h-screen bg-stone-100 text-stone-900"><BuilderTopBar business={state.business} saveState={state.saveState} device={state.device} sections={sidebarSections} canUndo={canUndo(state)} canRedo={canRedo(state)} onDevice={(device: any) => dispatch({ type: 'DEVICE', device })} onUndo={() => dispatch({ type: 'UNDO' })} onRedo={() => dispatch({ type: 'REDO' })} onSave={save} onPublish={publish} onPause={pause} onDesigns={() => setShowDesigns(true)} />
    <div className="grid min-h-[calc(100vh-80px)] lg:grid-cols-[270px_minmax(0,1fr)_320px]">
      <div data-testid="builder-sidebar-desktop" className="hidden lg:block"><BuilderSidebar {...sidebarProps} /></div>
      <section data-testid="builder-preview" className="min-w-0 p-3 pb-24 sm:p-6 sm:pb-24"><div className="mx-auto mb-4 flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm"><p className="text-sm font-semibold">Tu página, en tiempo real</p><span className="text-xs text-stone-500">{state.device}</span></div><div className={`mx-auto overflow-hidden rounded-2xl bg-white shadow-xl transition-all ${state.device === 'mobile' ? 'max-w-[390px]' : state.device === 'tablet' ? 'max-w-[768px]' : 'max-w-full'}`}><Suspense fallback={<div className="min-h-96 animate-pulse bg-stone-100" />}><BusinessPageRenderer business={previewBusiness} {...content} preview /></Suspense></div></section>
      <div data-testid="builder-inspector-desktop" className="hidden lg:block"><BuilderInspector business={state.business} selected={selectedCapability} onChange={changeBusiness} manifest={state.manifest} sectionId={state.selectedSection} onEditManifest={editManifest} /></div>
    </div>
    <div data-testid="builder-mobile-actions" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,.08)] lg:hidden"><button type="button" onClick={() => setMobilePanel('structure')} className="min-h-12 rounded-xl bg-stone-100 font-semibold">Secciones</button><button type="button" onClick={() => setMobilePanel('inspector')} className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white">Editar</button></div>
    {mobilePanel && <div className="fixed inset-0 z-50 flex items-end bg-stone-950/40 lg:hidden" role="dialog" aria-modal="true" aria-label={mobilePanel === 'structure' ? 'Estructura de la página' : 'Inspector de sección'}><button type="button" aria-label="Cerrar panel" className="absolute inset-0" onClick={() => setMobilePanel(null)} /><div className="relative max-h-[88vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-4"><strong>{mobilePanel === 'structure' ? 'Estructura' : 'Inspector'}</strong><button type="button" onClick={() => setMobilePanel(null)} className="min-h-11 rounded-xl border px-4">Cerrar</button></div><div className="max-h-[calc(88vh-65px)] overflow-auto">{mobilePanel === 'structure' ? <BuilderSidebar {...sidebarProps} onSelect={(section) => { dispatch({ type: 'SELECT', section }); setMobilePanel(null); }} /> : <BuilderInspector business={state.business} selected={selectedCapability} onChange={changeBusiness} manifest={state.manifest} sectionId={state.selectedSection} onEditManifest={editManifest} />}</div></div></div>}
    {showDesigns && (
      <DesignGallery
        businessId={id}
        business={state.business}
        // FASE 5 §9 — PREVIEW vs APPLY, por fin separados:
        //   onPreview ? solo se PINTA (no guarda, no entra al historial);
        //   onApply   ? el backend YA guardó el diseño; aquí se adopta el manifest
        //               y se refresca el sello para el próximo autosave.
        onPreview={(next: any) => setPreviewManifest(next)}
        onApply={(next: any, stamp?: string | null) => { setPreviewManifest(null); setManifest(next); instanceStamp.current = stamp || instanceStamp.current; }}
        onClose={() => { setPreviewManifest(null); setShowDesigns(false); }}
      />
    )}{addError && <p role="alert" className="fixed bottom-36 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-amber-700 px-4 py-3 text-sm text-white">{addError}</p>}{state.error && <p role="alert" className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-red-700 px-4 py-3 text-sm text-white">{state.error}</p>}{publishError && <div role="alert" className="fixed inset-x-4 top-24 z-50 mx-auto max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><p>{publishError}</p><button type="button" onClick={() => setPublishError('')} className="mt-3 rounded-xl border px-3 py-2">Entendido</button></div>}</main>;
}

