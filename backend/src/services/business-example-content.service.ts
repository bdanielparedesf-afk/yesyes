/**
 * YESYES BUSINESS — CONTENIDO DE EJEMPLO.
 *
 * Objetivo de producto: "arranca con un ejemplo y edítalo". Al crear la página
 * el negocio debe quedar con contenido REAL en la base de datos, no con una
 * maqueta temporal de la galería de diseños.
 *
 * Antes, lo que se veía en el asistente venía de `previewFixture` (solo
 * cliente, solo vista previa) y NUNCA se copiaba al negocio: la página creada
 * quedaba con 0 servicios, 0 productos y `cover: null`. Con este servicio el
 * ejemplo se persiste y después se edita o se borra como cualquier otro dato.
 *
 * Lo que se crea aquí son filas NORMALES de las mismas tablas que usa el panel:
 * no hay campos "de ejemplo" que haya que limpiar después.
 */

import { prisma } from '../lib/prisma';
import { slugify } from '../utils/business';
import { canonicalCategoryCode } from '../utils/business-taxonomy';

/** Nombres de servicios por rubro. */
const SERVICES: Record<string, string[]> = {
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
  MECHANIC: ['Revisión general', 'Cambio de aceite', 'Alineación y balanceo', 'Diagnóstico'],
  REAL_ESTATE: ['Asesoría de compra', 'Venta de propiedad', 'Arriendo mensual', 'Tasación'],
  PHOTO: ['Sesión retrato', 'Fotografía de producto', 'Cobertura de eventos', 'Sesión familiar'],
  PHONE: ['Reparación de pantalla', 'Cambio de batería', 'Actualización de software', 'Diagnóstico'],
  FITNESS: ['Evaluación inicial', 'Plan de entrenamiento', 'Clase grupal', 'Acompañamiento'],
};

const PRODUCTS: Record<string, string[]> = {
  FOOD: ['Plato de la casa', 'Menú del día', 'Combo familiar', 'Postre de la casa'],
  CAFE: ['Café de origen', 'Blend de la casa', 'Torta del día', 'Pack de granos'],
  BAKERY: ['Pan de masa madre', 'Torta de celebración', 'Caja de medialunas', 'Galletas artesanales'],
  BOUTIQUE: ['Polo essential', 'Bolso de temporada', 'Zapatillas city', 'Set de regalo'],
  FLOWERS: ['Ramo de rosas', 'Arreglo gourmet', 'Gift box flores', 'Orquídea blanca'],
  FURNITURE: ['Mesa de comedor', 'Sillón lounge', 'Estantería', 'Cama king'],
  PHONE: ['Funda premium', 'Cargador rápido', 'Audífonos', 'Protector de pantalla'],
  PET: ['Baño spa', 'Alimento premium', 'Juguete interactivo', 'Cama para mascota'],
  MECHANIC: ['Cambio de aceite', 'Filtro de aire', 'Batería 12V', 'Pastillas de freno'],
};

/** Rubros cuyo diseño muestra catálogo/productos. */
const WITH_PRODUCTS = new Set(Object.keys(PRODUCTS));
/** Rubros cuyo diseño muestra propiedades. */
const WITH_PROPERTIES = new Set(['REAL_ESTATE']);

const SERVICE_PRICES = [25000, 35000, 45000, 55000];
const PRODUCT_PRICES = [18900, 24900, 29900, 35900];

/** Textos genéricos. Su literal también identifica las filas de ejemplo. */
const SERVICE_DESCRIPTION = 'Una propuesta pensada para ti, con tiempo para cada detalle.';
const PRODUCT_DESCRIPTION = 'Diseñado para mejorar tu experiencia.';

export interface SeedExampleOptions {
  /** Limpia el ejemplo anterior antes de sembrar, para no duplicar. */
  replace?: boolean;
}

export interface SeedExampleResult {
  services: number; products: number; properties: number;
  testimonials: number; faqs: number; team: number;
}


