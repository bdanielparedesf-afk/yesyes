/**
 * Presentacion (solo UI) de la ficha de producto.
 * Limpia titulos de proveedor, oculta datos tecnicos y centraliza formatos.
 * No toca precios de negocio, margenes, envios ni proveedores.
 */
import { isTechnicalCode } from './aliexpressVariants';

const TITLE_NOISE: RegExp[] = [
  /\b(free\s*shipping|dropshipping|drop\s*shipping|wholesale|hot\s*sale|new\s*arrival|high\s*quality|factory\s*(price|direct)|best\s*selling|fast\s*delivery)\b/gi,
  /\b(aliexpress|cjdropshipping|cj\s*dropshipping|temu|amazon)\b/gi,
  /#[A-Za-z0-9]{3,}/g,
  /\b[A-Za-z0-9]{12,}\b/g,
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Normaliza el titulo que llega del proveedor: saca ruido comercial, codigos,
 * separadores repetidos y duplicados. Mantiene la informacion util del producto.
 */
export function normalizeProductTitle(raw: unknown, maxLength = 95): string {
  let title = decodeEntities(String(raw ?? ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]|【[^】]*】/g, (block) =>
      /\d{4}|new|free|hot|sale|shipping|wholesale|quality/i.test(block) ? ' ' : block)
    .replace(/\(([^)]*)\)/g, (block) =>
      /\d{4}|new|free|hot|sale|shipping|wholesale|quality/i.test(block) ? ' ' : block);

  TITLE_NOISE.forEach((pattern) => { title = title.replace(pattern, ' '); });

  title = title
    .replace(/[_]+/g, ' ')
    .replace(/\s*[|•·]+\s*/g, ' | ')
    .replace(/\s*[-–—]+\s*$/g, '')
    .replace(/^\s*[-–—|,;:.\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Elimina repeticiones consecutivas de palabras/frases ("Funda iPad Funda iPad").
  const words = title.split(' ');
  const deduped: string[] = [];
  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const previous = deduped[deduped.length - 1];
    const prevPrev = deduped[deduped.length - 2];
    if (normalized && previous && prevPrev
      && normalized === prevPrev.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) {
      deduped.pop();
      continue;
    }
    if (normalized && previous
      && normalized === previous.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) {
      continue;
    }
    deduped.push(word);
  }
  title = deduped.join(' ').replace(/\s+/g, ' ').trim();

  if (title.length > maxLength) {
    const cut = title.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    title = `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
  }
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
}

/** SKU/nombre de variante que se puede mostrar al cliente (nunca IDs de proveedor). */
export function sanitizeSkuForDisplay(sku: unknown): string | null {
  const value = String(sku ?? '').trim();
  if (!value || value.length > 32) return null;
  // Marcadores de SKU tecnico AliExpress ("5:1394;14:193") nunca se muestran.
  if (/[;#|]/.test(value) || /\d\s*:\s*\d/.test(value)) return null;
  if (isTechnicalCode(value)) return null;
  return value.toUpperCase();
}

export type StockKind = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface StockStatus {
  kind: StockKind;
  label: string;
  detail: string | null;
}

/** Estado de stock en lenguaje de cliente (sin unidades tecnicas ni IDs). */
export function stockStatus(stock: unknown, lowStockThreshold = 5): StockStatus {
  const value = Math.max(0, Math.floor(Number(stock) || 0));
  if (value <= 0) return { kind: 'out_of_stock', label: 'Agotado', detail: null };
  if (value <= lowStockThreshold) {
    return {
      kind: 'low_stock',
      label: 'Últimas unidades',
      detail: `Quedan ${value} disponibles`,
    };
  }
  return { kind: 'in_stock', label: 'Disponible', detail: null };
}

export function formatCLP(value: unknown): string {
  const amount = Number(value) || 0;
  return `$${Math.round(amount).toLocaleString('es-CL')}`;
}

export function formatPercent(value: unknown): number {
  const percent = Math.round(Number(value) || 0);
  return Math.min(99, Math.max(0, percent));
}

export interface VideoSource {
  kind: 'file' | 'embed';
  src: string;
}

/** Detecta video de proveedor (archivo o embed) y descarta valores invalidos. */
export function parseVideoSource(video: unknown): VideoSource | null {
  const value = String(video ?? '').trim();
  if (!/^https?:\/\//i.test(value)) return null;
  const youtube = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (youtube?.[1]) return { kind: 'embed', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo?.[1]) return { kind: 'embed', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(value)) return { kind: 'file', src: value };
  return null;
}

/** Primera oracion util, para resúmenes cortos. */
export function firstSentences(text: unknown, maxChars = 220): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  if (lastStop > maxChars * 0.5) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars).trim()}…`;
}

/** Dimensiones legibles desde el JSON de la API (o texto ya listo). */
export function formatDimensions(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  const source = value as Record<string, unknown>;
  const parts = ['length', 'width', 'height']
    .map((key) => Number(source?.[key]))
    .filter((num) => Number.isFinite(num) && num > 0);
  if (!parts.length) return null;
  return parts.map((num) => `${num} cm`).join(' × ');
}

/** Etiquetas internas de proveedor que no deben mostrarse como caracteristica. */
const PROVIDER_TAGS = /^(aliexpress|ali\s*express|cj|cjdropshipping|cj\s*dropshipping|temu|amazon|dropship|dropshipping)$/i;

export function publicTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 1 && tag.length <= 32 && !PROVIDER_TAGS.test(tag));
}
