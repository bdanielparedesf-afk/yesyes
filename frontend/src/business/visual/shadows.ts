export const SHADOWS = { none: 'none', soft: '0 12px 35px rgba(24,24,27,.08)', elevated: '0 22px 60px rgba(24,24,27,.14)', dramatic: '0 30px 80px rgba(0,0,0,.28)' } as const;
export function shadowFor(value?: string | null): string { return SHADOWS[(value || 'soft') as keyof typeof SHADOWS] || SHADOWS.soft; }
