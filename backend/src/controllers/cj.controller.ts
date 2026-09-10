import { Request, Response } from 'express';
import {
  getCJProduct,
  extractPidCandidates,
  extractSlugKeywords,
  searchCJProductByKeyword,
  detectCollection,
  translateToChileanSpanish,
} from '../lib/cj';
import { prisma } from '../lib/prisma';

// Margen 100% = x2 (si cuesta 1, vendemos a 2)
export const MARGIN_MULTIPLIER = 2;

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
      return { cjData: found, pid: realPid };
    }
  }

  // Último recurso: búsqueda por nombre desde el slug del link
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

function extractCJPrice(cjData: any): number {
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

  return 'importados';
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

export function mapCJVariant(v: any, cjPrice: number) {
  const sku = v.variantSku || `cj-${v.pid}-${v.vid}`;
  const name = v.variantNameEn || v.variantName || '';
  let color: string | null = null;
  let size: string | null = null;
  if (name.toLowerCase().includes('purple')) color = 'Morado';
  else if (name.toLowerCase().includes('pink')) color = 'Rosado';
  else if (name.toLowerCase().includes('blue')) color = 'Azul';
  size = name || null;
  return {
    sku,
    price: parseFloat(v.variantSellPrice || v.price || String(cjPrice)),
    stock: parseInt(v.inventoryNum || v.stock || '999', 10),
    size,
    color,
  };
}

/**
 * Devuelve la categoría a usar. Si no existe una con el slug indicado,
 * la crea (y si no se pasa slug, garantiza la categoría "General").
 * El esquema exige `categoryId` no nulo en Product, por eso NUNCA debe
 * quedar undefined/'general' como string suelto (violaría la FK).
 */
export async function resolveCategory(slug?: string): Promise<{ id: string; name: string; slug: string }> {
  const targetSlug = slug?.trim().toLowerCase() || 'general';

  const existing = await prisma.category.findUnique({ where: { slug: targetSlug } });
  if (existing) return existing;

  return prisma.category.create({
    data: {
      name: targetSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug: targetSlug,
    },
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

    const resolvedImport = await resolveCJProductFromUrl(url);
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
    const cjPrice = parseFloat(productPrice ?? cjData.price ?? cjData.sellPrice ?? '0');
    const shippingCost = parseFloat(shippingPrice ?? String(extractShippingCost(cjData, cjPrice)));
    const totalCost = incomingTotalCost ?? cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);
    const stock = incomingStock ?? extractCJStock(cjData);
    const cjWeight = parseFloat(cjData.packingWeight || cjData.productWeight || '0') || undefined;

    const finalTitle = (titleEs && String(titleEs).trim()) || translateToChileanSpanish(productNameEn);
    const finalDescription = (editedDescription !== undefined && String(editedDescription).trim()) || description;

    const shouldApplyMargin = applyMargin !== false;
    const marginMultiplier = incomingMargin ?? MARGIN_MULTIPLIER;

    // Obtener dólar del día desde mindicador.cl
    const dollarRate = await getDollarRate();

    // Costo Total USD = Precio + Envío
    const costTotalUSD = totalCost;

    // Costo Total CLP = Costo Total USD * dolar
    const costTotalCLP = costTotalUSD * dollarRate;

    // Precio Final CLP = Costo Total USD * margen * dolar
    const precioFinalUSD = shouldApplyMargin ? costTotalUSD * marginMultiplier : costTotalUSD;
    const precioFinalCLP = roundToTen(precioFinalUSD * dollarRate);

    // finalPrice es el precio de venta en CLP
    const finalPrice =
      incomingFinalPriceCLP ??
      incomingFinalPrice ??
      (price !== undefined && price !== null && String(price).trim() !== '' ? Number(price) : precioFinalCLP);

    const autoSlug = autoCategory(cjData);
    const finalCollectionSlug = collectionSlug?.trim() || detectCollection(finalTitle, finalDescription);

    const category = await resolveCategory(autoSlug);
    const collection = await prisma.collection.findUnique({ where: { slug: finalCollectionSlug } });
    const collectionId = collection?.id ?? (await prisma.collection.create({
      data: {
        name: finalCollectionSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        slug: finalCollectionSlug,
      },
    })).id;

    const slug = `${finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`.slice(0, 100);

    // Evitar duplicados si el producto CJ ya fue importado
    const existingCj = await prisma.product.findFirst({ where: { cjProductId: String(pid) } });
    if (existingCj) {
      res.status(409).json({ message: 'Este producto CJ ya fue importado', productId: existingCj.id });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: finalTitle,
        slug,
        description: finalDescription,
        images: cjImages,
        tags: [finalCollectionSlug],
        categoryId: category.id,
        salePrice: finalPrice,
        margin: parseFloat(((finalPrice - costTotalCLP) / finalPrice * 100).toFixed(2)),
        totalCost: totalCost,
        productCost: cjPrice,
        shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
        stock,
        weight: cjWeight,
        status: 'PUBLISHED',
        importSource: 'CJ_DROPSHIPPING',
        cjProductId: String(pid),
        cjVariants: variants,
        variants: [],
        collectionId,
        // FASE 4A: trazabilidad de fuente (link pegado, plataforma, ID y costo USD)
        sourceUrl: url,
        sourcePlatform: 'CJ',
        sourceId: String(pid),
        costUsd: Number(totalCost) || null,
        lastCheckedAt: new Date(),
        productImages: {
          create: cjImages.map((url, i) => ({ url, position: i })),
        },
        productVariants: {
          create: variants.map((v: any, i: number) => mapCJVariant(v, cjPrice)),
        },
      },
      include: { productImages: true, productVariants: true, collection: true },
    });

    res.status(201).json({ message: 'Product imported successfully', product });
  } catch (error: any) {
    console.error('Error importing CJ product:', error);
    res.status(500).json({ message: 'Error importing product', error: error.message });
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
      resolved = await resolveCJProductFromUrl(url);
    } catch (err: any) {
      console.error('[CJ preview] error CJ api:', err?.response?.status, err?.response?.data ?? err?.message);
      res.status(502).json({ message: 'CJ respondió con error. Revisa tu API key o intenta de nuevo.', error: err?.message });
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
    const cjPrice = parseFloat(cjData.price || cjData.sellPrice || '0');
    const shippingCost = extractShippingCost(cjData, cjPrice);
    const totalCost = cjPrice + (Number.isFinite(shippingCost) ? shippingCost : 0);
    const stock = extractCJStock(cjData);
    const titleEs = translateToChileanSpanish(productNameEn);
    const collectionSlug = detectCollection(titleEs, description);

    // Obtener dólar del día desde mindicador.cl
    const dollarRate = await getDollarRate();

    const costTotalUSD = totalCost;
    const costTotalCLP = costTotalUSD * dollarRate;
    const suggestedPriceUSD = costTotalUSD * MARGIN_MULTIPLIER;
    const suggestedPriceCLP = roundToTen(suggestedPriceUSD * dollarRate);

    const collections = await prisma.collection.findMany({ orderBy: { name: 'asc' } });

    res.json({
      pid,
      titleEs,
      description,
      productImage,
      productImages,
      variants: variants.map((v: any) => ({
        ...v,
        sellPrice: parseFloat(v.variantSellPrice || v.price || String(cjPrice)),
      })),
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
      autoCategory: autoCategory(cjData),
      collections,
      dollarRate,
      costTotalCLP,
    });
  } catch (error: any) {
    console.error('Error previewing CJ product:', error);
    res.status(500).json({ message: 'Error previewing product', error: error.message });
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
