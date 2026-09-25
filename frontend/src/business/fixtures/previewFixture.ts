import { categoryLabel } from '../businessLabels';
import { canonicalCategoryCode } from '../taxonomy';
import { thematicAssets } from '../assets';
import { getCategoryComposition } from '../categoryRegistry';
import { presetsForCategory } from '../visual/visualTokens';

/**
 * Contenido de demostración para vistas previas REALES.
 *
 * La galería de diseños y la página de QA usan ESTE MISMO builder con el
 * renderer real (`BusinessPageRenderer`): la miniatura muestra exactamente lo
 * que se verá, sin inventar una maqueta distinta.
 */

export interface PreviewFixture {
  business: any;
  services: any[];
  products: any[];
  properties: any[];
  gallery: any[];
  testimonials: any[];
  faqs: any[];
  promotions: any[];
  team: any[];
  bookingSlots: any[];
}

const SERVICE_NAMES: Record<string, string[]> = {
  default: ['Atención personalizada', 'Servicio destacado', 'Experiencia premium', 'Plan a medida'],
  HAIR: ['Corte y peinado', 'Coloración', 'Tratamiento capilar', 'Balayage'],
  BARBER: ['Corte clásico', 'Arreglo de barba', 'Afeitado clásico', 'Corte y barba'],
  NAILS: ['Manicure semipermanente', 'Pedicure spa', 'Diseño de uñas', 'Acabado en gel'],
  BEAUTY: ['Limpieza facial', 'Masaje relajante', 'Tratamiento de piel', 'Ritual de bienestar'],
  FOOD: ['Plato de la casa', 'Menú del día', 'Tabla para compartir', 'Combo familiar'],
  CAFE: ['Espresso doble', 'Café de especialidad', 'Torta del día', 'Desayuno completo'],
  BAKERY: ['Pan artesanal', 'Torta de cumpleaños', 'Medialunas', 'Caja de pastelería'],
  BOUTIQUE: ['Colección essentials', 'Edición limitada', 'Set de regalo', 'Bestseller'],
  FLOWERS: ['Ramo de rosas', 'Arreglo gourmet', 'Flores de temporada', 'Gift box'],
  FURNITURE: ['Proyecto completo', 'Mesa de comedor', 'Estantería a medida', 'Sala de estar'],
  CLEANING: ['Limpieza integral', 'Limpieza de profundidad', 'Lavado de alfombras', 'Servicio mensual'],
  TUTORING: ['Clase particular', 'Taller de grupo', 'Refuerzo escolar', 'Mentoría'],
  PRO: ['Diagnóstico inicial', 'Acompañamiento mensual', 'Segunda opinión', 'Plan a medida'],
  CONSTRUCTION: ['Obra gruesa', 'Remodelación', 'Proyecto a medida', 'Mantención'],
  PET: ['Peluquería canina', 'Baño y desparasitación', 'Corte de uñas', 'Paseo'],
  MECHANIC: ['Revisión general', 'Cambio de aceite', 'Alineación y balanceo', 'Diagnosis'],
  REAL_ESTATE: ['Asesoría de compra', 'Venta de propiedad', 'Arriendo mensual', 'Tasación'],
  PHOTO: ['Sesión retrato', 'Fotografía de producto', 'Cobertura de eventos', 'Sesión familiar'],
  PHONE: ['Reparación de pantalla', 'Cambio de batería', 'Actualización de software', 'Diagnóstico'],
  FITNESS: ['Evaluación inicial', 'Plan de entrenamiento', 'Clase grupal', 'Acompañamiento'],
};

const PRODUCT_NAMES: Record<string, string[]> = {
  default: ['Producto destacado', 'Selección del mes', 'Favorito de clientes', 'Edición limitada'],
  FOOD: ['Plato de la casa', 'Menú del día', 'Combo familiar', 'Postre de la casa'],
  CAFE: ['Café de origen', 'Blend de la casa', 'Torta del día', 'Pack de granos'],
  BAKERY: ['Pan de masa madre', 'Torta de celebración', 'Caja de medialunas', 'Galletas artesanales'],
  BOUTIQUE: ['Polo essential', 'Bolso de temporada', 'Zapatillas city', 'Set de regalo'],
  FLOWERS: ['Ramo de rosas', 'Arreglo gourmet', 'Gift box flores', 'Orquídea blanca'],
  FURNITURE: ['Mesa de comedor', 'Sillón lounge', 'Estantería', 'Cama king'],
  PHONE: ['Funda premium', 'Cargador rápido', 'Audífonos', 'Protector de pantalla'],
  PET: ['Baño spa', 'Alimento premium', 'Juguete interactivo', 'Cama para mascota'],
  FITNESS: ['Matriz de yoga', 'Banda elástica', 'Botella térmica', 'Plan mensual'],
  PRO: ['Diagnóstico inicial', 'Sesión estratégica', 'Informe mensual', 'Plan a medida'],
  CLEANING: ['Kit de limpieza', 'Servicio mensual', 'Desinfección', 'Lavado de alfombras'],
  REAL_ESTATE: ['Casa en venta', 'Depto en arriendo', 'Oficina centro', 'Terreno'],
};

