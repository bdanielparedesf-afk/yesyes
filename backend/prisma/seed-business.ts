import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES: { code: any; name: string; order: number }[] = [
  { code: 'HAIR', name: 'Peluquería', order: 1 },
  { code: 'BARBER', name: 'Barbería', order: 2 },
  { code: 'BAKERY', name: 'Pastelería y Panadería', order: 3 },
  { code: 'FLOWERS', name: 'Florería', order: 4 },
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
  { code: 'DETAILING', name: 'Detailing', order: 17 },
];

const CATEGORY_DEFAULTS: Record<string, string[]> = {
  FOOD: ['CATALOG', 'PRODUCTS', 'DELIVERY', 'PROMOTIONS', 'OPENING_HOURS'], BOUTIQUE: ['CATALOG', 'PRODUCTS', 'GALLERY', 'PROMOTIONS'], FURNITURE: ['CATALOG', 'GALLERY', 'PORTFOLIO'], MECHANIC: ['SERVICES', 'BRANDS', 'BEFORE_AFTER', 'BOOKING'], PHONE: ['PRODUCTS', 'SERVICES', 'REPAIR'], CLEANING: ['SERVICES', 'PRICING', 'BOOKING'], PHOTO: ['PORTFOLIO', 'GALLERY', 'SERVICES', 'BOOKING'], TUTORING: ['SUBJECTS', 'SERVICES', 'TEAM', 'BOOKING'], CONSTRUCTION: ['SERVICES', 'PORTFOLIO', 'GALLERY'], BEAUTY: ['SERVICES', 'PRICING', 'GALLERY', 'BOOKING'], PET: ['SERVICES', 'PRODUCTS', 'GALLERY', 'BOOKING'], DETAILING: ['SERVICES', 'PRICING', 'BEFORE_AFTER', 'GALLERY', 'BOOKING'],
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
  { code: 'FLOWERS_01', category: 'FLOWERS', name: 'Florería Ocasiones', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_02', category: 'FLOWERS', name: 'Florería Fresca', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_03', category: 'FLOWERS', name: 'Florería Elegante', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'FLOWERS_04', category: 'FLOWERS', name: 'Florería Boutique', capabilities: ['CATALOG', 'OCCASIONS', 'DELIVERY', 'GALLERY', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_01', category: 'REAL_ESTATE', name: 'Inmobiliaria Filtros', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_02', category: 'REAL_ESTATE', name: 'Inmobiliaria Destacadas', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_03', category: 'REAL_ESTATE', name: 'Inmobiliaria Mapa', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
  { code: 'REAL_ESTATE_04', category: 'REAL_ESTATE', name: 'Inmobiliaria Premium', capabilities: ['PROPERTIES', 'TEAM', 'MAP', 'CONTACT', 'WHATSAPP', 'SOCIALS'] },
];

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
  console.log('Business seed OK: 17 categorias, 16 templates');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
