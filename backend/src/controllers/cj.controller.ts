import { Request, Response } from 'express';
import { createHash } from 'crypto';
import {
  getCJProduct,
  extractPidCandidates,
  extractSlugKeywords,
  searchCJProductByKeyword,
  detectCollection,
  scrapeCJProductPage,
} from '../lib/cj';
import { translateEnToEs } from '../lib/translate';
import { prisma } from '../lib/prisma';

// Margen 100% = x2 (si cuesta 1, vendemos a 2)
export const MARGIN_MULTIPLIER = 2;

/**
 * Calcula el precio final CLP para un producto CJ.
 * Reutilizado por ambos importadores: single (importCJProduct) y bulk (bulkImportCJ).
 * Fórmula: costTotalUSD * marginMultiplier * dollarRate, redondeado a múltiplos de 10.
 */
export function calculateFinalPrice(
  costTotalUSD: number,
  marginMultiplier: number,
  dollarRate: number
): { precioFinalUSD: number; precioFinalCLP: number } {
  const precioFinalUSD = costTotalUSD * marginMultiplier;
  const precioFinalCLP = Math.round(precioFinalUSD * dollarRate / 10) * 10;
  return { precioFinalUSD, precioFinalCLP };
}

/**
 * Resuelve un producto CJ desde el link pegado por el usuario:
 * 1) prueba cada candidato de ID extraído del link (?pid=, -p-XXX, CJ19..., uuid, ...)
 * 2) si ninguno funciona, busca por las palabras del slug en la API de CJ
 * Devuelve { cjData, pid } o null si no encontró nada.
 */
export async function resolveCJProductFromUrl(url: string): Promise<{ cjData: any; pid: string } | null> {
  const candidates = extractPidCandidates(url);
  console.log('[CJ resolve] candidatos:', candidates.join(', ') || '(ninguno)');

  for (const candidate of candidates) {
    const found = await getCJProduct(candidate);
    if (found) {
      const realPid = String(found.pid ?? found.productId ?? found.id ?? candidate);
      console.log('[CJ resolve] match con candidato', candidate, '-> pid real', realPid);

      const hasTitle = Boolean(found.productNameEn || found.productName || found.title);
      const hasPrice = Number(found.price) > 0
        || Number(found.sellPrice) > 0
        || (Array.isArray(found.variants) && found.variants.some((variant: any) =>
          Number(variant.variantSellPrice || variant.price || variant.sellPrice) > 0));
      if (!hasTitle || !hasPrice) {
        const pageData = await scrapeCJProductPage(url);
        if (pageData) {
          if (pageData.title && !found.productNameEn && !found.productName && !found.title) {
            found.productNameEn = pageData.title;
          }
          if (pageData.price && !Number(found.price) && !Number(found.sellPrice)) {
            found.price = pageData.price;
            found.sellPrice = pageData.price;
          }
          if (pageData.category && !found.category) found.category = pageData.category;
          if (pageData.description && !found.description) found.description = pageData.description;
          if (!Array.isArray(found.productImageSet) && pageData.images.length) {
            found.productImageSet = pageData.images;
          }
        }
      }
      return { cjData: found, pid: realPid };
    }
  }

  const keywords = extractSlugKeywords(url);
  if (keywords) {
    console.log('[CJ resolve] sin match por ID, buscando por slug:', keywords);
    const byKeyword = await searchCJProductByKeyword(keywords);
    if (byKeyword) {
      const realPid = String(byKeyword.pid ?? byKeyword.productId ?? byKeyword.id ?? '');
      if (realPid) {
        console.log('[CJ resolve] match por slug -> pid real', realPid);
        return { cjData: byKeyword, pid: realPid };
      }
    }
  }

  const pageData = await scrapeCJProductPage(url);
  if (pageData?.title || pageData?.price) {
    const pid = candidates[0] ?? `html-${createHash('sha1').update(url).digest('hex').slice(0, 16)}`;
    console.log('[CJ resolve] fallback HTML -> pid', pid);
    return {
      cjData: {
        ...pageData,
        productNameEn: pageData.title || 'Producto CJ',
        price: pageData.price || 0,
        sellPrice: pageData.price || 0,
        variants: pageData.price ? [{
          variantSku: `html-${pid.slice(-12)}`,
          variantSellPrice: pageData.price,
          price: pageData.price,
          sellPrice: pageData.price,
        }] : [],
      },
      pid,
    };
  }

  return null;
}

