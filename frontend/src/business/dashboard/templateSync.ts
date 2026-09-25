export interface TemplateOption {
  id: string;
  code: string;
  name: string;
  category: string;
  capabilities: string[];
}

export interface LatestTemplatesRequestHandlers<T> {
  onStart: (category: string) => void;
  onSuccess: (category: string, templates: T[]) => void;
  onError: (category: string) => void;
}

/** Prevent every response except the latest request from updating UI state. */
export function createLatestTemplatesRequest<T>(
  request: (category: string) => Promise<T[]>,
  handlers: LatestTemplatesRequestHandlers<T>,
) {
  let version = 0;

  return {
    async load(category: string) {
      const requestVersion = ++version;
      handlers.onStart(category);
      try {
        const templates = await request(category);
        if (requestVersion !== version) return;
        handlers.onSuccess(category, templates);
      } catch {
        if (requestVersion !== version) return;
        handlers.onError(category);
      }
    },
    invalidate() {
      version += 1;
    },
  };
}

/** A persisted or previously selected template is valid only in its own category list. */
export function reconcileTemplateId<T extends { id: string }>(templateId: string, templates: T[]) {
  return templateId && templates.some((template) => template.id === templateId) ? templateId : '';
}