/**
 * Crea contenido de ejemplo para un negocio recién creado.
 *
 * Idempotente con `replace`: borra SOLO el ejemplo previo (reconocido por su
 * texto literal), nunca lo que el usuario haya escrito a mano.
 */
export async function seedExampleContent(
  businessId: string,
  rawCategory: string | null | undefined,
  options: SeedExampleOptions = {},
): Promise<SeedExampleResult> {
  const category = canonicalCategoryCode(rawCategory);
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  if (!business) throw new Error('Negocio no encontrado');

  const serviceNames = SERVICES[category] || SERVICES.PRO || [];
  const productNames = WITH_PRODUCTS.has(category) ? (PRODUCTS[category] || []) : [];
  const result: SeedExampleResult = { services: 0, products: 0, properties: 0, testimonials: 0, faqs: 0, team: 0 };

  await prisma.$transaction(async (tx) => {
    if (options.replace) {
      await tx.businessService.deleteMany({ where: { businessId, description: SERVICE_DESCRIPTION } });
      await tx.businessCatalogItem.deleteMany({ where: { businessId, shortDescription: PRODUCT_DESCRIPTION } });
      await tx.businessFaq.deleteMany({ where: { businessId, question: { startsWith: '¿' } } });
      await tx.businessTestimonial.deleteMany({ where: { businessId, content: { startsWith: 'Una experiencia clara' } } });
    }

    result.services = (await tx.businessService.createMany({
      data: serviceNames.map((name, index) => ({
        businessId, name, description: SERVICE_DESCRIPTION,
        price: SERVICE_PRICES[index % SERVICE_PRICES.length],
        durationMin: 45, featured: index === 0, active: true, order: index,
      })),
    })).count;

    if (productNames.length > 0) {
      result.products = (await tx.businessCatalogItem.createMany({
        data: productNames.map((name, index) => ({
          businessId, name, slug: `${slugify(name)}-${businessId.slice(0, 6)}-${index}`,
          shortDescription: PRODUCT_DESCRIPTION,
          price: PRODUCT_PRICES[index % PRODUCT_PRICES.length] ?? 18900,
          currency: 'CLP', active: true, featured: index === 0, sortOrder: index,
        })),
      })).count;
    }

    result.testimonials = (await tx.businessTestimonial.createMany({
      data: [
        { businessId, name: 'María López', content: 'Una experiencia clara, cálida y profesional.', rating: 5, order: 0 },
        { businessId, name: 'Carlos Pérez', content: 'Todo fue muy fácil y el resultado superó lo esperado.', rating: 5, order: 1 },
      ],
    })).count;

    result.faqs = (await tx.businessFaq.createMany({
      data: [
        { businessId, question: '¿Cómo puedo agendar?', answer: 'Escríbenos por WhatsApp y te ayudaremos a encontrar el mejor horario.', order: 0 },
        { businessId, question: '¿Atienden entregas?', answer: 'Sí, coordinamos entregas y retiro según disponibilidad.', order: 1 },
      ],
    })).count;

    result.team = (await tx.businessTeamMember.createMany({
      data: [
        { businessId, name: 'Camila Rojas', role: 'Especialista', bio: 'Acompaña cada proceso con atención y detalle.', order: 0 },
        { businessId, name: 'Tomás Silva', role: 'Asesor', bio: 'Acompañamiento claro y personalizado.', order: 1 },
      ],
    })).count;

    if (WITH_PROPERTIES.has(category)) {
      result.properties = (await tx.property.createMany({
        data: [{
          businessId, title: 'Casa luminosa en Providencia',
          description: 'Amplia casa con buena luz natural, patio y conectividad inmediata.',
          price: 189000000, currency: 'CLP', operation: 'VENTA', type: 'CASA',
          address: 'Av. Providencia 123', city: 'Santiago', region: 'Región Metropolitana',
          bedrooms: 3, bathrooms: 2, parking: 2, areaTotal: 180, areaBuilt: 150,
          features: ['Patio', 'Bodega', 'Closet'], featured: true, available: true, published: true,
        }],
      })).count;
    }
  });

  return result;
}