export async function resolveCJProductFromUrlWithRetry(
  url: string,
  retries = 1,
): Promise<{ cjData: any; pid: string } | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resolved = await resolveCJProductFromUrl(url);
      if (resolved) return resolved;
    } catch (error) {
      lastError = error;
      console.warn(`[CJ resolve] intento ${attempt + 1}/${retries + 1} fallido:`, error);
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  if (lastError) throw lastError;
  return null;
}

/**
 * Obtiene el tipo de cambio USD -> CLP.
 * Orden: caché en memoria -> mindicador.cl -> open.er-api.com -> exchangerate.host -> 950.
 * Con User-Agent y timeout porque en serverless (Vercel) el fetch sin headers
 * puede ser bloqueado y colgarse.
 */
let cachedDollarRate: { value: number; ts: number } | null = null;
const DOLLAR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas
const DOLLAR_FALLBACK = 950;

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getDollarRate(): Promise<number> {
  // 1) Caché fresca
  if (cachedDollarRate && Date.now() - cachedDollarRate.ts < DOLLAR_CACHE_TTL) {
    return cachedDollarRate.value;
  }

  // 2) mindicador.cl (fuente oficial para CLP)
  try {
    const json: any = await fetchJsonWithTimeout('https://mindicador.cl/api/dolar');
    // mindicador.cl cambió el formato: antes "dolar":[{valor}], ahora "serie":[{valor}]
    const serie = Array.isArray(json?.serie) && json.serie.length ? json.serie[0]?.valor : null;
    const dolar = Array.isArray(json?.dolar) && json.dolar.length ? json.dolar[0]?.valor : null;
    const value = parseFloat(String(serie ?? dolar ?? ''));
    if (Number.isFinite(value) && value > 0) {
      cachedDollarRate = { value, ts: Date.now() };
      return value;
    }
    console.warn('[dolar] mindicador.cl sin valor útil (serie=', serie, 'dolar=', dolar, ')');
  } catch (error: any) {
    console.warn('[dolar] falló mindicador.cl:', error?.message ?? error);
  }

  // 3) Respaldo 1: open.er-api.com (USD -> CLP)
  try {
    const json: any = await fetchJsonWithTimeout('https://open.er-api.com/v6/latest/USD');
    const value = parseFloat(String(json?.rates?.CLP ?? ''));
    if (Number.isFinite(value) && value > 0) {
      cachedDollarRate = { value, ts: Date.now() };
      return value;
    }
    console.warn('[dolar] open.er-api.com sin valor útil');
  } catch (error: any) {
    console.warn('[dolar] falló open.er-api.com:', error?.message ?? error);
  }

  // 4) Respaldo 2: exchangerate.host
  try {
    const json: any = await fetchJsonWithTimeout('https://api.exchangerate.host/latest?base=USD&symbols=CLP');
    const value = parseFloat(String(json?.rates?.CLP ?? ''));
    if (Number.isFinite(value) && value > 0) {
      cachedDollarRate = { value, ts: Date.now() };
      return value;
    }
    console.warn('[dolar] exchangerate.host sin valor útil');
  } catch (error: any) {
    console.warn('[dolar] falló exchangerate.host:', error?.message ?? error);
  }

  return DOLLAR_FALLBACK;
}

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

function firstNumber(...vals: any[]): number {
  for (const raw of vals) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) continue;
      // CJ a veces manda rangos: "0.45-28.00" -> tomamos el mínimo
      const m = t.match(/(\d+(?:\.\d+)?)/);
      if (m) {
        const n = parseFloat(m[1] ?? '');
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return 0;
}

export function extractCJPrice(cjData: any): number {
  const variants = Array.isArray(cjData?.variants) ? cjData.variants : [];
  let min = Infinity;
  for (const v of variants) {
    const n = firstNumber(v?.variantSellPrice, v?.price, v?.sellPrice, 0);
    if (n > 0 && n < min) min = n;
  }
  if (Number.isFinite(min) && min !== Infinity && min > 0) return min;
  return firstNumber(
    cjData?.sellPrice,
    cjData?.price,
    cjData?.suggestSellPrice,
    cjData?.productSellPrice,
    cjData?.salePrice,
    0,
  );
}

