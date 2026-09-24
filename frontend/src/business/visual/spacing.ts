export const SECTION_SPACING = { compacto: '3rem', normal: '5rem', amplio: '7rem' } as const;
export function sectionSpacing(value?: string | null): string { return SECTION_SPACING[(value || 'normal') as keyof typeof SECTION_SPACING] || SECTION_SPACING.normal; }
