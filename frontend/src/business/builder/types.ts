export type BuilderDevice = 'desktop' | 'tablet' | 'mobile';
export type BuilderSaveState = 'CLEAN' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR';
export type BuilderSection = { id: string; enabled: boolean; order: number };
export type BuilderSnapshot = { business: any; sections: BuilderSection[] };
export type BuilderState = BuilderSnapshot & {
  selectedSection: string; selectedElement: string | null; device: BuilderDevice;
  saveState: BuilderSaveState; error: string; preview: boolean;
  history: BuilderSnapshot[]; future: BuilderSnapshot[];
};
export type BuilderAction =
  | { type: 'LOAD'; business: any; sections: BuilderSection[] }
  | { type: 'PATCH_BUSINESS'; patch: Record<string, unknown> }
  | { type: 'SET_SECTIONS'; sections: BuilderSection[] }
  | { type: 'SELECT'; section: string }
  | { type: 'DEVICE'; device: BuilderDevice }
  | { type: 'PREVIEW'; value: boolean }
  | { type: 'SAVE_START' } | { type: 'SAVE_DONE' } | { type: 'SAVE_ERROR'; error: string }
  | { type: 'UNDO' } | { type: 'REDO' } | { type: 'DISCARD' };

export const normalizeSections = (sections: BuilderSection[]): BuilderSection[] => sections.map((section, index) => ({ ...section, order: (index + 1) * 10 }));