export function autoCategory(cjProduct: any): string {
  const title = ((cjProduct.productNameEn || cjProduct.productName || '') + ' ' + (cjProduct.category || '')).toLowerCase();

  if (/water bottle|hot water|guatero/.test(title)) return 'guateros';
  if (/plush|peluche/.test(title)) return 'peluches';
  if (/bottle|taza|termo/.test(title)) return 'hogar';
  if (/necklace|bracelet|earring|\bring\b|pendant|chain|jewelry|jewellery|joyer|pulsera|arete|anillo|dije|collar/.test(title)) return 'joyeria';
  if (/dress|shirt|pants|jeans|jacket|coat|skirt|blouse|hoodie|sweater|\btop\b|t-shirt|pantalon|vestido|chaqueta|sueter|falda|blusa/.test(title)) return 'ropa';
  if (/shoes|sneaker|boot|sandal|shoe|zapato|zapatilla|bota|sandalia/.test(title)) return 'calzado';
  if (/watch|clock|reloj/.test(title)) return 'relojes';
  if (/\bbag\b|backpack|handbag|mochila|cartera|bolso/.test(title)) return 'bolsos';
  if (/phone case|case for|protector|funda|carcasa/.test(title)) return 'accesorios-telefono';
  if (/headphone|earphone|speaker|bluetooth|audifono|audífono|parlante/.test(title)) return 'electronica';
  if (/mouse|keyboard|monitor|usb|cable|charger|teclado|mouse gamer/.test(title)) return 'computacion';
  if (/makeup|maquillaje|lipstick|foundation|mascara|labial|base de maquillaje/.test(title)) return 'belleza';
  if (/\bhair|pelu|wig|hair extension|peluca|extensiones/.test(title)) return 'belleza';
  if (/massager|masajeador|facial|skincare|skin care|rostro/.test(title)) return 'belleza';
  if (/gym|fitness|deporte|yoga|correr|running|pesa|dumbbell|ejercicio/.test(title)) return 'deportes';
  if (/toy|juguete|niños|kids|bebe|baby/.test(title)) return 'juguetes';
  if (/\bpet\b|\bdog\b|\bcat\b|perro|gato|mascota/.test(title)) return 'mascotas';
  if (/home|hogar|cocina|luz|lampara|light|despacho|decor|decoracion/.test(title)) return 'hogar';
  if (/gamer|rgb|mouse gamer|teclado mecanico/.test(title)) return 'tech-gamer';

  return 'accesorios';
}

export const VALID_CATEGORY_SLUGS = new Set([
  'general',
  'accesorios',
  'accesorios-telefono',
  'joyeria',
  'ropa',
  'calzado',
  'relojes',
  'bolsos',
  'electronica',
  'computacion',
  'belleza',
  'deportes',
  'juguetes',
  'mascotas',
  'hogar',
  'importados',
  'tech-gamer',
  'hogar-smart',
  'fitness',
  'tendencias-viral',
  'guateros',
  'peluches',
]);

const FALLBACK_CATEGORY_SLUG = 'accesorios';

export function normalizeCategorySlug(category?: unknown): string {
  const raw = String(category ?? '').trim().toLowerCase();
  const slug = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug && VALID_CATEGORY_SLUGS.has(slug) ? slug : FALLBACK_CATEGORY_SLUG;
}

export function normalizeCJCategory(category?: unknown, title = ''): string {
  const raw = String(category ?? '').trim();
  const rawSlug = normalizeCategorySlug(raw);
  if (raw && VALID_CATEGORY_SLUGS.has(rawSlug)) return rawSlug;

  const keywordSlug = normalizeCategorySlug(autoCategory({ productNameEn: title, category: raw }));
  return VALID_CATEGORY_SLUGS.has(keywordSlug) ? keywordSlug : FALLBACK_CATEGORY_SLUG;
}

export function extractShippingCost(cjData: any, cjPrice: number): number {
  const raw = cjData.shippingCost ?? cjData.freight ?? cjData.freightPrice ?? cjData.shippingPrice ?? cjData.shipping ?? cjData.totalCost ?? cjData.totalPrice ?? cjData.productTotal ?? 0;
  const value = parseFloat(String(raw));
  if (Number.isFinite(value) && value > 0) return value;
  const total = parseFloat(String(cjData.totalCost ?? cjData.totalPrice ?? cjData.productTotal ?? 0));
  if (Number.isFinite(total) && total > cjPrice) return total - cjPrice;
  return 0;
}

