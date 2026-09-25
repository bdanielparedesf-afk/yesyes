import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES: { code: any; name: string; order: number }[] = [
  { code: 'HAIR', name: 'Peluquería', order: 1 },
  { code: 'BARBER', name: 'Barbería', order: 2 },
  { code: 'BAKERY', name: 'Pastelería y Panadería', order: 3 },
  { code: 'FLOWERS', name: 'Floristería', order: 4 },
  { code: 'FOOD', name: 'Comida', order: 5 },
  { code: 'BOUTIQUE', name: 'Boutique', order: 6 },
  { code: 'FURNITURE', name: 'Mueblería', order: 7 },
  { code: 'REAL_ESTATE', name: 'Inmobiliaria', order: 8 },
  { code: 'MECHANIC', name: 'Mecánica', order: 9 },
  { code: 'PHONE', name: 'Reparación Celulares', order: 10 },
  { code: 'CLEANING', name: 'Limpieza', order: 11 },
  { code: 'PHOTO', name: 'Fotografía', order: 12 },
  { code: 'TUTORING', name: 'Clases Particulares', order: 13 },
  { code: 'CONSTRUCTION', name: 'Construcción', order: 14 },
  { code: 'BEAUTY', name: 'Belleza', order: 15 },
  { code: 'PET', name: 'Peluquería Canina', order: 16 },
  { code: 'DETAILING', name: 'Cuidado vehicular', order: 17 },
  { code: 'CAFE', name: 'Cafetería', order: 18 },
  { code: 'NAILS', name: 'Uñas', order: 19 },
  { code: 'FITNESS', name: 'Gimnasio y Fitness', order: 20 },
  { code: 'AUTO', name: 'Automotriz', order: 21 },
  { code: 'PRO', name: 'Servicios Profesionales', order: 22 },
];

