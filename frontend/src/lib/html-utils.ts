/**
 * Limpia HTML de proveedor: elimina <img>, <style>, <script>, atributos
 * style="...", convierte <br> y </p> en saltos de línea, quita todas las
 * etiquetas HTML y deja solo texto plano limpio.
 */
export function cleanDescription(html: string): string {
  if (!html) return '';
  let text = html;

  // Elimina <script>...</script>
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Elimina <style>...</style>
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Elimina <img ...>
  text = text.replace(/<img[^>]*>/gi, '');

  // Elimina todos los atributos style="..." o style='...'
  text = text.replace(/\s+style="[^"]*"/gi, '');
  text = text.replace(/\s+style='[^']*'/gi, '');

  // Convierte <br>, <br/>, <br /> en saltos de línea
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Convierte </p> en saltos de línea
  text = text.replace(/<\/p>/gi, '\n');

  // Elimina todas las etiquetas HTML restantes
  text = text.replace(/<[^>]+>/g, '');

  // Decodifica entidades HTML comunes
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&nbsp;/g, ' ');

  // Última garantía: eliminar cualquier < > o style= remanente (defensa contra HTML en DB)
  text = text.replace(/</g, ' ').replace(/>/g, ' ').replace(/style\s*=/gi, '');

  // Limpia espacios en exceso por línea y elimina líneas vacías
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return text.trim();
}

// Diccionario básico de términos comunes en descripciones de productos
// (usado como fallback si la API de MyMemory falla)
const ES_DESCRIPTION_DICTIONARY: Record<string, string> = {
  specification: 'Especificaciones',
  specifications: 'Especificaciones',
  material: 'Material',
  color: 'Color',
  size: 'Tamaño',
  weight: 'Peso',
  dimension: 'Dimensión',
  dimensions: 'Dimensiones',
  length: 'Largo',
  width: 'Ancho',
  height: 'Alto',
      package: 'Paquete',
  included: 'Incluido',
  'pu leather': 'Cuero PU',
  leather: 'Cuero',
  gradient: 'Degradado',
  unique: 'Único',
  premium: 'Premium',
  waterproof: 'Impermeable',
  portable: 'Portátil',
  rechargeable: 'Recargable',
  wireless: 'Inalámbrico',
  bluetooth: 'Bluetooth',
  usb: 'USB',
  charging: 'Carga',
  'power bank': 'Power Bank',
  lamp: 'Lámpara',
  light: 'Luz',
  desk: 'Escritorio',
  monitor: 'Monitor',
  headset: 'Auriculares',
  headphone: 'Audífonos',
  speaker: 'Parlante',
  camera: 'Cámara',
  watch: 'Reloj',
  toy: 'Juguete',
  kids: 'Niños',
  men: 'Hombres',
  women: 'Mujeres',
  unisex: 'Unisex',
  summer: 'Verano',
  winter: 'Invierno',
  hot: 'Popular',
  'best seller': 'Más Vendido',
  new: 'Nuevo',
};

/**
 * Aplica el diccionario básico al texto (fallback cuando MyMemory falla).
 * Reemplaza palabras conocidas del inglés al español.
 */
function dictionaryTranslate(text: string): string {
  let result = text;
  for (const [en, es] of Object.entries(ES_DESCRIPTION_DICTIONARY)) {
    const regex = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, es);
  }
  return result;
}

/**
 * Traduce texto al español usando la API gratuita de MyMemory.
 * Si la API falla, usa el diccionario básico como fallback.
 * Siempre devuelve un string (nunca lanza).
 */
export async function translateToSpanish(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';

  const trimmed = text.trim();

  // Textos muy cortos o ya traducidos: intentar igual
  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|es`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText || '';
      if (translated && translated.trim().length > 0) {
        // Aseguramos que la traducción no contenga HTML (por si MyMemory lo devuelve)
        return cleanDescription(translated);
      }
    }
  } catch (e) {
    console.warn('[translate] MyMemory falló, usando diccionario básico:', String(e).slice(0, 200));
  }

  // Fallback: diccionario básico
  return dictionaryTranslate(trimmed);
}