export function extractCJStock(cjData: any): number {
  const raw = cjData.inventoryNum ?? cjData.stock ?? cjData.totalStock ?? cjData.availableStock ?? 0;
  const value = parseInt(String(raw), 10);
  if (Number.isInteger(value) && value >= 0) return value;
  if (Array.isArray(cjData.variants)) {
    const sum = cjData.variants.reduce((acc: number, v: any) => {
      const s = parseInt(v.inventoryNum || v.stock || '0', 10);
      return acc + (Number.isInteger(s) && s >= 0 ? s : 0);
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
}

export function parseCJImages(cjData: any): string[] {
  const images: string[] = [];
  try {
    const parsed = JSON.parse(cjData.productImage || '[]');
    if (Array.isArray(parsed)) images.push(...parsed.filter(Boolean));
  } catch {}
  if (!images.length && Array.isArray(cjData.productImageSet)) {
    images.push(...cjData.productImageSet.filter(Boolean));
  }
  return images;
}

export async function mapCJVariant(
  v: any,
  _cjPrice: number,
  _shippingUSD = 0,
  marginMultiplier = MARGIN_MULTIPLIER,
  dollarRate = 950,
  variantImage?: string,
  fallbackStock = 100
) {
  const sku = String(v.variantSku || v.sku || `cj-${v.pid || 'x'}-${v.vid || Math.random().toString(36).slice(2, 8)}`);
  const variantNameEn = v.variantNameEn || v.variantName || '';
  const name = variantNameEn;
  const nameEs = await translateEnToEs(variantNameEn);
  let color: string | null = null;
  let size: string | null = null;
  const lower = String(name || '').toLowerCase();
  if (lower.includes('purple')) color = 'Morado';
  else if (lower.includes('pink')) color = 'Rosado';
  else if (lower.includes('blue')) color = 'Azul';
  size = name || null;
  // Precio de ESTA variante (NO el global): cada variante tiene su propio variantSellPrice
  const rawSell = v.variantSellPrice ?? v.sellPrice ?? v.price ?? v.variantPrice ?? _cjPrice;
  let sellPrice = parseFloat(String(rawSell ?? '0'));
  if (!Number.isFinite(sellPrice) || sellPrice <= 0) sellPrice = Number(_cjPrice) || 0;
  const shipNum = Number(_shippingUSD);
  const shipping = Number.isFinite(shipNum) && shipNum > 0 ? shipNum : 0;
  const totalCostVariant = sellPrice + shipping;
  const { precioFinalCLP, precioFinalUSD } = calculateFinalPrice(totalCostVariant, marginMultiplier, dollarRate);
  const rawStock = v.variantInventory ?? v.inventoryNum ?? v.stock ?? v.quantity ?? '0';
  let stock = parseInt(String(rawStock ?? '0'), 10);
  if (!Number.isInteger(stock) || stock < 0) stock = 0;
  // CJ a veces no envía inventory por variante: fallback para que la variante
  // sea comprable (mismo criterio que el importador legacy: stock global o 100).
  if (stock === 0) stock = fallbackStock;
  return {
    vid: String(v.vid || v.variantId || sku),
    sku,
    name,
    nameEs,
    image: variantImage || v.variantImage || v.image || '',
    sellPrice,
    shipping,
    finalPrice: precioFinalCLP,
    finalPriceCLP: precioFinalCLP,
    finalPriceUSD: precioFinalUSD,
    price: precioFinalCLP,
    stock,
    size,
    color,
  };
}

async function getVariantShippingCost(_vid: string, cjData: any, defaultShipping: number): Promise<number> {
  // Placeholder: si en el futuro la API de CJ o un servicio de envíos provee
  // shipping por variante, se calcula aquí. Por ahora retorna el shipping global.
  return defaultShipping;
}

/**
 * Devuelve la categoría a usar. Si no existe una con el slug indicado,
 * la crea (y si no se pasa slug, garantiza la categoría "General").
 * El esquema exige `categoryId` no nulo en Product, por eso NUNCA debe
 * quedar undefined/'general' como string suelto (violaría la FK).
 * Usa upsert para evitar race conditions en importaciones bulk.
 */
export async function resolveCategory(slug?: string): Promise<{ id: string; name: string; slug: string }> {
  const targetSlug = normalizeCategorySlug(slug);

  return prisma.category.upsert({
    where: { slug: targetSlug },
    update: {},
    create: {
      name: targetSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug: targetSlug,
    },
  });
}

/** FEATURE B: detecta categoría main + sub desde el nombre del producto (EN/ES). */
export function detectCategory(name: string, cjCategory?: string): { main: string; sub: string } {
  const n = (name || '').toLowerCase();
  if (n.includes('phone case') || n.includes('carcasa') || n.includes('iphone') || n.includes('samsung'))
    return { main: 'Tecnología', sub: 'Accesorios Celular' };
  if (n.includes('charger') || n.includes('cargador') || n.includes('cable') || n.includes('wireless'))
    return { main: 'Tecnología', sub: 'Cargadores' };
  if (n.includes('watch') || n.includes('reloj'))
    return { main: 'Tecnología', sub: 'Smartwatch' };
  if (n.includes('earphone') || n.includes('audifono') || n.includes('headphone'))
    return { main: 'Tecnología', sub: 'Audio' };
  if (n.includes('kitchen') || n.includes('cocina'))
    return { main: 'Hogar', sub: 'Cocina' };
  if (n.includes('toy') || n.includes('juguete'))
    return { main: 'Juguetes', sub: 'General' };

  const normalized = normalizeCJCategory(cjCategory, name);
  const categories: Record<string, { main: string; sub: string }> = {
    accesorios: { main: 'Accesorios', sub: 'General' },
    'accesorios-telefono': { main: 'Tecnología', sub: 'Accesorios Celular' },
    joyeria: { main: 'General', sub: 'Joyeria' },
    ropa: { main: 'Moda', sub: 'Ropa' },
    calzado: { main: 'Moda', sub: 'Calzado' },
    relojes: { main: 'Tecnología', sub: 'Relojes' },
    bolsos: { main: 'Moda', sub: 'Bolsos' },
    electronica: { main: 'Tecnología', sub: 'Electrónica' },
    computacion: { main: 'Tecnología', sub: 'Computación' },
    belleza: { main: 'Belleza', sub: 'General' },
    deportes: { main: 'Deportes', sub: 'General' },
    juguetes: { main: 'Juguetes', sub: 'General' },
    mascotas: { main: 'Hogar', sub: 'Mascotas' },
    hogar: { main: 'Hogar', sub: 'General' },
    'tech-gamer': { main: 'Tecnología', sub: 'Gamer' },
    'hogar-smart': { main: 'Hogar', sub: 'Hogar Smart' },
    fitness: { main: 'Deportes', sub: 'Fitness' },
    'tendencias-viral': { main: 'Tendencias', sub: 'Viral' },
    guateros: { main: 'Hogar', sub: 'Guateros' },
    peluches: { main: 'Juguetes', sub: 'Peluches' },
    importados: { main: 'General', sub: 'Importados' },
  };
  return categories[normalized] || { main: 'Accesorios', sub: 'General' };
}

function slugifyCategory(name: string): string {
  return (name || 'general')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'general';
}

/**
 * FEATURE B: garantiza main > sub (crea las que no existan) y devuelve la sub.
 * Si sub === 'General' se reutiliza la main para no duplicar productos en 2 categorías.
 * Usa upsert para evitar race conditions en importaciones bulk.
 */
export async function resolveMainSubCategory(main: string, sub: string): Promise<{ id: string; name: string }> {
  const validMains = new Set(['Tecnología', 'Hogar', 'Juguetes', 'General', 'Accesorios', 'Moda', 'Belleza', 'Deportes', 'Tendencias']);
  const validSubs = new Set([
    'General', 'Accesorios Celular', 'Cargadores', 'Smartwatch', 'Audio', 'Cocina', 'Joyeria', 'Ropa', 'Calzado',
    'Relojes', 'Bolsos', 'Electrónica', 'Computación', 'Gamer', 'Hogar Smart', 'Mascotas', 'Fitness', 'Viral',
    'Guateros', 'Peluches', 'Importados',
  ]);
  const safeMain = validMains.has(main.trim()) ? main.trim() : 'Accesorios';
  const safeSub = validSubs.has(sub.trim()) ? sub.trim() : 'General';

  const mainSlug = slugifyCategory(safeMain);
  const mainCat = await prisma.category.upsert({
    where: { slug: mainSlug },
    update: { name: safeMain },
    create: { name: safeMain, slug: mainSlug },
  });

  if (!safeSub || safeSub.toLowerCase() === 'general' || safeSub.toLowerCase() === safeMain.toLowerCase()) {
    return mainCat;
  }

  const subSlug = slugifyCategory(safeSub);

  // 1) Sub ya existe bajo esta main (lookup más específico)
  let existingSub = await prisma.category.findFirst({
    where: { name: { equals: safeSub, mode: 'insensitive' }, parentId: mainCat.id },
  });
  if (existingSub) return existingSub;

  // 2) El slug ya existe en otra parte (p.ej. categoría root creada por resolveCategory
  //    en el importador Excel). Reutilizarla y reparentarla bajo la main correcta para
  //    evitar violación del UNIQUE(slug) y mantener la jerarquía coherente.
  existingSub = await prisma.category.findUnique({ where: { slug: subSlug } });
  if (existingSub) {
    if (existingSub.parentId !== mainCat.id) {
      await prisma.category.update({
        where: { id: existingSub.id },
        data: { parentId: mainCat.id },
      });
    }
    return existingSub;
  }

  // 3) No existe: crear con upsert para evitar race condition.
  return prisma.category.upsert({
    where: { slug: subSlug },
    update: { name: safeSub, parentId: mainCat.id },
    create: { name: safeSub, slug: subSlug, parentId: mainCat.id },
  });
}

export const importCJProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      url,
      titleEs,
      price,
      collectionSlug,
      description: editedDescription,
      applyMargin,
      productPrice,
      shippingPrice,
      totalCost: incomingTotalCost,
      finalPrice: incomingFinalPrice,
      finalPriceCLP: incomingFinalPriceCLP,
      stock: incomingStock,
      margin: incomingMargin,
    } = req.body;
    if (!url) {
      res.status(400).json({ message: 'URL is required' });
      return;
    }

    const resolvedImport = await resolveCJProductFromUrlWithRetry(url);
    if (!resolvedImport) {
      res.status(404).json({ message: 'No se encontró el producto en CJ con ese link.' });
      return;
    }
    const { cjData, pid } = resolvedImport;

    const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
    const description = cjData.description || '';
    const cjImages = parseCJImages(cjData).slice(0, 5); // FASE 4A: máximo 5 fotos
    const productImage = cjImages[0] || '';
    const productImages = cjImages.slice(1);
    const variants = cjData.variants || [];
    const incomingProductPrice = Number(productPrice);
    const cjPrice = incomingProductPrice > 0 ? incomingProductPrice : extractCJPrice(cjData);
    const incomingShippingPrice = Number(shippingPrice);
    const shippingCost = incomingShippingPrice > 0
      ? incomingShippingPrice
      : extractShippingCost(cjData, cjPrice);
    const incomingTotalCostValue = Number(incomingTotalCost);
    const totalCost = incomingTotalCostValue > 0 && Number.isFinite(incomingTotalCostValue)
      ? incomingTotalCostValue
      : cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);
    const incomingStockValue = Number(incomingStock);
    const stock = incomingStockValue >= 0 && Number.isFinite(incomingStockValue)
      ? incomingStockValue
      : extractCJStock(cjData);
    const cjWeight = parseFloat(cjData.packingWeight || cjData.productWeight || '0') || undefined;

    const rawTitle = productNameEn;
    const title = await translateEnToEs(rawTitle);
    const finalTitle = (titleEs && String(titleEs).trim()) || title;
    const finalDescription = (editedDescription !== undefined && String(editedDescription).trim()) || await translateEnToEs(description);

    const shouldApplyMargin = applyMargin !== false;
    const marginMultiplier = Number(incomingMargin) > 0 ? Number(incomingMargin) : MARGIN_MULTIPLIER;

    // Obtener dólar del día desde mindicador.cl
    const dollarRate = await getDollarRate();

    // Costo Total USD = Precio + Envío
    const costTotalUSD = totalCost;

    // Costo Total CLP = Costo Total USD * dolar
    const costTotalCLP = costTotalUSD * dollarRate;

    // Precio Final CLP = Costo Total USD * margen * dolar (usa función compartida)
    const effectiveMargin = shouldApplyMargin ? marginMultiplier : 1;
    const { precioFinalCLP } = calculateFinalPrice(costTotalUSD, effectiveMargin, dollarRate);
    const finalPriceCLP = precioFinalCLP;
    const precioFinalUSD = costTotalUSD * effectiveMargin;

    const autoSlug = normalizeCJCategory(cjData?.category, finalTitle);
    const finalCollectionSlug = collectionSlug?.trim() || detectCollection(finalTitle, finalDescription);

    // FEATURE B: categoría main > sub automática (crea las que no existan)
    const { main: catMain, sub: catSub } = detectCategory(finalTitle, autoSlug);
    const category = await resolveMainSubCategory(catMain, catSub);
    const collection = await prisma.collection.findUnique({ where: { slug: finalCollectionSlug } });
    const collectionId = collection?.id ?? (await prisma.collection.create({
      data: {
        name: finalCollectionSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        slug: finalCollectionSlug,
      },
    })).id;

    // Variantas elegidas por el admin (frontend envía selectedVariantSkus).
    // Si no envía nada, se importan todas.
    const selectedSkus: string[] = Array.isArray(req.body.selectedVariantSkus)
      ? req.body.selectedVariantSkus.map((s: any) => String(s).trim()).filter(Boolean)
      : [];

    const filteredVariants = selectedSkus.length
      ? variants.filter((v: any) =>
          selectedSkus.includes(String(v.variantSku || v.sku || '')) ||
          selectedSkus.includes(String(v.vid || v.variantId || '')),
        )
      : variants;

    // Precio final por variante (shipping por variante: usa getVariantShippingCost placeholder)
    const shippingUSD = Number.isFinite(shippingCost) ? shippingCost : 0;

    // Mapeo de variantes con precio final (se reutiliza en preview y en import).
    // effectiveMargin respeta el margen elegido en el admin (x1.5 / x2 / x2.5...).
    const mappedVariants = await Promise.all(filteredVariants.map((v: any) =>
      mapCJVariant(v, cjPrice, shippingUSD, effectiveMargin, dollarRate, undefined, Number(stock) > 0 ? Number(stock) : 100)
    ));

    // images = fotos del producto + fotos de variantes (sin duplicados, máximo 10).
    // cjImages ya viene slice(0,5); allImages guarda imagen real principal en [0].
    const allImages = Array.from(
      new Set([
        ...cjImages,
        ...mappedVariants.map((v: any) => v.image).filter(Boolean),
      ])
    ).slice(0, 10);

    // variants JSON (se guarda en columna variants)
    const mappedVariantsJSON = mappedVariants.map((v: any) => ({
      vid: v.sku,
      name: v.name,
      nameEs: v.nameEs,
      sku: v.sku,
      sellPrice: v.sellPrice,
      shipping: v.shipping,
      finalPrice: v.finalPriceCLP,
      finalPriceUSD: v.finalPriceUSD,
      stock: v.stock,
      image: v.image,
      size: v.size,
      color: v.color,
    }));

    // price = precio final de la variante más barata (para listado).
    // Si el admin editó el precio a mano (incomingFinalPriceCLP), ese manda.
    const cheapestVariantPrice = mappedVariants.length
      ? Math.min(...mappedVariants.map((v: any) => Number(v.finalPriceCLP) || 0).filter((n: number) => n > 0))
      : 0;
    const editedFinal =
      Number(incomingFinalPriceCLP) > 0 ? Number(incomingFinalPriceCLP)
      : Number(incomingFinalPrice) > 0 ? Number(incomingFinalPrice)
      : Number(price) > 0 ? Number(price)
      : 0;
    const finalPrice =
      editedFinal > 0 ? Math.round(editedFinal)
      : Number.isFinite(cheapestVariantPrice) && cheapestVariantPrice > 0 ? Math.round(cheapestVariantPrice)
      : Math.round(finalPriceCLP);

    // stock global del producto: si hay variantes usamos el máximo (las variantes
    // comparten el mismo pool físico en CJ); sino el stock global editado.
    const variantStocks = mappedVariants.map((v: any) => Number(v.stock) || 0);
    const maxVariantStock = variantStocks.length ? Math.max(...variantStocks) : 0;
    const finalStock = maxVariantStock > 0 ? maxVariantStock : Number(stock) || 0;

    // Variantas que llegan a la BD (productVariants)
    const importedVariants = mappedVariants;

    // Evitar duplicados si el producto CJ ya fue importado
    const existingCj = await prisma.product.findFirst({ where: { cjProductId: String(pid) } });
    if (existingCj) {
      res.status(409).json({ message: 'Este producto CJ ya fue importado', productId: existingCj.id });
      return;
    }

    const slug = `${finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`.slice(0, 100);

    const product = await prisma.product.create({
      data: {
        name: finalTitle,
        slug,
        description: finalDescription,
        images: allImages,
        tags: [finalCollectionSlug],
        categoryId: category.id,
        salePrice: finalPrice,
        margin: finalPrice > 0 ? parseFloat((((finalPrice - costTotalCLP) / finalPrice) * 100).toFixed(2)) : 0,
        totalCost: totalCost,
        productCost: cjPrice,
        shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
        stock: finalStock,
        weight: cjWeight,
        status: 'PUBLISHED',
        importSource: 'CJ_DROPSHIPPING',
        cjProductId: String(pid),
        cjVariants: mappedVariantsJSON,
        variants: mappedVariantsJSON,
        collectionId,
        sourceUrl: url,
        sourcePlatform: 'CJ',
        sourceId: String(pid),
        costUsd: Number(totalCost) || null,
        lastCheckedAt: new Date(),
        productImages: {
          create: allImages.map((imgUrl: string, i: number) => ({ url: imgUrl, position: i })),
        },
        productVariants: {
          create: importedVariants.map((v: any) => ({
            sku: String(v.sku),
            // Prisma ProductVariant NO tiene name/image: size guarda el nombre de la
            // variante (para el selector) y nameEs/image/finalPrice van en el JSON variants.
            size: (v.name || v.size) ? String(v.name || v.size).slice(0, 60) : undefined,
            color: v.color ? String(v.color).slice(0, 60) : undefined,
            price: Math.round(Number(v.finalPriceCLP) || 0),
            stock: Number(v.stock) || 0,
          })),
        },
      },
      include: { productImages: true, productVariants: true, collection: true },
    });

    res.status(201).json({ message: 'Product imported successfully', product });
  } catch (error: any) {
    const detail = error instanceof Error ? error.message : String(error ?? 'Error desconocido');
    console.error('Error importing CJ product:', error);
    res.status(500).json({ message: 'Error importing product', error: detail, detail });
  }
};

