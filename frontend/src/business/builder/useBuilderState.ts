/**
 * YESYES BUSINESS — ESTADO DEL EDITOR (Fase 4.2 · C).
 *
 * REGLA ARQUITECTÓNICA DE ESTA FASE:
 *
 *   V2 = fuente de verdad        → `manifest`
 *   V3 = compatibilidad          → `legacySections` (solo camino legacy)
 *
 * El manifest es lo que el editor lee, edita, guarda y previsualiza. Las
 * secciones V3 (`business.visual.sections`) se conservan ÚNICAMENTE para que una
 * pagina antigua sin SiteInstance siga renderizando por la via legacy; nunca son
 * la fuente de verdad del editor nuevo y no se persisten como estructura.
 */

import { useCallback, useEffect, useReducer } from 'react';
import {
  COALESCE_MS, MAX_HISTORY,
  normalizeSections,
  type BuilderAction, type BuilderSaveState, type BuilderSection, type BuilderSnapshot, type BuilderState,
} from './types';

const initialState: BuilderState = {
  business: null, manifest: null, legacySections: [], selectedSection: '', selectedElement: null, device: 'desktop',
  saveState: 'CLEAN', error: '', preview: false, conflict: false, history: [], future: [],
  initialDraft: null, persistTick: 0, lastCoalesceKey: null, lastCoalesceAt: 0,
};

/**
 * E §3 — DEEP CLONE OBLIGATORIO.
 *
 * Un snapshot sin clonar es una bomba de reloj: si `business` o `manifest`
 * siguen mutando despues de guardarlos en el historial, el pasado cambia solo y
 * el Undo restaura algo que nunca existio. Se clona SIEMPRE al entrar al historial
 * y SIEMPRE al salir de el (undo/redo), de modo que historial, futuro y estado
 * vivo son tres arboles independientes.
 */
export function cloneSnapshotValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  const structured = (globalThis as any).structuredClone;
  if (typeof structured === 'function') {
    try { return structured(value); } catch { /* cae al respaldo */ }
  }
  return JSON.parse(JSON.stringify(value));
}

function snapshotOf(state: BuilderState): BuilderSnapshot {
  return { business: cloneSnapshotValue(state.business), manifest: cloneSnapshotValue(state.manifest) };
}

/** Restaura un snapshot como estado VIVO, tambien con clone: el estado actual no queda aliasado. */
function restore(snapshot: BuilderSnapshot): Pick<BuilderState, 'business' | 'manifest'> {
  return { business: cloneSnapshotValue(snapshot.business), manifest: cloneSnapshotValue(snapshot.manifest) };
}

/**
 * E §6 — Agrupacion de edicion continua.
 *
 * Escribir "Hola" son cinco eventos, no cinco pasos de Undo. Si la edicion entrase
 * con la misma clave (`business.name`) dentro de la ventana de agrupacion, se
 * SOBREESCRIBE el snapshot superior en vez de apilar uno nuevo: el Undo vuelve al
 * estado previo a empezar a escribir, que es lo que espera la persona.
 */
function isContinuousEdit(state: BuilderState, action: { coalesceKey?: string; at?: number }): boolean {
  if (!action.coalesceKey) return false;
  if (state.lastCoalesceKey !== action.coalesceKey) return false;
  const at = typeof action.at === 'number' ? action.at : Date.now();
  return at - state.lastCoalesceAt <= COALESCE_MS;
}

/**
 * E §4/§5 — Toda operacion del documento entra al historial con business Y manifest.
 * El tope MAX_HISTORY mantiene acotado el uso de memoria.
 */
function withHistory(state: BuilderState, patch: Partial<BuilderSnapshot>, action: { coalesceKey?: string; at?: number } = {}): BuilderState {
  const at = typeof action.at === 'number' ? action.at : Date.now();
  const base: BuilderState = { ...state, ...patch, saveState: 'DIRTY' as BuilderSaveState, error: '', conflict: false, persistTick: state.persistTick + 1, lastCoalesceKey: action.coalesceKey || null, lastCoalesceAt: action.coalesceKey ? at : 0 };
  if (isContinuousEdit(state, action)) {
    // Mismo campo, misma sesion de escritura: NO se apila un paso nuevo.
    return { ...base, history: state.history, future: [] };
  }
  return { ...base, history: [...state.history, snapshotOf(state)].slice(-MAX_HISTORY), future: [] };
}

