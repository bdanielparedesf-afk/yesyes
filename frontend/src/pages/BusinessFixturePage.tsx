import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import BusinessShell from '@/business/BusinessShell';
import BusinessPageRenderer from '@/business/BusinessPageRenderer';
import { categoryLabel } from '@/business/businessLabels';
import { thematicAssets } from '@/business/assets';
import { presetsForCategory } from '@/business/visual/visualTokens';

const CATEGORIES = ['FLOWERS', 'BARBER', 'HAIR', 'BAKERY', 'FOOD', 'CAFE', 'BOUTIQUE', 'FURNITURE', 'REAL_ESTATE', 'MECHANIC', 'PHONE', 'CLEANING', 'PHOTO', 'TUTORING', 'CONSTRUCTION', 'BEAUTY', 'NAILS', 'PET', 'FITNESS', 'AUTO', 'PRO', 'DETAILING'];
const VARIANTS = [{ id: 'EDITORIAL', label: 'Esencial' }, { id: 'ATLAS', label: 'Dirección' }, { id: 'NATIVE', label: 'Cercano' }];
const SECTIONS = ['HERO', 'SERVICES', 'PRODUCTS', 'CATALOG', 'PROPERTIES', 'GALLERY', 'PORTFOLIO', 'PROMOTIONS', 'TESTIMONIALS', 'FAQ', 'TEAM', 'BOOKING', 'CONTACT', 'CTA'];

export default function BusinessFixturePage() {
  const { category: categoryParam = 'FLOWERS' } = useParams();
  const [params, setParams] = useSearchParams();
  const requested = String(categoryParam).toUpperCase().replace(/-/g, '_');
  const selectedCategory = String(params.get('category') || requested).toUpperCase().replace(/-/g, '_');
  const category = CATEGORIES.includes(selectedCategory) ? selectedCategory : 'FLOWERS';
  const variant = VARIANTS.some((item) => item.id === params.get('variant')) ? params.get('variant')! : 'EDITORIAL';
  if (!import.meta.env.DEV) return <Navigate to="/404" replace />;
  const images = thematicAssets(category);
  const preset = presetsForCategory(category)[0] || {};
  const business = {
    id: `fixture-${category}`, name: `${categoryLabel(category)} Aurora`, slug: `fixture-${category.toLowerCase()}`, category, status: 'PUBLISHED', description: 'Creamos experiencias con cuidado, cercanía y atención para cada cliente.', logo: images[1]?.src, cover: images[0]?.src,
    city: 'Santiago', region: 'Región Metropolitana', phone: '+56 9 5555 5555', whatsapp: '56955555555', email: 'hola@aurora.cl', address: 'Av. Providencia 123', mapsUrl: 'https://maps.google.com',
    hours: { Lunes: '09:00–18:00', Martes: '09:00–18:00', Miércoles: '09:00–18:00', Jueves: '09:00–18:00', Viernes: '09:00–17:00', Sábado: '10:00–14:00' }, socials: { instagram: 'https://instagram.com', facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', youtube: 'https://youtube.com' },
    template: { code: `${category}_SIGNATURE_${variant}`, name: `${categoryLabel(category)} ${variant}`, category, capabilities: [] }, visual: { ...preset, sections: SECTIONS.map((id, order) => ({ id, order: (order + 1) * 10, enabled: true })) },
  };
  const services = Array.from({ length: 4 }, (_, index) => ({ id: `service-${index}`, name: ['Atención personalizada', 'Servicio destacado', 'Experiencia premium', 'Plan a medida'][index], description: 'Una propuesta pensada para ti, con comunicación directa y tiempo para cada detalle.', price: [25000, 35000, 45000, 55000][index], image: images[index % images.length]?.src }));
  const products = Array.from({ length: 4 }, (_, index) => ({ id: `product-${index}`, name: ['Colección esencial', 'Selección del mes', 'Favorito de clientes', 'Edición limitada'][index], description: 'Diseñado para mejorar tu experiencia.', price: [18900, 24900, 29900, 35900][index], salePrice: [18900, 24900, 29900, 35900][index], image: images[index % images.length]?.src }));
  const gallery = Array.from({ length: 6 }, (_, index) => ({ id: `gallery-${index}`, url: images[index % images.length]?.src, alt: `Galería de ${business.name}` }));
  const properties = [{ id: 'property-1', title: 'Casa luminosa en Providencia', price: 189000000, operation: 'VENTA', type: 'Casa', city: 'Santiago', address: 'Av. Providencia 123', bedrooms: 3, bathrooms: 2, parking: 2, areaTotal: 180, featured: true, images: [{ url: images[0]?.src }] }];
  const team = [{ id: 'team-1', name: 'Camila Rojas', role: 'Especialista', bio: 'Acompaña cada proceso con atención y detalle.' }, { id: 'team-2', name: 'Tomás Silva', role: 'Asesor', bio: 'Acompañamiento claro y personalizado.' }];
  const testimonials = [{ id: 't1', name: 'María López', content: 'Una experiencia clara, cálida y profesional.' }, { id: 't2', name: 'Carlos Pérez', content: 'Todo fue muy fácil y el resultado superó lo esperado.' }];
  const faqs = [{ id: 'f1', question: '¿Cómo puedo agendar?', answer: 'Escríbenos por WhatsApp y te ayudaremos a encontrar el mejor horario.' }, { id: 'f2', question: '¿Atienden entregas?', answer: 'Sí, coordinamos entregas y retiro según disponibilidad.' }];
  const promotions = [{ id: 'pr1', title: 'Promoción de temporada', description: 'Consulta por esta especial selección para tu próxima visita.' }];
  const bookingSlots = [{ id: 'b1', weekday: 1, startTime: '10:00', endTime: '11:00' }, { id: 'b2', weekday: 3, startTime: '16:00', endTime: '17:00' }];
  const select = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); };
  return <TestPreview business={business} services={services} products={products} properties={properties} gallery={gallery} testimonials={testimonials} faqs={faqs} promotions={promotions} team={team} bookingSlots={bookingSlots} category={category} variant={variant} select={select} />;
}

function TestPreview({ business, services, products, properties, gallery, testimonials, faqs, promotions, team, bookingSlots, category, variant, select }: any) {
  return <div className="min-h-screen bg-stone-900"><div className="sticky top-0 z-[60] border-b border-white/10 bg-stone-950/95 px-4 py-3 text-white backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3"><strong className="mr-auto text-sm">QA · Todos los campos completos</strong><label className="text-xs">Rubro <select className="ml-2 rounded-lg bg-white/10 p-2" value={category} onChange={(e) => select('category', e.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label><label className="text-xs">Diseño <select className="ml-2 rounded-lg bg-white/10 p-2" value={variant} onChange={(e) => select('variant', e.target.value)}>{VARIANTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div></div><BusinessShell business={business}><BusinessPageRenderer business={business} services={services} products={products} properties={properties} gallery={gallery} testimonials={testimonials} faqs={faqs} promotions={promotions} team={team} bookingSlots={bookingSlots} preview /></BusinessShell></div>;
}