export const previewCJProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ message: 'Pega el link del producto CJ.' });
      return;
    }

    let resolved: { cjData: any; pid: string } | null = null;
    try {
      resolved = await resolveCJProductFromUrlWithRetry(url);
    } catch (err: any) {
      const detail = err instanceof Error ? err.message : String(err ?? 'Error desconocido');
      console.error('[CJ preview] error CJ api:', err?.response?.status, err?.response?.data ?? detail);
      res.status(502).json({ message: 'CJ respondió con error. Revisa tu API key o intenta de nuevo.', error: detail, detail });
      return;
    }
    if (!resolved) {
      res.status(404).json({ message: 'CJ no encontró ese producto. Copia el link completo desde la página del producto en CJ (debe incluir el ID).' });
      return;
    }
    const { cjData, pid } = resolved;

    const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
    const description = cjData.description || '';
    const cjImages = parseCJImages(cjData);
    const productImage = cjImages[0] || '';
    const productImages = cjImages.slice(1);
    const variants = cjData.variants || [];
    const cjPrice = extractCJPrice(cjData);
    const shippingCost = extractShippingCost(cjData, cjPrice);
    const totalCost = cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);
    const stock = extractCJStock(cjData);
    const rawTitle = productNameEn;
    const title = await translateEnToEs(rawTitle);
    const titleEs = title;
    const descriptionEs = await translateEnToEs(description);
    const collectionSlug = detectCollection(titleEs, descriptionEs);

    // Obtener dólar del día desde mindicador.cl
    const dollarRate = await getDollarRate();

    const costTotalUSD = totalCost;
    const costTotalCLP = costTotalUSD * dollarRate;
    // Usa la misma función compartida (calculateFinalPrice) para consistencia
    const { precioFinalCLP: suggestedPriceCLP } = calculateFinalPrice(costTotalUSD, MARGIN_MULTIPLIER, dollarRate);
    const suggestedPriceUSD = costTotalUSD * MARGIN_MULTIPLIER;

    const collections = await prisma.collection.findMany({ orderBy: { name: 'asc' } });

    res.json({
      pid,
      titleEs,
      description: descriptionEs,
      productImage,
      productImages,
      variants: await (async () => {
        const shippingUSD = Number.isFinite(shippingCost) ? shippingCost : 0;
        const mappedVariants = await Promise.all(variants.map((v: any) =>
          mapCJVariant(v, cjPrice, shippingUSD, MARGIN_MULTIPLIER, dollarRate, undefined, Number(stock) > 0 ? Number(stock) : 100)
        ));
        return mappedVariants.map((v: any) => ({
          sku: v.sku,
          name: v.name,
          nameEs: v.nameEs,
          image: v.image,
          sellPrice: v.sellPrice,
          shipping: v.shipping,
          finalPriceCLP: v.finalPriceCLP,
          finalPriceUSD: v.finalPriceUSD,
          price: v.finalPriceCLP,
          stock: v.stock,
          size: v.size,
          color: v.color,
        }));
      })(),
      cjPrice,
      shipping: shippingCost,
      totalCost,
      stock,
      inventory: stock,
      suggestedPriceUSD,
      suggestedPriceCLP,
      suggestedPrice: suggestedPriceCLP,
      comparePrice: suggestedPriceCLP,
      collectionSlug,
      autoCategory: normalizeCJCategory(cjData?.category, titleEs),
      collections,
      dollarRate,
      costTotalCLP,
    });
  } catch (error: any) {
    const detail = error instanceof Error ? error.message : String(error ?? 'Error desconocido');
    console.error('Error previewing CJ product:', error);
    res.status(500).json({ message: 'Error previewing product', error: detail, detail });
  }
};

export const listRecentProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { collection: true, productImages: true },
    });
    res.json({ products });
  } catch (error: any) {
    console.error('Error listing products:', error);
    res.status(500).json({ message: 'Error listing products', error: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};