/** Seccion que se selecciona al abrir: la primera visible del manifest. */
export function firstSelectableSectionId(manifest: any, legacySections?: BuilderSection[]): string {
  const sections = Array.isArray(manifest?.sections) ? manifest.sections : null;
  if (sections && sections.length) {
    const ordered = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const first = ordered.find((section) => section && !section.hidden) || ordered[0];
    return String(first?.id || '');
  }
  return legacySections?.[0]?.id || '';
}

function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    // C1/C2: la carga entrega business + manifest. El manifest manda.
    // E: ademas fija `initialDraft` — el estado real del borrador al abrir — y
    // reinicia el reloj de persistencia (abrir el editor no es una edicion).
    case 'LOAD': {
      const next: BuilderState = {
        ...state,
        business: action.business,
        manifest: action.manifest ?? state.manifest,
        legacySections: normalizeSections(action.legacySections || []),
        selectedSection: firstSelectableSectionId(action.manifest, action.legacySections),
        selectedElement: null,
        saveState: 'CLEAN',
        error: '',
        conflict: false,
        history: [],
        future: [],
        initialDraft: { business: cloneSnapshotValue(action.business), manifest: cloneSnapshotValue(action.manifest ?? state.manifest) },
        persistTick: 0,
        lastCoalesceKey: null,
        lastCoalesceAt: 0,
      };
      return next;
    }
    // C3: editar contenido/config del manifest. El snapshot guarda business y manifest.
    case 'SET_MANIFEST': return withHistory(state, { manifest: action.manifest }, action);
    case 'SET_BUSINESS': return withHistory(state, { business: action.business }, action);
    case 'PATCH_BUSINESS': return withHistory(state, { business: { ...state.business, ...action.patch } }, action);
    // Solo para el camino legacy: NO es la fuente de verdad del editor V2.
    case 'SET_LEGACY_SECTIONS': return { ...state, legacySections: normalizeSections(action.sections) };
    case 'SELECT': return { ...state, selectedSection: action.section, selectedElement: null };
    case 'DEVICE': return { ...state, device: action.device };
    case 'PREVIEW': return { ...state, preview: action.value };
    case 'SAVE_START': return { ...state, saveState: 'SAVING', error: '' };
    case 'SAVE_DONE': return { ...state, saveState: 'SAVED', error: '', conflict: false };
    // Conflicto de revision: se detiene el guardado y se informa (nunca se pisa).
    case 'SAVE_CONFLICT': return { ...state, saveState: 'ERROR', error: action.error, conflict: true };
    case 'SAVE_ERROR': return { ...state, saveState: 'ERROR', error: action.error, conflict: false };
    // E §7/§8/§11 — Undo/Redo mueven el documento ENTERO (business + manifest) y
    // marcan el estado como pendiente de persistencia (`persistTick`) para que el
    // autosave lo guarde exactamente igual que una edición normal.
    case 'UNDO': {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      // La rama futura se recalcula DESDE el estado vivo, ya deep-cloneado: una
      // edición nueva después de un Undo descarta el Redo (E §11).
      return {
        ...state, ...restore(previous),
        history: state.history.slice(0, -1),
        future: [snapshotOf(state), ...state.future].slice(0, MAX_HISTORY),
        saveState: 'DIRTY', error: '', conflict: false,
        persistTick: state.persistTick + 1, lastCoalesceKey: null, lastCoalesceAt: 0,
      };
    }
    case 'REDO': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state, ...restore(next),
        history: [...state.history, snapshotOf(state)].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        saveState: 'DIRTY', error: '', conflict: false,
        persistTick: state.persistTick + 1, lastCoalesceKey: null, lastCoalesceAt: 0,
      };
    }
    // E §12 — DISCARD vuelve al estado INICIAL del borrador (`initialDraft`), no a
    // `history[0]`, que depende de cuántas ediciones hubo. Nunca publica; el
    // autosave persiste ese estado porque el documento vuelve a quedar DIRTY.
    case 'DISCARD': {
      const initial = state.initialDraft;
      if (!initial) return state;
      return {
        ...state, ...restore(initial),
        saveState: 'DIRTY', error: '', conflict: false,
        history: [], future: [],
        persistTick: state.persistTick + 1, lastCoalesceKey: null, lastCoalesceAt: 0,
      };
    }
  }
}

