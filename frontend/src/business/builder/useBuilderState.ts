import { useCallback, useEffect, useReducer } from 'react';
import { normalizeSections, type BuilderAction, type BuilderSaveState, type BuilderSection, type BuilderSnapshot, type BuilderState } from './types';

const initialState: BuilderState = {
  business: null, sections: [], selectedSection: 'HERO', selectedElement: null, device: 'desktop',
  saveState: 'CLEAN', error: '', preview: false, history: [], future: [],
};

function withHistory(state: BuilderState, patch: Partial<BuilderSnapshot>): BuilderState {
  const snapshot = { business: state.business, sections: state.sections };
  return { ...state, ...patch, saveState: 'DIRTY', error: '', history: [...state.history.slice(-39), snapshot], future: [] };
}
function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'LOAD': return { ...state, business: action.business, sections: normalizeSections(action.sections), selectedSection: action.sections[0]?.id || 'HERO', saveState: 'CLEAN', error: '', history: [], future: [] };
    case 'PATCH_BUSINESS': return withHistory(state, { business: { ...state.business, ...action.patch } });
    case 'SET_SECTIONS': return withHistory(state, { sections: normalizeSections(action.sections) });
    case 'SELECT': return { ...state, selectedSection: action.section, selectedElement: null };
    case 'DEVICE': return { ...state, device: action.device };
    case 'PREVIEW': return { ...state, preview: action.value };
    case 'SAVE_START': return { ...state, saveState: 'SAVING', error: '' };
    case 'SAVE_DONE': return { ...state, saveState: 'SAVED', error: '' };
    case 'SAVE_ERROR': return { ...state, saveState: 'ERROR', error: action.error };
    case 'UNDO': {
      const previous = state.history[state.history.length - 1]; if (!previous) return state;
      return { ...state, ...previous, history: state.history.slice(0, -1), future: [{ business: state.business, sections: state.sections }, ...state.future], saveState: 'DIRTY' };
    }
    case 'REDO': {
      const next = state.future[0]; if (!next) return state;
      return { ...state, ...next, history: [...state.history, { business: state.business, sections: state.sections }], future: state.future.slice(1), saveState: 'DIRTY' };
    }
    case 'DISCARD': {
      const clean = state.history[0] || { business: state.business, sections: state.sections };
      return { ...state, ...clean, saveState: 'CLEAN', history: [], future: [] };
    }
  }
}
export function useBuilderState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const changeBusiness = useCallback((patch: Record<string, unknown>) => dispatch({ type: 'PATCH_BUSINESS', patch }), []);
  const changeSections = useCallback((sections: BuilderSection[]) => dispatch({ type: 'SET_SECTIONS', sections }), []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (state.saveState === 'DIRTY' || state.saveState === 'ERROR') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [state.saveState]);
  return { state, dispatch, changeBusiness, changeSections };
}
export const saveLabel = (saveState: BuilderSaveState): string => ({ CLEAN: 'Guardado', DIRTY: 'Cambios sin guardar', SAVING: 'Guardando…', SAVED: 'Guardado', ERROR: 'No se pudo guardar' })[saveState];