/** Secciones que el renderer conoce, en el orden de la composición del rubro. */
function sectionsFor(category: string) {
  const composition = getCategoryComposition(category);
  const supported = composition.supportedCapabilities;
  const primary = supported.filter((id) => composition.defaultOrder.includes(id));
  const secondary = supported.filter((id) => !primary.includes(id));
  return [...primary, ...secondary].map((id, index) => ({
    id,
    order: (index + 1) * 10,
    enabled: composition.defaultEnabled.includes(id) || primary.includes(id),
  }));
}

export function buildPreviewFixture(categoryInput?: string | null, templateCode?: string | null, businessName?: string): PreviewFixture {
  const category = canonicalCategoryCode(categoryInput);
  const images = thematicAssets(category);
  const composition = getCategoryComposition(category);
  const name = businessName?.trim() || `${categoryLabel(category)} Aurora`;
  const preset = presetsForCategory(category)[0] || {};
  const business = {
    id: `preview-${category}`,
    name,
    slug: `preview-${category.toLowerCase()}`,
    category,
    status: 'PUBLISHED',
    description: 'Creamos experiencias con cuidado, cercanía y atención para cada cliente.',
    logo: images[1]?.src,
    cover: images[0]?.src,
    city: 'Santiago',
    region: 'Región Metropolitana',
    phone: '+56 9 5555 5555',
    whatsapp: '56955555555',
    email: 'hola@aurora.cl',
    address: 'Av. Providencia 123',
    mapsUrl: 'https://maps.google.com',
    hours: { Lunes: '09:00–18:00', Martes: '09:00–18:00', 'Miércoles': '09:00–18:00', Jueves: '09:00–18:00', Viernes: '09:00–17:00', 'Sábado': '10:00–14:00' },
    socials: { instagram: 'https://instagram.com', facebook: 'https://facebook.com' },
    template: { code: templateCode || `${category}_SIGNATURE_EDITORIAL`, name: categoryLabel(category), category, capabilities: composition.supportedCapabilities },
    visual: { ...preset, sections: sectionsFor(category) },
  };
  const serviceNames = SERVICE_NAMES[category] || SERVICE_NAMES.default;
  const productNames = PRODUCT_NAMES[category] || PRODUCT_NAMES.default;
  const services = serviceNames.map((item, index) => ({
    id: `service-${index}`, name: item, description: 'Una propuesta pensada para ti, con tiempo para cada detalle.',
    price: [25000, 35000, 45000, 55000][index % 4], image: images[index % images.length]?.src,
  }));
  const products = productNames.map((item, index) => ({
    id: `product-${index}`, name: item, description: 'Diseñado para mejorar tu experiencia.',
    price: [18900, 24900, 29900, 35900][index % 4], salePrice: [18900, 24900, 29900, 35900][index % 4], image: images[index % images.length]?.src,
  }));
  const gallery = Array.from({ length: 6 }, (_, index) => ({ id: `gallery-${index}`, url: images[index % images.length]?.src, alt: `Galería de ${business.name}` }));
  const properties = [{ id: 'property-1', title: 'Casa luminosa en Providencia', price: 189000000, operation: 'VENTA', type: 'Casa', city: 'Santiago', address: 'Av. Providencia 123', bedrooms: 3, bathrooms: 2, parking: 2, areaTotal: 180, featured: true, images: [{ url: images[0]?.src }] }];
  const team = [{ id: 'team-1', name: 'Camila Rojas', role: 'Especialista', bio: 'Acompaña cada proceso con atención y detalle.' }, { id: 'team-2', name: 'Tomás Silva', role: 'Asesor', bio: 'Acompañamiento claro y personalizado.' }];
  const testimonials = [{ id: 't1', name: 'María López', content: 'Una experiencia clara, cálida y profesional.' }, { id: 't2', name: 'Carlos Pérez', content: 'Todo fue muy fácil y el resultado superó lo esperado.' }];
  const faqs = [{ id: 'f1', question: '¿Cómo puedo agendar?', answer: 'Escríbenos por WhatsApp y te ayudaremos a encontrar el mejor horario.' }, { id: 'f2', question: '¿Atienden entregas?', answer: 'Sí, coordinamos entregas y retiro según disponibilidad.' }];
  const promotions = [{ id: 'pr1', title: 'Promoción de temporada', description: 'Consulta por esta selección para tu próxima visita.' }];
  const bookingSlots = [{ id: 'b1', weekday: 1, startTime: '10:00', endTime: '11:00' }, { id: 'b2', weekday: 3, startTime: '16:00', endTime: '17:00' }];
  return { business, services, products, properties, gallery, testimonials, faqs, promotions, team, bookingSlots };
}