/** E §18 — Reducer exportado: las pruebas ejercitan la lógica real, no una copia. */
export { reducer as builderReducer };
export { initialState as builderInitialState };

/**
 * E §16 — Intención de teclado de Undo/Redo, como FUNCIÓN PURA (se prueba sola).
 *
 *   Ctrl/Cmd + Z         → 'undo'
 *   Ctrl/Cmd + Shift + Z → 'redo'
 *   Ctrl/Cmd + Y         → 'redo'  (convención Windows)
 *
 * Devuelve `null` cuando la tecla no es del editor, para que la página no intercepte
 * atajos ajenos. Quien lo consume DEBE llamar `preventDefault()` cuando el valor
 * no es null: así `Ctrl+Z` dentro de un input del editor no dispara el Undo del
 * navegador, que es justo lo que hay que evitar.
 */
export function undoRedoIntent(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }): 'undo' | 'redo' | null {
  if (!event.ctrlKey && !event.metaKey) return null;
  if (event.altKey) return null;
  const key = String(event.key || '').toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return null;
}

/**
 * E §6 — Clave de agrupación de una edición de business. Dos pulsaciones sobre el
 * MISMO campo dentro de la ventana forman un solo paso de Undo.
 */
export const businessEditKey = (patch: Record<string, unknown>): string | undefined => {
  const keys = Object.keys(patch || {}).sort();
  return keys.length ? `business:${keys.join('|')}` : undefined;
};

export function useBuilderState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const changeBusiness = useCallback((patch: Record<string, unknown>) => dispatch({ type: 'PATCH_BUSINESS', patch, coalesceKey: businessEditKey(patch), at: Date.now() }), []);
  const replaceBusiness = useCallback((business: any) => dispatch({ type: 'SET_BUSINESS', business }), []);
  const setManifest = useCallback((manifest: any) => dispatch({ type: 'SET_MANIFEST', manifest }), []);
  // Edición de contenido dentro del manifest (p. ej. el título de un bloque):
  // también se agrupa por bloque+campo para no generar un paso por tecla.
  const editManifest = useCallback((manifest: any, coalesceKey?: string) => dispatch({ type: 'SET_MANIFEST', manifest, coalesceKey, at: Date.now() }), []);
  const changeLegacySections = useCallback((sections: BuilderSection[]) => dispatch({ type: 'SET_LEGACY_SECTIONS', sections }), []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (state.saveState === 'DIRTY' || state.saveState === 'ERROR') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [state.saveState]);
  return { state, dispatch, changeBusiness, replaceBusiness, setManifest, editManifest, changeLegacySections };
}

export const saveLabel = (saveState: BuilderSaveState): string => ({ CLEAN: 'Guardado', DIRTY: 'Cambios sin guardar', SAVING: 'Guardando…', SAVED: 'Guardado', ERROR: 'No se pudo guardar' })[saveState];

/**
 * YESYES BUSINESS — OPERACIONES PURAS SOBRE EL MANIFEST (Fase 4.2 · C).
 *
 * Todas devuelven un manifest NUEVO (nunca mutan el anterior) para que el
 * historial de undo/redo del editor tenga snapshots Honestos. Se Probarian de
 * forma aislada: son la logica real que despacha la UI.
 */

export type ManifestLike = { sections?: any[]; [key: string]: any };

