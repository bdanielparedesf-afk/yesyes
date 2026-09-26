/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 â€” VariantRegistry (Fase 4.1).
 *
 * QUÃ‰ ES UNA VARIANTE
 * -------------------
 * Una variante cambia CÃ“MO se muestra un bloque, NUNCA QUÃ‰ contiene.
 *
 *   Servicios â€” Tarjetas   -> grilla de tarjetas
 *   Servicios â€” Editorial  -> lista con tipografía protagonista
 *   Servicios â€” Bento      -> tamaños distintos
 *
 * Reglas duras:
 *  - Una variante es un CONJUNTO DE OVERRIDES DE CONFIG. Nunca guarda datos.
 *    Por eso cambiar de variante preserva el contenido por construcción: los
 *    servicios, productos o testimonios viven en la base, no en el manifest.
 *  - Toda variante declara `renderInV2`. Una variante sin implementación real
 *    NO se ofrece: sería funcionalidad falsa (mismo criterio que los bloques).
 *  - Las variantes son TRANSVERSALES al rubro: las puede usar cualquier
 *    negocio que tenga el bloque. El rubro decide QUÃ‰ bloques existen, no
 *    cómo se ven.
 */

import { getBlock } from './block-registry';

export interface BlockVariant {
  id: string;
  /** Nombre humano. Nunca se muestra el id. */
  label: string;
  description: string;
  /** Overrides que se aplican sobre la config del bloque. */
  config: Record<string, unknown>;
  /** true si el renderer único ya compone esta variante de verdad. */
  renderInV2: boolean;
}

export interface BlockVariants {
  block: string;
  defaultVariant: string;
  variants: BlockVariant[];
}

const v = (id: string, label: string, description: string, config: Record<string, unknown>): BlockVariant => ({
  id, label, description, config, renderInV2: true,
});

