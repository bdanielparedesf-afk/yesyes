/**
 * CATÁLOGO LEGACY DE SECCIONES DEL EDITOR (V3).
 *
 * AUDITADO EN FASE 4.2 · C (§9): este archivo ya NO es una fuente de verdad.
 * El editor V2 determina qué existe en el sitio a partir de
 *
 *     manifest.sections        (lo que hay en la página)
 *     GET /business/:id/addable-sections   (lo que se puede agregar)
 *
 * Se conserva únicamente porque la UI legacy del inspector y algunos tests lo
 * usan para poner ETIQUETAS legibles. Si se agrega una sección aquí, el sitio no
 * cambia: hay que cambiar el manifest (o el registro del backend).
 */
import type { ComponentType, SVGProps } from 'react';
import { HelpCircle, Image, LayoutGrid, MapPin, MessageCircle, Star, Users, type LucideProps } from 'lucide-react';

export type SectionCategory = 'PRINCIPAL' | 'NEGOCIO' | 'VISUAL' | 'CONVERSIÓN' | 'CONFIANZA' | 'UBICACIÓN' | 'INFORMACIÓN' | 'FINAL';
export type SectionDefinition = {
  id: string; label: string; description: string; category: SectionCategory; icon: ComponentType<LucideProps & SVGProps<SVGSVGElement>>;
  defaultConfiguration?: Record<string, unknown>; rendererCapability?: string;
};
const item = (id: string, label: string, description: string, category: SectionCategory, icon: SectionDefinition['icon'], rendererCapability = id): SectionDefinition => ({ id, label, description, category, icon, defaultConfiguration: {}, rendererCapability });
export const SECTION_REGISTRY: SectionDefinition[] = [
  item('HERO', 'Portada', 'Tu primera impresión.', 'PRINCIPAL', LayoutGrid),
  item('ABOUT', 'Nosotros', 'Cuenta la historia de tu negocio.', 'NEGOCIO', Users),
  item('SERVICES', 'Servicios', 'Presenta lo que ofreces.', 'NEGOCIO', LayoutGrid),
  item('PRODUCTS', 'Productos', 'Tu catálogo propio del negocio.', 'NEGOCIO', LayoutGrid, 'CATALOG'),
  item('GALLERY', 'Galería', 'Muestra imágenes de tu trabajo.', 'VISUAL', Image),
  item('PORTFOLIO', 'Portafolio', 'Destaca tus proyectos.', 'VISUAL', Image),
  item('TEAM', 'Equipo', 'Conoce a las personas detrás.', 'CONFIANZA', Users),
  item('TESTIMONIALS', 'Testimonios', 'Comparte opiniones reales.', 'CONFIANZA', Star),
  item('FAQ', 'Preguntas frecuentes', 'Resuelve las dudas de tus clientes.', 'INFORMACIÓN', HelpCircle),
  item('MAP', 'Ubicación', 'Ayuda a tus clientes a llegar.', 'UBICACIÓN', MapPin),
  item('OPENING_HOURS', 'Horarios', 'Informa cuándo puedes atender.', 'INFORMACIÓN', HelpCircle),
  item('CONTACT', 'Contacto', 'Muestra cómo contactarte.', 'CONVERSIÓN', MessageCircle),
  item('WHATSAPP', 'WhatsApp', 'Invita a conversar directamente.', 'CONVERSIÓN', MessageCircle),
  item('CTA', 'Llamado a la acción', 'Lleva a tus clientes al siguiente paso.', 'CONVERSIÓN', MessageCircle),
  item('FOOTER', 'Pie de página', 'Cierra tu página con tu información.', 'FINAL', LayoutGrid),
];
export const sectionDefinition = (id: string) => SECTION_REGISTRY.find((entry) => entry.id === id);
