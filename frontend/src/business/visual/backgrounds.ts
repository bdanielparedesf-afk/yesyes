export type BackgroundOption = { id: string; name: string; css: string; image?: string; categories: string[] };
const all = '*';
export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'clean', name: 'Fondo limpio', css: '#fffdf8', categories: [all] },
  { id: 'soft-gray', name: 'Gris suave', css: '#f4f4f2', categories: [all] },
  { id: 'dark', name: 'Negro', css: '#111111', categories: ['BARBER', 'FITNESS', 'MECHANIC', 'PHOTO', 'PRO'] },
  { id: 'soft-gradient', name: 'Degradado suave', css: 'linear-gradient(135deg,#fff7f2,#eef4ef)', categories: [all] },
  { id: 'editorial-gradient', name: 'Degradado editorial', css: 'linear-gradient(135deg,#3b2a24,#9a7058)', categories: ['BARBER','FOOD','BAKERY','PHOTO','BOUTIQUE'] },
  { id: 'premium-gradient', name: 'Degradado premium', css: 'linear-gradient(125deg,#111,#3f3a31)', categories: ['BARBER','FOOD','FLOWERS','REAL_ESTATE','BOUTIQUE','PRO'] },
  { id: 'floral', name: 'Ambiente floral', css: 'linear-gradient(135deg,#fff4f0,#ead7d8)', categories: ['FLOWERS'] },
  { id: 'gastronomic', name: 'Ambiente gastronómico', css: 'linear-gradient(135deg,#321a14,#9b5538)', categories: ['FOOD','BAKERY'] },
  { id: 'coffee', name: 'Ambiente de cafetería', css: 'linear-gradient(135deg,#2f1d16,#8b5e42)', categories: ['CAFE'] },
  { id: 'beauty', name: 'Ambiente de belleza', css: 'linear-gradient(135deg,#f9e8e6,#cfa8b6)', categories: ['HAIR','BEAUTY','NAILS'] },
  { id: 'gym', name: 'Ambiente de gimnasio', css: 'linear-gradient(125deg,#111827,#334155)', categories: ['FITNESS'] },
  { id: 'automotive', name: 'Ambiente automotriz', css: 'linear-gradient(125deg,#0f172a,#334155)', categories: ['MECHANIC','DETAILING','AUTO'] },
];
export function backgroundsForCategory(category?: string | null): BackgroundOption[] {
  const code = String(category || '').toUpperCase();
  return BACKGROUNDS.filter((item) => item.categories.includes(all) || item.categories.includes(code));
}
export function backgroundById(id?: string | null): BackgroundOption {
  return BACKGROUNDS.find((item) => item.id === id) || BACKGROUNDS[0];
}
