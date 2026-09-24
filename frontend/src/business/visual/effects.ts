export const EFFECTS = { ninguno: 'none', suave: '0 18px 55px rgba(0,0,0,.12)', luminoso: '0 0 80px rgba(255,255,255,.08)' } as const;
export function effectFor(value?: string | null): string { return EFFECTS[(value || 'suave') as keyof typeof EFFECTS] || EFFECTS.suave; }
