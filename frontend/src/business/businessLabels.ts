export const CATEGORY_LABELS: Record<string, string> = {
  FLOWERS: 'Floristería', BARBER: 'Barbería', HAIR: 'Peluquería', BEAUTY: 'Beauty y bienestar',
  CAFE: 'Cafetería', FOOD: 'Restaurante', BAKERY: 'Pastelería y panadería', NAILS: 'Uñas',
  PET: 'Mascotas', FITNESS: 'Gimnasio y fitness', MECHANIC: 'Automotriz', DETAILING: 'Automotriz',
  AUTO: 'Automotriz', REAL_ESTATE: 'Inmobiliaria', BOUTIQUE: 'Boutique', PHOTO: 'Fotografía',
  PRO: 'Servicios profesionales', CONSTRUCTION: 'Construcción', CLEANING: 'Limpieza',
  TUTORING: 'Clases y educación', FURNITURE: 'Muebles y espacios', PHONE: 'Tecnología y reparaciones',
};

export const SECTION_LABELS: Record<string, string> = {
  HERO: 'Presentación', ABOUT: 'Sobre el negocio', SERVICES: 'Servicios', PRICING: 'Precios',
  PRODUCTS: 'Productos', CATALOG: 'Catálogo', PROPERTIES: 'Propiedades', GALLERY: 'Galería', PORTFOLIO: 'Portafolio',
  BEFORE_AFTER: 'Antes y después', PROMOTIONS: 'Promociones', DELIVERY: 'Envío a domicilio', PICKUP: 'Retiro en tienda',
  OPENING_HOURS: 'Horarios', MAP: 'Ubicación', CONTACT: 'Contacto', CONTACT_FORM: 'Formulario de contacto',
  WHATSAPP: 'WhatsApp', SOCIALS: 'Redes sociales', CTA: 'Llamado a la acción', TESTIMONIALS: 'Opiniones',
  FAQ: 'Preguntas frecuentes', TEAM: 'Equipo', BOOKING: 'Reservas', BRANDS: 'Marcas', FEATURES: 'Características',
  REPAIR: 'Reparaciones', SUBJECTS: 'Materias y clases', FOOTER: 'Pie de página', SEO: 'Posicionamiento en buscadores',
  ANALYTICS: 'Analítica', LEADS: 'Contactos recibidos', LEGAL: 'Información legal',
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PREVIEW: 'En revisión', PAYMENT_PENDING: 'Pago pendiente', PUBLISHED: 'Publicado',
  PAUSED: 'Pausado', ARCHIVED: 'Archivado', ACTIVE: 'Activo', INACTIVE: 'Inactivo', NONE: 'Sin suscripción',
  PENDING: 'Pendiente', PAST_DUE: 'Pago atrasado', GRACE_PERIOD: 'Período de gracia', CANCELLED: 'Cancelada', EXPIRED: 'Vencida',
};

export const CTA_LABELS: Record<string, string> = {
  FLOWERS: 'Consultar por WhatsApp', BARBER: 'Reservar hora', HAIR: 'Agendar cita', BEAUTY: 'Agendar cita',
  CAFE: 'Ver menú', FOOD: 'Reservar mesa', BAKERY: 'Realizar pedido', NAILS: 'Reservar',
  PET: 'Agendar servicio', FITNESS: 'Comienza tu entrenamiento', MECHANIC: 'Solicitar cotización', AUTO: 'Solicitar cotización', DETAILING: 'Solicitar cotización',
  REAL_ESTATE: 'Ver propiedades', BOUTIQUE: 'Ver colección', PHOTO: 'Ver portafolio',
  PRO: 'Solicitar consulta', CONSTRUCTION: 'Solicitar cotización', CLEANING: 'Solicitar cotización', TUTORING: 'Agendar clase',
  FURNITURE: 'Solicitar cotización', PHONE: 'Solicitar reparación',
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  FLOWERS: 'Flores, regalos y arreglos para cada ocasión.', BARBER: 'Cortes, barbas y cuidado personal con estilo.',
  HAIR: 'Peluquería, color y belleza para realzar tu estilo.', BEAUTY: 'Tratamientos, bienestar y belleza en un lugar.',
  CAFE: 'Café de especialidad y algo rico para compartir.', FOOD: 'Cocina, ambiente y una experiencia para disfrutar.',
  BAKERY: 'Panadería y pastelería artesanal para cada momento.', NAILS: 'Manicure, pedicure y diseños que reflejan tu estilo.',
  PET: 'Cuidado, peluquería y bienestar para tu mascota.', FITNESS: 'Entrenamiento, planes y acompañamiento para moverte mejor.',
  MECHANIC: 'Mantenimiento y reparación confiable para tu vehículo.', DETAILING: 'Lavado y cuidado especializado para tu vehículo.',
  AUTO: 'Servicios y mantenimiento para tu vehículo.', REAL_ESTATE: 'Propiedades y oportunidades para encontrar tu lugar.',
  BOUTIQUE: 'Moda, colecciones y piezas para expresar tu estilo.', PHOTO: 'Historias, retratos y recuerdos que merecen ser vistos.',
  PRO: 'Experiencia, claridad y resultados para resolver lo importante.', CONSTRUCTION: 'Proyectos y soluciones con confianza.', CLEANING: 'Cuida y tranquilidad para tu hogar o empresa.', TUTORING: 'Aprende a tu ritmo con clases y acompañamiento personalizado.', PHONE: 'Tecnología y soporte.', FURNITURE: 'Muebles y espacios para tu proyecto.'
};

export const categoryLabel = (code?: string | null) => CATEGORY_LABELS[String(code || '').toUpperCase()] || 'Negocio';
export const categoryDescription = (code?: string | null) => CATEGORY_DESCRIPTIONS[String(code || '').toUpperCase()] || 'Una página hecha para presentar y crecer tu negocio.';
export const sectionLabel = (id: string) => SECTION_LABELS[id] || 'Sección';
export const statusLabel = (status: string) => STATUS_LABELS[status] || 'En revisión';
export const ctaLabel = (category?: string | null) => CTA_LABELS[String(category || '').toUpperCase()] || 'Contactar por WhatsApp';
export const templateLabel = (code?: string | null, fallback = 'Diseño personalizado') => {
  const value = String(code || '').toUpperCase();
  const names: Record<string, string> = { FLOWERS_01: 'Elegante floral', FLOWERS_02: 'Floral romántico', FLOWERS_03: 'Boutique floral', FLOWERS_04: 'Jardín natural', BARBER_01: 'Barbería premium', HAIR_01: 'Peluquería luminosa', HAIR_02: 'Salón editorial', HAIR_03: 'Belleza natural', CAFE_01: 'Café artesanal', FOOD_01: 'Restaurante editorial', BAKERY_01: 'Mesa dulce', NAILS_01: 'Uñas y cuidado', PETS_01: 'Mascotas felices', FITNESS_01: 'Entrenamiento con energía', AUTO_01: 'Automotriz técnico', REAL_ESTATE_01: 'Arquitectura inmobiliaria', BOUTIQUE_01: 'Moda editorial', PHOTO_01: 'Portafolio visual', PRO_01: 'Profesional de confianza' };
  return names[value] || fallback;
};
