export type IndustryComposition = {
  code: string;
  category: string;
  label: string;
  navigation: 'minimal' | 'editorial' | 'dark-premium' | 'warm' | 'friendly' | 'energetic';
  hero: 'editorial' | 'cinematic' | 'photography' | 'architectural' | 'portfolio' | 'wellness' | 'energetic' | 'friendly' | 'corporate';
  layout: 'editorial' | 'cinematic' | 'gallery' | 'commerce' | 'service' | 'editorial-grid' | 'masonry' | 'corporate';
  cards: 'editorial' | 'dark' | 'image-first' | 'premium' | 'horizontal' | 'masonry' | 'property';
  cta: string;
  secondaryCta?: string;
  imageTreatment: 'cover' | 'portrait' | 'landscape' | 'masonry' | 'overlay';
  mobileBehavior: 'stack' | 'focus-image' | 'drawer' | 'single-column';
  background: string;
  sectionStyle: 'soft' | 'paper' | 'dark' | 'warm' | 'architectural' | 'energy' | 'wellness';
};

const composition = (value: IndustryComposition) => value;

export const INDUSTRY_COMPOSITIONS: Record<string, IndustryComposition> = Object.fromEntries([
  composition({ code: 'FLOWERS_01', category: 'FLOWERS', label: 'Floristería editorial', navigation: 'editorial', hero: 'editorial', layout: 'editorial', cards: 'editorial', cta: 'Pedir por WhatsApp', secondaryCta: 'Ver colección', imageTreatment: 'landscape', mobileBehavior: 'stack', background: 'floral', sectionStyle: 'soft' }),
  composition({ code: 'BARBER_01', category: 'BARBER', label: 'Barbería premium', navigation: 'dark-premium', hero: 'cinematic', layout: 'cinematic', cards: 'dark', cta: 'Reservar hora', secondaryCta: 'Ver servicios', imageTreatment: 'overlay', mobileBehavior: 'focus-image', background: 'premium-gradient', sectionStyle: 'dark' }),
  composition({ code: 'HAIR_01', category: 'HAIR', label: 'Peluquería fashion', navigation: 'editorial', hero: 'editorial', layout: 'editorial-grid', cards: 'image-first', cta: 'Reservar cita', secondaryCta: 'Ver trabajos', imageTreatment: 'portrait', mobileBehavior: 'stack', background: 'beauty', sectionStyle: 'soft' }),
  composition({ code: 'BEAUTY_01', category: 'BEAUTY', label: 'Beauty & bienestar', navigation: 'friendly', hero: 'wellness', layout: 'service', cards: 'premium', cta: 'Reservar tratamiento', secondaryCta: 'Conocer tratamientos', imageTreatment: 'cover', mobileBehavior: 'stack', background: 'soft-gradient', sectionStyle: 'wellness' }),
  composition({ code: 'NAILS_01', category: 'NAILS', label: 'Nail studio', navigation: 'energetic', hero: 'wellness', layout: 'gallery', cards: 'image-first', cta: 'Reservar turno', secondaryCta: 'Ver galería', imageTreatment: 'portrait', mobileBehavior: 'stack', background: 'beauty', sectionStyle: 'wellness' }),
  composition({ code: 'REAL_ESTATE_01', category: 'REAL_ESTATE', label: 'Inmobiliaria arquitectónica', navigation: 'minimal', hero: 'architectural', layout: 'gallery', cards: 'property', cta: 'Consultar propiedad', secondaryCta: 'Ver portafolio', imageTreatment: 'landscape', mobileBehavior: 'single-column', background: 'premium-gradient', sectionStyle: 'architectural' }),
  composition({ code: 'BOUTIQUE_01', category: 'BOUTIQUE', label: 'Boutique editorial', navigation: 'editorial', hero: 'editorial', layout: 'commerce', cards: 'image-first', cta: 'Ver colección', secondaryCta: 'Contactar boutique', imageTreatment: 'portrait', mobileBehavior: 'stack', background: 'editorial-gradient', sectionStyle: 'soft' }),
  composition({ code: 'PHOTO_01', category: 'PHOTO', label: 'Portfolio fotográfico', navigation: 'minimal', hero: 'portfolio', layout: 'masonry', cards: 'masonry', cta: 'Solicitar presupuesto', secondaryCta: 'Ver proyectos', imageTreatment: 'masonry', mobileBehavior: 'single-column', background: 'dark', sectionStyle: 'dark' }),
  composition({ code: 'PRO_01', category: 'PRO', label: 'Servicios profesionales', navigation: 'minimal', hero: 'corporate', layout: 'corporate', cards: 'premium', cta: 'Solicitar consulta', secondaryCta: 'Conocer servicios', imageTreatment: 'cover', mobileBehavior: 'stack', background: 'premium-gradient', sectionStyle: 'architectural' }),
  composition({ code: 'CAFE_01', category: 'CAFE', label: 'Cafetería artesanal', navigation: 'warm', hero: 'photography', layout: 'gallery', cards: 'editorial', cta: 'Ver menú', secondaryCta: 'Reservar mesa', imageTreatment: 'cover', mobileBehavior: 'stack', background: 'coffee', sectionStyle: 'warm' }),
  composition({ code: 'FOOD_01', category: 'FOOD', label: 'Restaurante gastronómico', navigation: 'warm', hero: 'photography', layout: 'gallery', cards: 'image-first', cta: 'Reservar mesa', secondaryCta: 'Ver menú', imageTreatment: 'cover', mobileBehavior: 'stack', background: 'gastronomic', sectionStyle: 'warm' }),
  composition({ code: 'BAKERY_01', category: 'BAKERY', label: 'Panadería artesanal', navigation: 'warm', hero: 'photography', layout: 'commerce', cards: 'editorial', cta: 'Pedir ahora', secondaryCta: 'Ver productos', imageTreatment: 'cover', mobileBehavior: 'stack', background: 'gastronomic', sectionStyle: 'warm' }),
  composition({ code: 'PETS_01', category: 'PET', label: 'Cuidado de mascotas', navigation: 'friendly', hero: 'friendly', layout: 'service', cards: 'horizontal', cta: 'Reservar cuidado', secondaryCta: 'Conocer servicios', imageTreatment: 'cover', mobileBehavior: 'stack', background: 'soft-gradient', sectionStyle: 'soft' }),
  composition({ code: 'FITNESS_01', category: 'FITNESS', label: 'Entrenamiento de alto rendimiento', navigation: 'energetic', hero: 'energetic', layout: 'service', cards: 'dark', cta: 'Empezar ahora', secondaryCta: 'Ver programas', imageTreatment: 'overlay', mobileBehavior: 'focus-image', background: 'gym', sectionStyle: 'energy' }),
  composition({ code: 'AUTO_01', category: 'AUTO', label: 'Taller y cuidado vehicular', navigation: 'dark-premium', hero: 'cinematic', layout: 'service', cards: 'horizontal', cta: 'Solicitar cotización', secondaryCta: 'Ver servicios', imageTreatment: 'overlay', mobileBehavior: 'focus-image', background: 'automotive', sectionStyle: 'dark' }),
].map((item) => [item.code, item]));

export function getIndustryComposition(code?: string | null, category?: string | null): IndustryComposition {
  const normalized = String(code || '').toUpperCase();
  return INDUSTRY_COMPOSITIONS[normalized]
    || Object.values(INDUSTRY_COMPOSITIONS).find((item) => item.category === String(category || '').toUpperCase())
    || INDUSTRY_COMPOSITIONS.PRO_01;
}

export const CANONICAL_INDUSTRY_CODES = Object.keys(INDUSTRY_COMPOSITIONS);