const clone = (manifest: ManifestLike): ManifestLike => JSON.parse(JSON.stringify(manifest));

const ordered = (sections: any[]): any[] => [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Normaliza el orden a multiplos de 10, como espera el motor. */
export function renumber(manifest: ManifestLike): ManifestLike {
  const next = clone(manifest);
  next.sections = ordered(next.sections || []).map((section, index) => ({ ...section, order: (index + 1) * 10 }));
  return next;
}

/** Muestra u oculta una seccion SIN borrarla (se puede volver a prender). */
export function setSectionHidden(manifest: ManifestLike, sectionId: string, hidden: boolean): ManifestLike {
  const next = clone(manifest);
  next.sections = (next.sections || []).map((section) => (section.id === sectionId ? { ...section, hidden } : section));
  return next;
}

/**
 * FASE 6 — Escribe un campo de `config` de un bloque del manifest.
 *
 * Es lo que usa el picker de medios: al elegir un video se escribe
 * `config.video = "media:<id>"`. Devuelve un manifest NUEVO y NO toca el
 * anterior, para que el historial de undo/redo tenga snapshots honestos: si
 * mutara el manifest vivo, el Undo restauraria algo que nunca existio.
 *
 * Si la sección o el bloque no existen, devuelve el manifest intacto: una
 * referencia a algo que no esta nunca es un error silencioso de datos.
 */
export function setBlockConfigValue(
  manifest: ManifestLike,
  params: { sectionId: string; blockId: string; field: string; value: unknown },
): ManifestLike {
  const next = clone(manifest);
  const { sectionId, blockId, field, value } = params;
  next.sections = (next.sections || []).map((section) => {
    if (section?.id !== sectionId) return section;
    const blocks = Array.isArray(section.blocks) ? section.blocks : [];
    return {
      ...section,
      blocks: blocks.map((block: any) => (
        // Un bloque se identifica por su `instanceId`. `block.block` es el TIPO
        // ("Hero", "Image"...) y se repite; usarlo como id guardaria el valor en
        // el bloque equivocado cuando una seccion tiene varios del mismo tipo.
        block?.instanceId === blockId
          ? { ...block, config: { ...(block.config || {}), [field]: value } }
          : block
      )),
    };
  });
  return next;
}

/**
 * Bloques de una seccion que tienen al menos un campo de medio, con ese campo
 * ya resuelto desde el `configSchema` del BlockRegistry.
 *
 * El frontend NO inventa la lista: la pide al backend, que es quien valida el
 * manifest. Asi, agregar un campo `media-ref` a un bloque lo hace aparecer en el
 * editor sin tocar este archivo.
 */
export interface BlockMediaSlot {
  blockId: string;
  blockLabel: string;
  fields: Array<{ key: string; label: string; kind: 'image' | 'video'; required: boolean; value: unknown }>;
}

export function mediaSlotsOfSection(
  manifest: ManifestLike,
  sectionId: string,
  configSchemas: Record<string, Array<{ key: string; label: string; type: string; required?: boolean }>>,
): BlockMediaSlot[] {
  const section = (manifest.sections || []).find((item: any) => item?.id === sectionId);
  const blocks = Array.isArray((section as any)?.blocks) ? (section as any).blocks : [];
  const slots: BlockMediaSlot[] = [];
  for (const block of blocks) {
    // El TIPO del bloque vive en `block` (p.ej. "Hero"); `instanceId` es lo unico
    // unico. Leer `block.id` devolvia undefined y ningun esquema se resolvia,
    // por eso el inspector se quedaba sin campos de imagen ni de video.
    const blockType = String(block?.block ?? block?.id ?? '');
    const schema = configSchemas[blockType] || [];
    const fields = schema
      .filter((field) => field.type === 'media-ref')
      .map((field) => ({
        key: field.key,
        label: field.label,
        // El nombre del campo dice el tipo: `video` es video, el resto imagen.
        kind: (field.key === 'video' ? 'video' : 'image') as 'image' | 'video',
        required: Boolean(field.required),
        value: block?.config?.[field.key],
      }));
    if (fields.length) {
      slots.push({ blockId: String(block.instanceId ?? blockType), blockLabel: blockType, fields });
    }
  }
  return slots;
}

/** Mueve una seccion a una posicion (0 = primera). */
export function moveSection(manifest: ManifestLike, sectionId: string, toIndex: number): ManifestLike {
  const current = ordered(manifest.sections || []);
  const from = current.findIndex((section) => section.id === sectionId);
  if (from < 0) return clone(manifest);
  const target = Math.max(0, Math.min(toIndex, current.length - 1));
  const [moved] = current.splice(from, 1);
  current.splice(target, 0, moved);
  const next = clone(manifest);
  next.sections = current.map((section, index) => ({ ...section, order: (index + 1) * 10 }));
  return next;
}

/** Elimina una seccion del manifest. */
export function removeSection(manifest: ManifestLike, sectionId: string): ManifestLike {
  const next = clone(manifest);
  next.sections = (next.sections || []).filter((section) => section.id !== sectionId);
  return renumber(next);
}

/**
 * FASE 5 §7 — Id de sección ÚNICO al duplicar.
 *
 * Duplicar dos veces la misma sección con un sufijo fijo (`-copia`) produce dos
 * ids iguales: el manifest se rechaza por duplicado y el usuario pierde la
 * segunda copia sin explicación. Se prueba en orden hasta encontrar uno libre.
 */
export function uniqueCopySectionId(taken: string[], base: string): string {
  const used = new Set(taken);
  if (!used.has(`${base}-copia`)) return `${base}-copia`;
  let n = 2;
  while (used.has(`${base}-copia-${n}`)) n += 1;
  return `${base}-copia-${n}`;
}

/**
 * instanceId libre para un bloque, considerando TODO el manifest.
 *
 * La unicidad es GLOBAL: el backend rechaza el manifest entero (422) si dos
 * bloques comparten `instanceId`, y eso incluye los bloques aparcados en la
 * sección `extras` (regla de no-pérdida al cambiar de diseño). Derivar el id
 * solo del id de la copia hacía que, tras varias operaciones, la copia
 * colisionara y el autoguardado fallara con 422: en la UI la sección se duplicaba
 * un instante y "desaparecía" al recargar.
 */
function uniqueCopyBlockInstanceId(sections: any[], base: string): string {
  const used = new Set<string>();
  for (const section of sections) {
    for (const block of section.blocks || []) if (block.instanceId) used.add(String(block.instanceId));
  }
  const candidate = base.toLowerCase();
  if (!used.has(candidate)) return candidate;
  let n = 2;
  while (used.has(`${candidate}-${n}`)) n += 1;
  return `${candidate}-${n}`;
}

/**
 * Duplica una seccion con identidad propia (no comparte bloques).
 *
 * FASE 5 §7 — la copia es un CLON PROFUNDO real:
 *   - `id` de sección nuevo y único;
 *   - `instanceId` nuevo en cada bloque (el renderer y el autosave identifican
 *     los bloques por `instanceId`: si se compartiera, editar la copia
 *     modificaría el original);
 *   - `config` clonado objeto por objeto, para que `media`, `buttons`, `cards`,
 *     `items`, `responsive` y `styles` anidados NO queden compartidos.
 */
export function duplicateSection(manifest: ManifestLike, sectionId: string): ManifestLike {
  const current = ordered(manifest.sections || []);
  const index = current.findIndex((section) => section.id === sectionId);
  if (index < 0) return clone(manifest);
  const source = current[index];
  const id = uniqueCopySectionId(current.map((section) => section.id), source.id);
  // `clone` (structuredClone) ya corta referencias en todo el árbol anidado.
  const copy = clone(source) as typeof source;
  copy.id = id;
  copy.label = `${source.label} (copia)`;
  copy.blocks = (copy.blocks || []).map((block: any, i: number) => ({
    ...block,
    instanceId: uniqueCopyBlockInstanceId(current, `${id}-${i + 1}-${block.block}`),
  }));
  const next = clone(manifest);
  next.sections = [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
  return renumber(next);
}

/** Aplica la configuracion de una variante a un bloque, conservando el resto. */
export function applyVariantConfig(manifest: ManifestLike, blockInstanceId: string, variantConfig: Record<string, unknown>): ManifestLike {
  const next = clone(manifest);
  next.sections = (next.sections || []).map((section) => ({
    ...section,
    blocks: (section.blocks || []).map((block: any) => (block.instanceId === blockInstanceId ? { ...block, config: { ...(block.config || {}), ...(variantConfig || {}) } } : block)),
  }));
  return next;
}

/** Parchea la configuracion de un bloque (edición de contenido del manifest). */
export function patchBlockConfig(manifest: ManifestLike, blockInstanceId: string, patch: Record<string, unknown>): ManifestLike {
  const next = clone(manifest);
  next.sections = (next.sections || []).map((section) => ({
    ...section,
    blocks: (section.blocks || []).map((block: any) => (block.instanceId === blockInstanceId ? { ...block, config: { ...(block.config || {}), ...(patch || {}) } } : block)),
  }));
  return next;
}

/** ¿El manifest es utilizable por el motor V2 (no legacy, con secciones)? */
export function isUsableManifest(manifest: unknown): boolean {
  const value = manifest as any;
  return Boolean(value && value.legacy !== true && Array.isArray(value.sections) && value.sections.length > 0);
}

/**
 * YESYES BUSINESS — AUTOSAVE DEL MANIFEST (Fase 4.2 · C · §11).
 *
 *   edición → estado local → debounce → save manifest → revision
 *
 * Reglas que implementa (nunca "inventar concurrencia", solo lo necesario):
 *  - no guarda en cada tecla: agrupa con debounce;
 *  - nunca hay dos saves simultaneos: si llega un cambio mientras guarda, se
 *    guarda el ULTIMO estado al terminar (latest-wins), no el de antes;
 *  - una respuesta vieja no pisa una edicion reciente: solo se acepta la
 *    respuesta del save vigente;
 *  - ante conflicto de revision (`conflict: true`) se DETIENE el autosave, se
 *    recarga el manifest del servidor y se informa. Nunca se sobrescribe en
 *    silencio.
 *
 * Es una maquina sin React a proposito: se puede ejercitar en tests sin montar
 * la interfaz.
 */

export interface AutosaveStatus {
  state: BuilderSaveState;
  error: string;
  conflict: boolean;
}

export interface ManifestAutosaveOptions<T> {
  /** Persiste el manifest. Debe rechazar con `{ conflict: true }` ante conflicto. */
  save: (manifest: T) => Promise<any>;
  /** Recarga el manifest del servidor (usado ante conflicto). */
  reload?: () => Promise<T>;
  onStatus?: (status: AutosaveStatus) => void;
  /** E §14 — Recibe la revisión LOCAL que se terminó de guardar. */
  onSaved?: (manifest: T, revision: number) => void;
  onConflict?: (manifest: T | null) => void;
  debounceMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: any) => void;
}

export interface ManifestAutosave<T> {
  /** Encola un manifest para guardar (debounce). */
  schedule: (manifest: T) => void;
  /** Fuerza el guardado inmediato (botón Guardar / antes de publicar). */
  flush: () => Promise<boolean>;
  /** Indica si hay un guardado en vuelo. */
  isSaving: () => boolean;
  /** E §14 — Revisión local del último estado encolado (latest-wins). */
  pendingRevision: () => number;
  /** Detiene el autosave (conflicto o cierre del editor). */
  stop: () => void;
}

const isConflict = (error: any): boolean => Boolean(error && (error.conflict === true || error?.response?.status === 409));

export function createManifestAutosave<T>(options: ManifestAutosaveOptions<T>): ManifestAutosave<T> {
  const debounceMs = options.debounceMs ?? 1200;
  const setTimer = options.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer || ((handle) => clearTimeout(handle));

  let timer: any = null;
  let saving = false;
  let stopped = false;
  /** Promesa del save en vuelo: permite esperar a que termine (E §14). */
  let chain: Promise<boolean> | null = null;
  /**
   * E §14 — Revisión local monotónica. Cada `schedule` la incrementa; el trabajo en
   * vuelo guarda la MISMA revisión que tenía al salir. Al volver de `save`, si la
   * revisión vigente ya es mayor, la respuesta vieja se descarta: un Undo que
   * ocurrió durante el vuelo de B nunca puede ser pisado por la respuesta de B.
   */
  let revision = 0;
  let lastSavedRevision = 0;
  /** Manifest pendiente de guardar (el mas reciente gana). */
  let pending: { manifest: T; revision: number } | null = null;
  /** Manifest que se esta guardando ahora. */
  let inFlight: { manifest: T; revision: number } | null = null;

  const emit = (patch: Partial<AutosaveStatus>) => {
    options.onStatus?.(patch as AutosaveStatus);
  };

  const run = async (): Promise<boolean> => {
    if (stopped || saving || !pending) return true;
    const job = pending;
    pending = null;
    inFlight = job;
    saving = true;
    emit({ state: 'SAVING', error: '', conflict: false });
    chain = (async () => {
    try {
      const result = await options.save(job.manifest);
      saving = false;
      inFlight = null;
      if (stopped) return false;
      // Latest-wins: si edito (o hice Undo) mientras guardaba, se encola otra vuelta
      // con el estado mas reciente. La respuesta vieja jamas pisa una edicion nueva.
      emit({ state: pending ? 'DIRTY' : 'SAVED', error: '', conflict: false });
      // E §14 — Solo se acepta la respuesta si no llegó algo más nuevo mientras tanto.
      if (job.revision >= lastSavedRevision) {
        lastSavedRevision = job.revision;
        options.onSaved?.((result && result.manifest) || job.manifest, job.revision);
      }
      if (pending) return run();
      return true;
    } catch (error: any) {
      saving = false;
      inFlight = null;
      if (isConflict(error)) {
        // Conflicto: se detiene el autosave y se recarga. No se pisa nada.
        stopped = true;
        if (timer) { clearTimer(timer); timer = null; }
        const serverManifest = error?.response?.data?.manifest || error?.manifest || null;
        emit({ state: 'ERROR', conflict: true, error: 'La pagina cambio en otra pestana. Recargamos la version mas reciente.' });
        options.onConflict?.(serverManifest);
        if (options.reload && !serverManifest) {
          try { const fresh = await options.reload(); options.onSaved?.(fresh, job.revision); } catch { /* ya se informo el conflicto */ }
        }
        return false;
      }
      emit({ state: 'ERROR', conflict: false, error: 'No se pudo guardar. Reintentamos al proximo cambio.' });
      return false;
    }
    })();
    return chain;
  };

  const schedule = (manifest: T) => {
    if (stopped) return;
    revision += 1;
    pending = { manifest, revision };
    emit({ state: 'DIRTY', error: '', conflict: false });
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; void run(); }, debounceMs);
  };

  /**
   * E §14 — `flush` debe devolver `true` solo cuando lo encolado REALMENTE está
   * guardado. Antes devolvía `true` de inmediato si había un save en vuelo,
   * dejando el último estado (p. ej. el de un Undo) sin persistir.
   */
  const flush = async (): Promise<boolean> => {
    if (timer) { clearTimer(timer); timer = null; }
    // Se espera a que termine la cadena vigente: el save en vuelo y, si quedó algo
    // encolado durante él, la vuelta latest-wins que lo persiste.
    while (saving || pending) {
      if (!saving) await run();
      else await chain;
    }
    return !stopped;
  };

  return {
    schedule,
    flush,
    isSaving: () => saving || Boolean(inFlight),
    pendingRevision: () => revision,
    stop: () => { stopped = true; if (timer) { clearTimer(timer); timer = null; } },
  };
}

