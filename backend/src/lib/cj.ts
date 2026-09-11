import axios from 'axios';
import * as cheerio from 'cheerio';
import { translateWithAI, translateWithMyMemory } from './translator';

const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const CJ_EMAIL = process.env.CJ_EMAIL;
const CJ_API_KEY = process.env.CJ_API_KEY;

let cachedToken: string | null = null;
let tokenExpiry = 0;

const RE_PROD = /\/product\/([A-Za-z0-9-]+)/;
const RE_DETAIL = /\/product-detail\/([A-Za-z0-9-]+)/;
const RE_NUM6 = /(\d{6,})/;

/**
 * Obtiene el costo de envío (freight) desde la API de CJ.
 *
 * Endpoint: POST /api2.0/v1/logistic/freightCalculate
 * Body: { startCountryCode: 'CN', endCountryCode: 'CL', products: [{ quantity, vid }] }
 *   - Requiere vid obligatoriamente (CJ no permite freight sin variante).
 *   - Devuelve un array de opciones de logística; tomamos la más barata (logisticPrice mínimo).
 *
 * Usa cjThrottle + retry para respetar el límite de QPS de CJ (1 request/1s).
 * Lanza error si la API falla (para que el caller lo maneje con fallback).
 */
export async function getCJFreight(
  pid: string,
  options: { vid?: string; sku?: string; country?: string } = {}
): Promise<number> {
  const token = await getCJToken();
  const vid = String(options.vid || '').trim();
  if (!vid) throw new Error('vid requerido para freightCalculate');

  for (let attempt = 0; attempt < 3; attempt++) {
    await cjThrottle();
    try {
      const response = await axios.post(`${CJ_API_BASE}/logistic/freightCalculate`, {
        startCountryCode: 'CN',
        endCountryCode: options.country || 'CL',
        products: [{ quantity: 1, vid }],
      }, {
        headers: {
          'CJ-Access-Token': token,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const data = response.data?.data;
      if (!Array.isArray(data) || data.length === 0) return 0;

      // Tomar el logisticPrice mínimo (la opción más barata)
      let minPrice = Infinity;
      for (const item of data) {
        const price = parseFloat(String(item?.logisticPrice ?? item?.totalPostageFee ?? '0'));
        if (Number.isFinite(price) && price >= 0 && price < minPrice) minPrice = price;
      }
      return Number.isFinite(minPrice) && minPrice !== Infinity ? minPrice : 0;
    } catch (err: any) {
      if (isCjRateLimit(err) && attempt < 2) {
        console.warn('[CJ] 429 rate limit freight, reintentando en 1.2s (intento ' + (attempt + 1) + '/3)...');
        await sleep(1200);
        continue;
      }
      throw err;
    }
  }
  throw new Error('CJ freight request failed after retries');
}

export async function getCJToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await axios.post(`${CJ_API_BASE}/authentication/getAccessToken`, {
    email: CJ_EMAIL,
    apiKey: CJ_API_KEY,
  });

  const token = response.data?.data?.accessToken;
  if (!token) {
    throw new Error('No access token returned from CJ API');
  }

  cachedToken = token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return token;
}

/**
 * CJ limita la API a 1 request por segundo (QPS). Si encadenamos intentos
 * (query, list, candidatos, keyword) el 2do en adelante devuelve 429
 * "Too Many Requests, QPS limit is 1 time/1second" y el preview muere.
 * Estas helpers espacian las llamadas y reintentan cuando llega un 429.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CJ_PAGE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

function cleanHtmlText(value?: string | null): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseHtmlPrice(value?: string | null): number | undefined {
  const text = cleanHtmlText(value);
  if (!text) return undefined;
  const match = text.match(/(?:\$|USD|US\$)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i)
    || text.match(/([0-9]+(?:[.,][0-9]{1,2})?)/);
  const raw = match?.[1];
  if (!raw) return undefined;
  const price = Number(raw.replace(',', '.'));
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

export interface CJPageProduct {
  title?: string;
  price?: number;
  category?: string;
  images: string[];
  description?: string;
}

export async function scrapeCJProductPage(url: string): Promise<CJPageProduct | null> {
  let html: string;
  try {
    const response = await axios.get(url, {
      headers: CJ_PAGE_HEADERS,
      timeout: 12000,
      maxRedirects: 2,
    });
    html = typeof response.data === 'string' ? response.data : String(response.data || '');
  } catch (error: any) {
    console.warn('[CJ html fallback] request failed:', error?.response?.status ?? error?.message ?? error);
    return null;
  }

  console.log('CJ raw data:', html.slice(0, 500));
  if (!html || html.includes('Human verification') || html.includes('Just a moment')) {
    return null;
  }

  const $ = cheerio.load(html);
  const title = cleanHtmlText($('.product-title').first().text() || $('h1').first().text());
  const priceRaw = ['.product-price', '.price', '.sale-price', '.product-price-value', '[data-price]']
    .map((selector) => $(selector).first().text())
    .find((value) => parseHtmlPrice(value) !== undefined);
  const category = cleanHtmlText($('.product-category').first().text() || $('.category').first().text());
  const description = cleanHtmlText(
    $('.product-description').first().text()
    || $('.description').first().text()
    || $('#description').first().text(),
  );
  const images = Array.from(
    new Set(
      $('img')
        .map((_, element) => $(element).attr('src') || $(element).attr('data-src'))
        .get()
        .map((src) => cleanHtmlText(src).replace(/^\/\//, 'https://'))
        .filter((src) => /^https?:\/\//i.test(src)),
    ),
  ).slice(0, 5);

  return {
    title: title || undefined,
    price: parseHtmlPrice(priceRaw),
    category: category || undefined,
    images,
    description: description || undefined,
  };
}

let lastCjCallAt = 0;

async function cjThrottle(): Promise<void> {
  const MIN_GAP_MS = 1100;
  const waitMs = lastCjCallAt + MIN_GAP_MS - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  lastCjCallAt = Date.now();
}

function isCjRateLimit(err: any): boolean {
  const msg = String(err?.response?.data?.message ?? '');
  return err?.response?.status === 429 || msg.includes('QPS') || msg.includes('Too Many Requests');
}

async function cjGet(url: string, params: Record<string, any>, token: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await cjThrottle();
    try {
      return await axios.get(url, {
        headers: { 'CJ-Access-Token': token },
        params,
        timeout: 15000,
      });
    } catch (err: any) {
      if (isCjRateLimit(err) && attempt < 2) {
        console.warn('[CJ] 429 rate limit, reintentando en 1.2s (intento ' + (attempt + 1) + '/3)...');
        await sleep(1200);
        continue;
      }
      throw err;
    }
  }
  throw new Error('CJ request failed after retries');
}

/**
 * Extrae TODOS los posibles IDs de producto CJ desde un link.
 * Formatos soportados:
 *  - ?pid=2609080924111626000 / ?productId= / ?goodsId=
 *  - /product/<slug>,p-2609080924111626000.html  (formato web clásico)
 *  - /product/<slug>-2609080924111626000.html
 *  - /product/2609080924111626000.html
 *  - token clásico CJ1910162202 embebido en el slug
 *  - UUID: /product/e8b41a1c-4a11-4a97-a3f8-5f0b091bb387.html
 */
export function extractPidCandidates(url: string): string[] {
  const raw = (url || '').trim();
  if (!raw) return [];
  const out: string[] = [];
  const push = (v?: string | null) => {
    if (!v) return;
    const t = String(v).trim();
    if (t && !out.includes(t)) out.push(t);
  };
  try {
    const full = raw.startsWith('http') ? raw : 'https://' + raw;
    const u = new URL(full);
    push(u.searchParams.get('pid'));
    push(u.searchParams.get('productId'));
    push(u.searchParams.get('goodsId'));
    push(u.searchParams.get('id'));
    const pathAndQuery = u.pathname + '?' + u.search;
    // token clásico CJ1910162202 (en el slug, case-insensitive) — va PRIMERO:
    // en links tipo "...-cj1910162202,p-16152996.html" el p-NNN es el VID, no el pid.
    const mCJ = (pathAndQuery + ' ' + raw).match(/CJ\d{6,}/i);
    if (mCJ) push(mCJ[0].toUpperCase());
    // UUID (links nuevos de app.cjdropshipping.com)
    const mUuid = u.pathname.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
    if (mUuid && mUuid[1]) push(mUuid[1]);
    // pid tras -p- / ,p- (los links nuevos pueden incluir letras y UUID)
    const mP = pathAndQuery.match(/p-([A-Za-z0-9][A-Za-z0-9-]{5,})/i);
    if (mP && mP[1]) push(mP[1]);
    // número largo embebido en el slug
    const mNum = pathAndQuery.match(/(\d{15,})/);
    if (mNum && mNum[1]) push(mNum[1]);
    // /product/<solo-numeros>.html
    const mProd = u.pathname.match(/\/product\/(\d{6,})/i);
    if (mProd && mProd[1]) push(mProd[1]);
  } catch {
    // URL malformada: seguimos con regex plana abajo
  }
  const mPid = raw.match(/pid=(\d{6,})/i);
  if (mPid && mPid[1]) push(mPid[1]);
  const mP2 = raw.match(/p-([A-Za-z0-9][A-Za-z0-9-]{5,})/i);
  if (mP2 && mP2[1]) push(mP2[1]);
  const mCJ2 = raw.match(/CJ\d{6,}/i);
  if (mCJ2) push(mCJ2[0].toUpperCase());
  const mNum2 = raw.match(/(\d{15,})/);
  if (mNum2 && mNum2[1]) push(mNum2[1]);
  return out;
}

/** Compat: primer candidato (antes devolvía el slug, lo que rompía el preview). */
export function extractPID(url: string): string | null {
  return extractPidCandidates(url)[0] ?? null;
}

/**
 * Saca palabras clave del slug del link para buscar por nombre en CJ
 * cuando el link no trae ningún ID (/product/cool-phone-case.html).
 */
export function extractSlugKeywords(url: string): string {
  try {
    const raw = (url || '').trim();
    const full = raw.startsWith('http') ? raw : 'https://' + raw;
    const u = new URL(full);
    const m = u.pathname.match(/\/product(?:-detail)?\/([^/?#]+)/i);
    if (!m || !m[1]) return '';
    let slug = m[1];
    slug = slug.replace(/\.html?$/i, '');
    slug = slug.replace(/[,._-]*p-[A-Za-z0-9-]+$/i, '');
    slug = slug.replace(/cj\d{6,}/gi, ' ');
    slug = slug.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    return slug.replace(/[-,_]+/g, ' ').trim();
  } catch {
    return '';
  }
}

export async function getCJProduct(pid: string): Promise<any> {
  const token = await getCJToken();
  const cleanPid = String(pid || '').trim();
  const attempts: Array<{ url: string; params: Record<string, any> }> = [
    { url: `${CJ_API_BASE}/product/query`, params: { pid: cleanPid } },
    { url: `${CJ_API_BASE}/product/query`, params: { pid: cleanPid, productId: cleanPid } },
    { url: `${CJ_API_BASE}/product/list`, params: { pid: cleanPid, pageNum: 1, pageSize: 10 } },
  ];
  for (const att of attempts) {
    try {
      const response = await cjGet(att.url, att.params, token);
      const payload = response.data?.data ?? response.data;
      if (Array.isArray(payload) && payload.length > 0) return payload[0];
      if (payload?.list && Array.isArray(payload.list) && payload.list.length > 0) return payload.list[0];
      if (payload?.content && Array.isArray(payload.content) && payload.content.length > 0) return payload.content[0];
      if (payload && (payload.productNameEn || payload.productName || payload.pid || payload.id)) return payload;
      const msg = String(response.data?.message ?? '');
      console.warn('[CJ] sin match pid=' + cleanPid + ' via ' + att.url.replace(CJ_API_BASE, '') + ' resp=' + JSON.stringify(response.data)?.slice(0, 400));
      // "Product not found" es respuesta definitiva del endpoint query:
      // no sirve de nada quemar QPS con los otros intentos para este pid.
      if (msg.includes('not found')) return null;
    } catch (err: any) {
      const st = err?.response?.status ?? 'no-status';
      const body = err?.response ? JSON.stringify(err.response.data)?.slice(0, 400) : String(err?.message ?? err);
      console.warn('[CJ] fallo pid=' + cleanPid + ' status=' + st + ' body=' + body);
    }
  }
  return null;
}

/**
 * Score de relevancia 0..1: proporción de palabras significativas de `keywords`
 * que aparecen en `name`. Evita importar el producto equivocado cuando la
 * búsqueda por nombre de CJ devuelve resultados flojos/no relacionados.
 */
export function keywordRelevance(name: string, keywords: string): number {
  const STOP = new Set(['for', 'and', 'the', 'with', 'from', 'women', 'men', 'kids', 'unisex', 'new', 'hot', 'style', 'color', 'type']);
  const kws = String(keywords || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  if (kws.length === 0) return 0;
  const n = String(name || '').toLowerCase();
  const hits = kws.filter((w) => n.includes(w)).length;
  return hits / kws.length;
}

/**
 * Busca productos en CJ por palabras clave (slug del link) cuando
 * ningún candidato de ID funcionó. Devuelve el producto MÁS relevante
 * (>= 60% de coincidencias) o null si nada calza — nunca importa
 * un producto no relacionado solo porque CJ lo devuelva en la lista.
 * Prueba la frase completa y variantes cortas porque CJ busca mal frases largas.
 */
export async function searchCJProductByKeyword(keywords: string): Promise<any | null> {
  const kw = String(keywords || '').trim();
  if (!kw) return null;
  const token = await getCJToken();

  const STOP = new Set(['for', 'and', 'the', 'with', 'from', 'women', 'men', 'kids', 'unisex', 'new', 'hot', 'style']);
  const words = kw.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  const variants = [kw, words.slice(0, 4).join(' '), words.slice(0, 2).join(' ')].filter(
    (v, i, arr) => v && arr.indexOf(v) === i
  );

  for (const variant of variants) {
    try {
      const response = await cjGet(
        `${CJ_API_BASE}/product/list`,
        { productNameEn: variant, pageNum: 1, pageSize: 10 },
        token
      );
      const payload = response.data?.data ?? response.data;
      const list: any[] = payload?.list ?? payload?.content ?? (Array.isArray(payload) ? payload : []);
      if (!Array.isArray(list) || list.length === 0) {
        console.warn('[CJ] busqueda "' + variant + '" sin resultados');
        continue;
      }
      let best: any = null;
      let bestScore = 0;
      for (const item of list) {
        const score = keywordRelevance(String(item.productNameEn ?? item.productName ?? ''), kw);
        if (score > bestScore) {
          best = item;
          bestScore = score;
        }
      }
      if (best && bestScore >= 0.6) {
        console.warn('[CJ] busqueda "' + variant + '" -> match relevante (' + Math.round(bestScore * 100) + '%): ' + String(best.productNameEn).slice(0, 60));
        return best;
      }
      console.warn('[CJ] busqueda "' + variant + '" -> ' + list.length + ' resultados pero ninguno relevante (mejor ' + Math.round(bestScore * 100) + '%)');
    } catch (err: any) {
      const st = err?.response?.status ?? 'no-status';
      const body = err?.response ? JSON.stringify(err.response.data)?.slice(0, 400) : String(err?.message ?? err);
      console.warn('[CJ] fallo busqueda "' + variant + '"', st, body);
    }
  }
  return null;
}

export function detectCollection(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/gamer|mouse|keyboard|teclado|audifonos|headset|rgb|monitor|pc|gaming|mouse gamer|teclado mecanico/.test(text)) {
    return 'tech-gamer';
  }
  if (/led|humidifier|humificador|smart|hogar|cocina|luz|lampara|home|despacho/.test(text)) {
    return 'hogar-smart';
  }
  if (/hair|beauty|belleza|makeup|maquillaje|masajeador|massager|pelo|labial/.test(text)) {
    return 'belleza';
  }
  if (/fitness|gym|deporte|sport|ejercicio|yoga|correr|running|pesa|dumbbell/.test(text)) {
    return 'fitness';
  }
  return 'tendencias-viral';
}

export function calculatePrice(cjPrice: number): { price: number; comparePrice: number } {
  const price = Math.round(cjPrice * 2);
  const comparePrice = Math.round(price * 1.35);
  return { price, comparePrice };
}

export const TRANSLATION_DICTIONARY: Record<string, string> = {
  'Wireless': 'Inalámbrico',
  'Bluetooth': 'Bluetooth',
  'Gaming': 'Gamer',
  'Mouse': 'Mouse',
  'Keyboard': 'Teclado',
  'LED': 'LED',
  'Humidifier': 'Humidificador',
  'Aroma': 'Aroma',
  'Essential Oil': 'Aceite Esencial',
  'Massager': 'Masajeador',
  'Fitness': 'Fitness',
  'Smart': 'Smart',
  'Home': 'Hogar',
  'Beauty': 'Belleza',
  'Hair': 'Pelo',
  'Makeup': 'Maquillaje',
  'Gym': 'Gimnasio',
  'Sport': 'Deporte',
  'Running': 'Running',
  'USB': 'USB',
  'Charging': 'Carga',
  'Power Bank': 'Power Bank',
  'Lamp': 'Lámpara',
  'Light': 'Luz',
  'Desk': 'Escritorio',
  'Monitor': 'Monitor',
  'Headset': 'Auriculares',
  'Earphone': 'Audífono',
  'Speaker': ' Parlante',
  'Camera': 'Cámara',
  'Watch': 'Reloj',
  'Band': 'Band',
  'Drone': 'Drone',
  'Toy': 'Juguete',
  'Kids': 'Niños',
  'Men': 'Hombres',
  'Women': 'Mujeres',
  'Unisex': 'Unisex',
  'Summer': 'Verano',
  'Winter': 'Invierno',
  'Waterproof': 'Impermeable',
  'Portable': 'Portátil',
  'Rechargeable': 'Recargable',
  'Automatic': 'Automático',
  'Electric': 'Eléctrico',
  'Digital': 'Digital',
  'Mini': 'Mini',
  'Pro': 'Pro',
  'Max': 'Max',
  'Plus': 'Plus',
  'New': 'Nuevo',
  'Hot': 'Popular',
  'Best Seller': 'Más Vendido',
};

function translateWithDictionary(text: string): string {
  let result = text;
  for (const [en, es] of Object.entries(TRANSLATION_DICTIONARY)) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    result = result.replace(regex, es);
  }
  return result.replace(/\s+/g, ' ').trim();
}

export async function translateToChileanSpanish(text: string): Promise<string> {
  if (!text) return '';

  const hasApiKey = !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  if (hasApiKey) {
    const ai = await translateWithAI(text);
    if (ai) return ai;
  }

  const mem = await translateWithMyMemory(text);
  if (mem && mem !== text) return mem;

  return translateWithDictionary(text);
}

export async function translateDescriptionToSpanish(description: string): Promise<string> {
  if (!description) return '';

  const cleaned = description.replace(/<img[^>]*>/gi, '');
  const ai = await translateWithAI(cleaned);
  if (ai) return ai;
  return translateWithDictionary(cleaned);
}
