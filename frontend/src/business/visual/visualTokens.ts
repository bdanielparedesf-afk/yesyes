export type VisualPreset = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  typography: 'elegante' | 'moderna' | 'clasica' | 'minimalista' | 'editorial';
  background: string;
  shadow: 'none' | 'soft' | 'elevated' | 'dramatic';
  sectionSpacing: 'compact' | 'normal' | 'spacious';
  borderRadius: number;
  buttonStyle: 'solid' | 'outline' | 'soft';
  cardStyle: 'flat' | 'elevated' | 'bordered';
};

const common: Record<string, VisualPreset[]> = {
  elegante: [{ name: 'Elegancia discreta', primaryColor: '#342a27', secondaryColor: '#8a7770', accentColor: '#a87955', backgroundColor: '#fffdf9', textColor: '#27221d', headingFont: 'serif', bodyFont: 'system', typography: 'elegante', background: 'soft-gradient', shadow: 'none', sectionSpacing: 'spacious', borderRadius: 2, buttonStyle: 'outline', cardStyle: 'flat' }],
  moderno: [{ name: 'Moderno', primaryColor: '#1d4ed8', secondaryColor: '#64748b', accentColor: '#ea580c', backgroundColor: '#ffffff', textColor: '#0f172a', headingFont: 'geometric', bodyFont: 'system', typography: 'moderna', background: 'clean', shadow: 'soft', sectionSpacing: 'normal', borderRadius: 14, buttonStyle: 'solid', cardStyle: 'elevated' }],
  minimalista: [{ name: 'Minimalista', primaryColor: '#18181b', secondaryColor: '#71717a', accentColor: '#18181b', backgroundColor: '#fafafa', textColor: '#171717', headingFont: 'system', bodyFont: 'system', typography: 'minimalista', background: 'clean', shadow: 'none', sectionSpacing: 'compact', borderRadius: 0, buttonStyle: 'outline', cardStyle: 'flat' }],
  premium: [{ name: 'Premium', primaryColor: '#171512', secondaryColor: '#78716c', accentColor: '#b48a4c', backgroundColor: '#f5f1e8', textColor: '#1c1917', headingFont: 'display', bodyFont: 'serif', typography: 'clasica', background: 'editorial-gradient', shadow: 'elevated', sectionSpacing: 'spacious', borderRadius: 8, buttonStyle: 'solid', cardStyle: 'bordered' }],
  editorial: [{ name: 'Editorial', primaryColor: '#292524', secondaryColor: '#78716c', accentColor: '#9f6b4c', backgroundColor: '#fffaf3', textColor: '#292524', headingFont: 'serif', bodyFont: 'system', typography: 'editorial', background: 'soft-gradient', shadow: 'none', sectionSpacing: 'spacious', borderRadius: 4, buttonStyle: 'outline', cardStyle: 'bordered' }],
  artesanal: [{ name: 'Artesanal', primaryColor: '#8b4a2f', secondaryColor: '#c99d72', accentColor: '#d7a94e', backgroundColor: '#fff8ed', textColor: '#4a2e21', headingFont: 'serif', bodyFont: 'rounded', typography: 'elegante', background: 'soft-gradient', shadow: 'soft', sectionSpacing: 'spacious', borderRadius: 20, buttonStyle: 'soft', cardStyle: 'bordered' }],
  natural: [{ name: 'Natural', primaryColor: '#365c42', secondaryColor: '#8aa68e', accentColor: '#d9a86c', backgroundColor: '#f4f7f0', textColor: '#203126', headingFont: 'serif', bodyFont: 'system', typography: 'elegante', background: 'clean', shadow: 'soft', sectionSpacing: 'spacious', borderRadius: 22, buttonStyle: 'soft', cardStyle: 'elevated' }],
  urbano: [{ name: 'Urbano', primaryColor: '#111111', secondaryColor: '#525252', accentColor: '#d6a75d', backgroundColor: '#171717', textColor: '#fafafa', headingFont: 'display', bodyFont: 'system', typography: 'moderna', background: 'dark', shadow: 'dramatic', sectionSpacing: 'normal', borderRadius: 4, buttonStyle: 'solid', cardStyle: 'bordered' }],
};

const byCategory: Record<string, VisualPreset[]> = {
  FLOWERS: [...common.elegante, ...common.editorial, ...common.natural],
  BARBER: [common.premium[0], common.urbano[0]],
  HAIR: [common.elegante[0], common.editorial[0]],
  CAFE: [common.artesanal[0], common.natural[0]],
  FOOD: [common.premium[0], common.editorial[0]],
  BAKERY: [common.artesanal[0], common.editorial[0]],
  PET: [common.natural[0], common.artesanal[0]],
  FITNESS: [common.urbano[0], common.moderno[0]],
  MECHANIC: [common.urbano[0]],
  AUTO: [common.urbano[0]],
};

export function presetsForCategory(category?: string | null): VisualPreset[] {
  const code = String(category || '').toUpperCase();
  const specialized = byCategory[code];
  if (specialized) return specialized;
  if (['BEAUTY', 'NAILS'].includes(code)) return [...common.elegante, ...common.minimalista];
  if (['BOUTIQUE', 'PHOTO'].includes(code)) return [...common.editorial, ...common.minimalista];
  if (['REAL_ESTATE', 'PRO', 'CONSTRUCTION'].includes(code)) return [...common.premium, ...common.moderno];
  return [common.moderno[0], common.minimalista[0]];
}
