import { Navigate, useParams } from 'react-router-dom';
import BusinessShell from '@/business/BusinessShell';
import BusinessPageRenderer from '@/business/BusinessPageRenderer';
import { categoryLabel } from '@/business/businessLabels';
import { thematicAssets } from '@/business/assets';

const CODES: Record<string, string> = {
  FLOWERS: 'FLOWERS_01', BARBER: 'BARBER_01', HAIR: 'HAIR_01', CAFE: 'CAFE_01', FOOD: 'FOOD_01',
  BAKERY: 'BAKERY_01', NAILS: 'NAILS_01', PET: 'PETS_01', FITNESS: 'FITNESS_01', AUTO: 'AUTO_01',
  REAL_ESTATE: 'REAL_ESTATE_01', BOUTIQUE: 'BOUTIQUE_01', PHOTO: 'PHOTO_01', PRO: 'PRO_01',
};

export default function BusinessFixturePage() {
  const { category = '' } = useParams();
  const code = category.toUpperCase();
  if (!import.meta.env.DEV || !CODES[code]) return <Navigate to="/404" replace />;
  const images = thematicAssets(code);
  const business = {
    id: `fixture-${code}`, name: `${categoryLabel(code)} Aurora`, slug: `fixture-${code.toLowerCase()}`, category: code,
    status: 'PUBLISHED', description: 'Una experiencia creada con cuidado, cercanía y atención para cada cliente.',
    city: 'Santiago', region: 'Región Metropolitana', phone: '+56 9 5555 5555', whatsapp: '56955555555',
    address: 'Av. Providencia 123', mapsUrl: 'https://maps.google.com', hours: { Lunes: '09:00–18:00', Martes: '09:00–18:00', Miércoles: '09:00–18:00', Jueves: '09:00–18:00', Viernes: '09:00–17:00' },
    socials: { instagram: 'https://instagram.com' }, template: { code: CODES[code], name: categoryLabel(code), category: code, capabilities: [] },
    visual: { sections: ['HERO', 'SERVICES', 'PRODUCTS', 'GALLERY', 'CONTACT'].map((id, order) => ({ id, order: (order + 1) * 10, enabled: true })) },
  };
  const services = Array.from({ length: 3 }, (_, index) => ({ id: `service-${index}`, name: ['Servicio destacado', 'Atención personalizada', 'Experiencia premium'][index], description: 'Una propuesta diseñada para ti.', price: [25000, 35000, 45000][index], image: images[index % images.length]?.src }));
  const products = Array.from({ length: 3 }, (_, index) => ({ id: `product-${index}`, name: ['Colección esencial', 'Selección del mes', 'Favorito de clientes'][index], description: 'Diseñado para mejorar tu experiencia.', price: [18900, 24900, 29900][index], image: images[index % images.length]?.src, salePrice: [18900, 24900, 29900][index] }));
  const gallery = images.map((image, index) => ({ id: `gallery-${index}`, url: image.src, alt: image.alt }));
  const properties = code === 'REAL_ESTATE' ? [
    { id: 'property-1', title: 'Casa luminosa en Providencia', price: 189000000, operation: 'VENTA', type: 'Casa', city: 'Santiago', address: 'Av. Providencia 123', bedrooms: 3, bathrooms: 2, parking: 2, areaTotal: 180, featured: true, images: [{ url: images[0]?.src }] },
    { id: 'property-2', title: 'Depto. con vista al parque', price: 95000, operation: 'ARRIENDO', type: 'Departamento', city: 'Santiago', address: 'Av. El Llano 456', bedrooms: 2, bathrooms: 1, parking: 1, areaTotal: 78, images: [{ url: images[1]?.src }] },
    { id: 'property-3', title: 'Casa de estilo mediterráneo', price: 245000000, operation: 'VENTA', type: 'Casa', city: 'Vitacura', address: 'Camino el Alba 789', bedrooms: 4, bathrooms: 3, parking: 2, areaTotal: 260, images: [{ url: images[0]?.src }] },
  ] : [];
  const team = code === 'FITNESS' ? [
    { id: 'trainer-1', name: 'Camila Rojas', role: 'Entrenadora funcional', bio: 'Acompaña objetivos realistas y constantes.' },
    { id: 'trainer-2', name: 'Tomás Silva', role: 'Preparador físico', bio: 'Rendimiento y técnica en cada sesión.' },
  ] : [];
  return <BusinessShell business={business}><BusinessPageRenderer business={business} services={services} products={products} properties={properties} gallery={gallery} testimonials={[{ id: 't1', name: 'Cliente YesYes', content: 'Una experiencia clara, cálida y profesional.' }]} faqs={[]} promotions={[]} team={team} bookingSlots={[]} preview /> </BusinessShell>;
}