/** CATÁLOGO DE VARIANTES. Solo se declara lo que el renderer compone. */
export const VARIANT_DEFINITIONS: BlockVariants[] = [
  {
    block: 'Hero',
    defaultVariant: 'split',
    variants: [
      v('split', 'Dividido', 'Texto a un lado, imagen grande al otro.', { presentation: 'split' }),
      v('fullscreen', 'Pantalla completa', 'La imagen ocupa toda la primera pantalla.', { presentation: 'fullscreen' }),
      v('centered', 'Centrado', 'Todo centrado, sin imagen lateral.', { presentation: 'centered' }),
      v('editorial', 'Editorial', 'Titular enorme y bajada amplia.', { presentation: 'editorial' }),
      v('cinematic', 'Cinemático', 'Superposición oscura sobre la imagen.', { presentation: 'cinematic' }),
    ],
  },
  {
    block: 'HeroVideo',
    defaultVariant: 'cinematic',
    variants: [
      v('cinematic', 'Cinemático', 'Video de fondo a pantalla completa con velo oscuro.', { presentation: 'cinematic' }),
      v('fullscreen', 'Pantalla completa', 'Video de fondo y texto sobreimpreso.', { presentation: 'fullscreen' }),
      v('split', 'Dividido', 'Video a un lado y el texto al otro.', { presentation: 'split' }),
    ],
  },
  {
    block: 'Services',
    defaultVariant: 'cards',
    variants: [
      v('cards', 'Tarjetas', 'Grilla de tarjetas con imagen, nombre y precio.', { presentation: 'cards' }),
      v('editorial', 'Editorial', 'Lista con tipografía protagonista, una línea por servicio.', { presentation: 'editorial' }),
      v('split', 'Imagen y servicios', 'Imagen grande al lado y la lista al frente.', { presentation: 'split' }),
      v('bento', 'Bento', 'Tarjetas de tamaños distintos con jerarquía.', { presentation: 'bento' }),
      v('featured', 'Servicio destacado', 'El primero destacado y el resto en lista.', { presentation: 'featured' }),
      v('minimal', 'Minimal', 'Solo nombre y precio, sin imágenes.', { presentation: 'minimal' }),
    ],
  },
  {
    block: 'Products',
    defaultVariant: 'grid',
    variants: [
      v('grid', 'Grilla', 'Catalogo uniforme de tarjetas.', { presentation: 'grid' }),
      v('editorial', 'Editorial', 'El primero abre la seccion y el resto son filas.', { presentation: 'editorial' }),
      v('magazine', 'Revista', 'Mosaico asimetrico con imagenes a sangre.', { presentation: 'magazine' }),
      v('commerce', 'Tienda', 'Tarjetas con precio y disponibilidad.', { presentation: 'commerce' }),
      v('featured', 'Destacado', 'Un producto protagonista y el resto en tira.', { presentation: 'featured' }),
    ],
  },
  {
    block: 'ImageGallery',
    defaultVariant: 'grid',
    variants: [
      v('grid', 'Grilla', 'Grilla pareja de imagenes.', { presentation: 'grid' }),
      v('masonry', 'Mosaico', 'Columnas de altura variable, sin recortes.', { presentation: 'masonry' }),
      v('editorial', 'Editorial', 'Una imagen grande y el resto en tira.', { presentation: 'editorial' }),
      v('fullscreen', 'Pantalla completa', 'Una imagen por pantalla.', { presentation: 'fullscreen' }),
      v('carousel', 'Deslizador', 'Tira horizontal desplazable.', { presentation: 'carousel' }),
    ],
  },
  {
    block: 'Testimonials',
    defaultVariant: 'cards',
    variants: [
      v('cards', 'Tarjetas', 'Opiniones en tarjetas.', { presentation: 'cards' }),
      v('quote', 'Cita grande', 'Una opinion protagonista y el resto en columna.', { presentation: 'quote' }),
      v('editorial', 'Editorial', 'Texto corrido con autor pequeno.', { presentation: 'editorial' }),
      v('slider', 'Deslizador', 'Opiniones en fila desplazable.', { presentation: 'slider' }),
      v('minimal', 'Minimal', 'Corta y la inicial del autor, sin cajas.', { presentation: 'minimal' }),
      v('featured', 'Destacado', 'Una opinion a sangre y el resto en grilla.', { presentation: 'featured' }),
    ],
  },
  {
    block: 'Team',
    defaultVariant: 'grid',
    variants: [
      v('grid', 'Grilla', 'Retratos en grilla pareja.', { presentation: 'grid' }),
      v('portrait', 'Retrato', 'Fichas verticales con imagen alta.', { presentation: 'portrait' }),
      v('cards', 'Tarjetas', 'Tarjetas con foto, nombre y rol.', { presentation: 'cards' }),
      v('editorial', 'Editorial', 'Una fila por persona, con relato.', { presentation: 'editorial' }),
      v('minimal', 'Minimal', 'Solo nombre y rol, sin imagenes.', { presentation: 'minimal' }),
    ],
  },
  {
    block: 'FAQ',
    defaultVariant: 'accordion',
    variants: [
      v('accordion', 'Preguntas', 'Lista desplegable, una respuesta a la vez.', { presentation: 'accordion' }),
      v('editorial', 'Editorial', 'Respuestas siempre visibles en columna.', { presentation: 'editorial' }),
      v('minimal', 'Minimal', 'Solo la pregunta, se despliega al hacer clic.', { presentation: 'minimal' }),
    ],
  },
  {
    block: 'CTA',
    defaultVariant: 'fullscreen',
    variants: [
      v('fullscreen', 'Cierre potente', 'Banda oscura con titular grande.', { presentation: 'fullscreen' }),
      v('split', 'Dividido', 'Texto a un lado y boton grande al otro.', { presentation: 'split' }),
      v('banner', 'Banner', 'Franja centrada sobre fondo claro.', { presentation: 'banner' }),
      v('minimal', 'Minimal', 'Una linea y un boton al costado.', { presentation: 'minimal' }),
      v('editorial', 'Editorial', 'Titular protagonista y cuerpo a la derecha.', { presentation: 'editorial' }),
    ],
  },
  {
    block: 'Promotions',
    defaultVariant: 'cards',
    variants: [
      v('cards', 'Tarjetas', 'Ofertas en tarjetas.', { presentation: 'cards' }),
      v('banner', 'Franja', 'Ofertas como lista continua sin cajas.', { presentation: 'banner' }),
      v('featured', 'Destacada', 'La primera oferta a doble ancho.', { presentation: 'featured' }),
    ],
  },
  {
    block: 'Properties',
    defaultVariant: 'grid',
    variants: [
      v('grid', 'Grilla', 'Propiedades en grilla.', { presentation: 'grid' }),
      v('featured', 'Destacada', 'La primera propiedad grande y el resto en lista.', { presentation: 'featured' }),
      v('editorial', 'Editorial', 'Fila con imagen y ficha.', { presentation: 'editorial' }),
    ],
  },
  {
    block: 'Video',
    defaultVariant: 'fullscreen',
    variants: [
      v('fullscreen', 'Pantalla completa', 'Video a todo el ancho con poster.', { presentation: 'fullscreen' }),
      v('split', 'Dividido', 'Video a un lado y texto al otro.', { presentation: 'split' }),
      v('gallery', 'Galeria', 'Video principal y el resto en tira.', { presentation: 'gallery' }),
    ],
  },
  {
    block: 'Booking',
    defaultVariant: 'cards',
    variants: [
      v('cards', 'Tarjetas', 'Horarios disponibles en tarjetas.', { presentation: 'cards' }),
      v('calendar', 'Calendario', 'Horarios agrupados por dia.', { presentation: 'calendar' }),
      v('cta', 'Solo accion', 'Sin listado: solo la llamada a reservar.', { presentation: 'cta' }),
    ],
  },
  {
    block: 'Contact',
    defaultVariant: 'split',
    variants: [
      v('split', 'Dividido', 'Datos a un lado y formulario al otro.', { presentation: 'split' }),
      v('cards', 'Tarjetas', 'Cada canal de contacto en su propia tarjeta.', { presentation: 'cards' }),
      v('minimal', 'Minimal', 'Linea de contacto sin formulario.', { presentation: 'minimal' }),
    ],
  },
  {
    block: 'Map',
    defaultVariant: 'split',
    variants: [
      v('split', 'Dividido', 'Mapa a un lado y direccion al otro.', { presentation: 'split' }),
      v('inline', 'Compacto', 'Direccion con enlace al mapa.', { presentation: 'inline' }),
      v('fullscreen', 'Pantalla completa', 'Mapa a todo el ancho.', { presentation: 'fullscreen' }),
    ],
  },
];

