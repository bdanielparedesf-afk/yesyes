export type TypographyOption = { id: string; label: string; heading: string; body: string; sample: string };
export const TYPOGRAPHIES: TypographyOption[] = [
  { id: 'elegante', label: 'Elegante', heading: 'Georgia, serif', body: 'Arial, sans-serif', sample: 'Elegancia que perdura' },
  { id: 'moderna', label: 'Moderna', heading: 'Arial, sans-serif', body: 'Arial, sans-serif', sample: 'Claridad y modernidad' },
  { id: 'clasica', label: 'Clásica', heading: 'Palatino, Georgia, serif', body: 'Georgia, serif', sample: 'Un estilo atemporal' },
  { id: 'minimalista', label: 'Minimalista', heading: 'Helvetica, Arial, sans-serif', body: 'Arial, sans-serif', sample: 'Simple y esencial' },
  { id: 'editorial', label: 'Editorial', heading: 'Georgia, serif', body: 'Arial, sans-serif', sample: 'Ideas con contenido' },
];
export function typographyById(id?: string | null): TypographyOption { return TYPOGRAPHIES.find((item) => item.id === id) || TYPOGRAPHIES[1]; }