const CATEGORY_DEFAULTS: Record<string, string[]> = {
  FOOD: ['CATALOG', 'PRODUCTS', 'DELIVERY', 'PROMOTIONS', 'OPENING_HOURS'], CAFE: ['CATALOG', 'PRODUCTS', 'GALLERY', 'PROMOTIONS', 'OPENING_HOURS'], BOUTIQUE: ['CATALOG', 'PRODUCTS', 'GALLERY', 'PROMOTIONS'], FURNITURE: ['CATALOG', 'GALLERY', 'PORTFOLIO'], MECHANIC: ['SERVICES', 'BRANDS', 'BEFORE_AFTER', 'BOOKING'], PHONE: ['PRODUCTS', 'SERVICES', 'REPAIR'], CLEANING: ['SERVICES', 'PRICING', 'BOOKING'], PHOTO: ['PORTFOLIO', 'GALLERY', 'SERVICES', 'BOOKING'], TUTORING: ['SUBJECTS', 'SERVICES', 'TEAM', 'BOOKING'], CONSTRUCTION: ['SERVICES', 'PORTFOLIO', 'GALLERY'], BEAUTY: ['SERVICES', 'PRICING', 'GALLERY', 'BOOKING'], PET: ['SERVICES', 'PRODUCTS', 'GALLERY', 'BOOKING'], DETAILING: ['SERVICES', 'PRICING', 'BEFORE_AFTER', 'GALLERY', 'BOOKING'], NAILS: ['SERVICES', 'PRICING', 'GALLERY', 'PROMOTIONS', 'BOOKING'], FITNESS: ['SERVICES', 'PRODUCTS', 'TEAM', 'GALLERY', 'BOOKING'], AUTO: ['SERVICES', 'BEFORE_AFTER', 'GALLERY', 'PROMOTIONS', 'BOOKING'], PRO: ['SERVICES', 'TEAM', 'PORTFOLIO', 'TESTIMONIALS', 'FAQ', 'BOOKING', 'CONTACT'],
};
const TEMPLATES: { code: string; category: any; name: string; capabilities: string[] }[] = [
  { code: 'HAIR_01', category: 'HAIR', name: 'Peluquería Hero', capabilities: ['SERVICES', 'TEAM', 'PORTFOLIO', 'WHATSAPP', 'MAP', 'SOCIALS'] },
  { code: 'HAIR_02', category: 'HAIR', name: 'Peluquería Cards', capabilities: ['SERVICES', 'TEAM', 'PORTFOLIO', 'WHATSAPP', 'MAP', 'SOCIALS'] },
  { code: 'HAIR_03', category: 'HAIR', name: 'Peluquería Editorial', capabilities: ['SERVICES', 'TEAM', 'PORTFOLIO', 'WHATSAPP', 'MAP', 'SOCIALS'] },
  { code: 'BARBER_01', category: 'BARBER', name: 'Barbería Clásica', capabilities: ['SERVICES', 'TEAM', 'PORTFOLIO', 'WHATSAPP', 'MAP', 'SOCIALS'] },
  { code: 'BAKERY_01', category: 'BAKERY', name: 'Pastelería Foto', capabilities: ['CATALOG', 'GALLERY', 'DELIVERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'BAKERY_02', category: 'BAKERY', name: 'Pastelería Cálida', capabilities: ['CATALOG', 'GALLERY', 'DELIVERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'BAKERY_03', category: 'BAKERY', name: 'Pastelería Minimal', capabilities: ['CATALOG', 'GALLERY', 'DELIVERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'BAKERY_04', category: 'BAKERY', name: 'Pastelería Festiva', capabilities: ['CATALOG', 'GALLERY', 'DELIVERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_01', category: 'FLOWERS', name: 'Floristería Ocasiones', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_02', category: 'FLOWERS', name: 'Floristería Fresca', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_03', category: 'FLOWERS', name: 'Floristería Elegante', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_04', category: 'FLOWERS', name: 'Floristería Boutique', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_01', category: 'REAL_ESTATE', name: 'Inmobiliaria Filtros', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_02', category: 'REAL_ESTATE', name: 'Inmobiliaria Destacadas', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_03', category: 'REAL_ESTATE', name: 'Inmobiliaria Mapa', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_04', category: 'REAL_ESTATE', name: 'Inmobiliaria Premium', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FOOD_01', category: 'FOOD', name: 'Restaurante Editorial', capabilities: ['PRODUCTS', 'CATALOG', 'GALLERY', 'PROMOTIONS', 'OPENING_HOURS', 'MAP', 'CONTACT', 'WHATSAPP'] },
  { code: 'BOUTIQUE_01', category: 'BOUTIQUE', name: 'Boutique Premium', capabilities: ['PRODUCTS', 'CATALOG', 'GALLERY', 'PROMOTIONS', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'PHOTO_01', category: 'PHOTO', name: 'Portafolio fotográfico', capabilities: ['PORTFOLIO', 'GALLERY', 'SERVICES', 'TESTIMONIALS', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'BEAUTY_01', category: 'BEAUTY', name: 'Belleza Serena', capabilities: ['SERVICES', 'PRICING', 'TEAM', 'GALLERY', 'TESTIMONIALS', 'PROMOTIONS', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'DETAILING_01', category: 'DETAILING', name: 'Cuidado vehicular', capabilities: ['SERVICES', 'PRICING', 'BEFORE_AFTER', 'GALLERY', 'TESTIMONIALS', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'CLEANING_01', category: 'CLEANING', name: 'Servicios Profesionales', capabilities: ['SERVICES', 'FEATURES', 'TEAM', 'TESTIMONIALS', 'FAQ', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'MECHANIC_01', category: 'MECHANIC', name: 'Servicio Automotriz', capabilities: ['SERVICES', 'BEFORE_AFTER', 'GALLERY', 'TESTIMONIALS', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'TUTORING_01', category: 'TUTORING', name: 'Profesionales', capabilities: ['SERVICES', 'TEAM', 'FEATURES', 'FAQ', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'CONSTRUCTION_01', category: 'CONSTRUCTION', name: 'Proyectos Profesionales', capabilities: ['SERVICES', 'PORTFOLIO', 'GALLERY', 'TEAM', 'TESTIMONIALS', 'CONTACT', 'WHATSAPP'] },
  { code: 'CAFE_01', category: 'CAFE', name: 'Café Artesanal', capabilities: ['CATALOG', 'PRODUCTS', 'GALLERY', 'PROMOTIONS', 'OPENING_HOURS', 'MAP', 'CONTACT', 'WHATSAPP'] },
  { code: 'NAILS_01', category: 'NAILS', name: 'Uñas y Cuidado', capabilities: ['SERVICES', 'PRICING', 'GALLERY', 'PROMOTIONS', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'PETS_01', category: 'PET', name: 'Cuidado de Mascotas', capabilities: ['SERVICES', 'PRODUCTS', 'GALLERY', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'FITNESS_01', category: 'FITNESS', name: 'Entrenamiento con Energía', capabilities: ['SERVICES', 'PRODUCTS', 'TEAM', 'GALLERY', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
  { code: 'AUTO_01', category: 'AUTO', name: 'Automotriz Técnico', capabilities: ['SERVICES', 'BEFORE_AFTER', 'GALLERY', 'PROMOTIONS', 'BOOKING', 'MAP', 'CONTACT', 'WHATSAPP'] },
  { code: 'PRO_01', category: 'PRO', name: 'Profesional de Confianza', capabilities: ['SERVICES', 'TEAM', 'PORTFOLIO', 'TESTIMONIALS', 'FAQ', 'BOOKING', 'CONTACT', 'WHATSAPP'] },
];

// Añade tres alternativas coherentes con cada rubro. El nombre comunica la dirección visual.
const SIGNATURE_CATEGORIES = ['FLOWERS', 'BARBER', 'HAIR', 'BAKERY', 'FOOD', 'CAFE', 'BOUTIQUE', 'FURNITURE', 'REAL_ESTATE', 'MECHANIC', 'PHONE', 'CLEANING', 'PHOTO', 'TUTORING', 'CONSTRUCTION', 'BEAUTY', 'NAILS', 'PET', 'FITNESS', 'AUTO', 'PRO', 'DETAILING'];
const SIGNATURE_VARIANTS = [
  { suffix: 'EDITORIAL', name: 'Esencial' },
  { suffix: 'ATLAS', name: 'Dirección' },
  { suffix: 'NATIVE', name: 'Cercano' },
];
for (const category of SIGNATURE_CATEGORIES) {
  for (const variant of SIGNATURE_VARIANTS) {
    TEMPLATES.push({ code: `${category}_SIGNATURE_${variant.suffix}`, category, name: `${CATEGORIES.find((item) => item.code === category)?.name || category} ${variant.name}`, capabilities: ['HERO', 'SERVICES', 'PRODUCTS', 'CATALOG', 'GALLERY', 'PORTFOLIO', 'PROPERTIES', 'CONTACT', 'WHATSAPP'] });
  }
}

async function main() {
  for (const c of CATEGORIES) {
    await prisma.businessCategory.upsert({ where: { code: c.code }, update: { name: c.name, order: c.order, active: true, defaultCapabilities: CATEGORY_DEFAULTS[c.code] || [] }, create: { code: c.code, name: c.name, order: c.order, active: true, defaultCapabilities: CATEGORY_DEFAULTS[c.code] || [] } });
  }
  for (const t of TEMPLATES) {
    await prisma.businessTemplate.upsert({
      where: { code: t.code },
      update: { name: t.name, category: t.category, capabilities: t.capabilities, active: true },
      create: { code: t.code, name: t.name, category: t.category, capabilities: t.capabilities, active: true },
    });
  }
  console.log(`Business seed OK: ${CATEGORIES.length} categorias, ${TEMPLATES.length} templates`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