const BY_BLOCK = new Map(VARIANT_DEFINITIONS.map((entry) => [entry.block, entry]));

/** Variantes declaradas para un bloque. `[]` si el bloque no tiene variantes. */
export function variantsForBlock(blockId: string | null | undefined): BlockVariant[] {
  if (!blockId) return [];
  return BY_BLOCK.get(String(blockId))?.variants || [];
}

/** Variante por id dentro de un bloque. `undefined` si no existe. */
export function getVariant(blockId: string | null | undefined, variantId: string | null | undefined): BlockVariant | undefined {
  if (!blockId || !variantId) return undefined;
  return variantsForBlock(blockId).find((variant) => variant.id === variantId);
}

/**
 * Variante efectiva: la pedida, o la del bloque si no existe o no se pide.
 * `null` si el bloque no declara variantes (Text, Image, Button, WhatsApp,
 * SocialLinks, LeadForm, Footer): ahi el contenido ES la composicion.
 */
export function resolveVariant(blockId: string | null | undefined, variantId: unknown): BlockVariant | null {
  const entry = blockId ? BY_BLOCK.get(String(blockId)) : undefined;
  if (!entry) return null;
  if (typeof variantId === 'string') {
    const found = entry.variants.find((variant) => variant.id === variantId);
    if (found) return found;
  }
  return entry.variants.find((variant) => variant.id === entry.defaultVariant) || entry.variants[0] || null;
}

/** Variante por defecto de un bloque, o `null` si no tiene variantes. */
export function defaultVariantOf(blockId: string | null | undefined): BlockVariant | null {
  return resolveVariant(blockId, undefined);
}

/**
 * Variantes que el renderer unico NO compone. Un catalogo sano devuelve
 * SIEMPRE `[]` (lo exige un test): es la guarda contra ofrecer al usuario un
 * diseño que despues se veria como el mismo.
 */
export function findVariantsWithoutImplementation(): Array<{ block: string; variant: string }> {
  const out: Array<{ block: string; variant: string }> = [];
  for (const entry of VARIANT_DEFINITIONS) {
    if (!getBlock(entry.block)) {
      out.push({ block: entry.block, variant: '*' });
      continue;
    }
    for (const variant of entry.variants) {
      if (!variant.renderInV2) out.push({ block: entry.block, variant: variant.id });
    }
  }
  return out;
}

/**
 * Ids de variante implementados por bloque. Lo consume el frontend para pintar
 * la galeria de variantes sin inventar ninguna: la equivalencia
 * EDITOR_OFRECE === RENDERER_COMPONE sale de este mismo catalogo.
 */
export function implementedVariantIds(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of VARIANT_DEFINITIONS) {
    out[entry.block] = entry.variants.filter((variant) => variant.renderInV2).map((variant) => variant.id);
  }
  return out;
}

/** Variantes soportadas de un bloque. Lista vacia si no tiene variantes. */
export function variantsSupported(blockId: string | null | undefined): string[] {
  return implementedVariantIds()[String(blockId || '')] || [];
}
