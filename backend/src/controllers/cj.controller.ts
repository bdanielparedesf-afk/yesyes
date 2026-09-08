import { Request, Response } from 'express';
import { getCJProduct, extractPID, detectCollection, translateToChileanSpanish } from '../lib/cj';
import { prisma } from '../lib/prisma';

// Margen 100% = x2 (si cuesta 1, vendemos a 2)
const MARGIN_MULTIPLIER = 2;

/**
 * Obtiene el tipo de cambio USD -> CLP desde mindicador.cl.
 * Retorna un número; si falla, usa 950 por defecto.
 */
async function getDollarRate(): Promise<number> {
  try {
    const res = await fetch('https://mindicador.cl/api/dolar');
    if (!res.ok) return 950;
    const json = await res.json();
    // mindicador.cl devuelve { resultado: [...], utm: {...}, ...

    // `dolar` suele ser un array de objetos con `valor`
    const dolarEntry = (json.dolar && json.dolar.length)
      ? json.dolar[0]
      : null;
    const raw = dolarEntry ? dolarEntry.valor : null;
    const value = parseFloat(String(raw ?? ''));
    if (Number.isFinite(value) && value > 0) return value;
  } catch (error) {
    console.warn('Error fetching dollar rate from mindicador.cl, using default 950:', error);
  }
  return 950;
}

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

function autoCategory(cjProduct: any): string {
  const title = ((cjProduct.productNameEn || cjProduct.productName || '') + ' ' + (cjProduct.category || '')).toLowerCase();

  if (/water bottle|hot water|guatero/.test(title)) return 'guateros';
  if (/plush|peluche/.test(title)) return 'peluches';
  if (/bottle|taza|termo/.test(title)) return 'hogar';
  if (/necklace|bracelet|earring|ring|pendant|chain|jewelry|jewellery|joyer|pulsera|arete|anillo|dije|collar/.test(title)) return 'joyeria';
  if (/dress|shirt|pants|jeans|jacket|coat|skirt|blouse|hoodie|sweater|top|t-shirt|pantalon|vestido|chaqueta|sueter|falda|blusa/.test(title)) return 'ropa';
  if (/shoes|sneaker|boot|sandal|shoe|zapato|zapatilla|bota|sandalia/.test(title)) return 'calzado';
  if (/watch|clock|reloj/.test(title)) return 'relojes';
  if (/bag|backpack|handbag|mochila|cartera|bolso/.test(title)) return 'bolsos';
  if (/phone case|case for|protector|funda|carcasa/.test(title)) return 'accesorios-telefono';
  if (/headphone|earphone|speaker|bluetooth|audifono|audífono|parlante/.test(title)) return 'electronica';
  if (/mouse|keyboard|monitor|usb|cable|charger|teclado|mouse gamer/.test(title)) return 'computacion';
  if (/makeup|maquillaje|lipstick|foundation|mascara|labial|base de maquillaje/.test(title)) return 'belleza';
  if (/hair|pelu|wig|hair extension|peluca|extensiones/.test(title)) return 'belleza';
  if (/massager|masajeador|facial|skincare|skin care|rostro/.test(title)) return 'belleza';
  if (/gym|fitness|deporte|yoga|correr|running|pesa|dumbbell|ejercicio/.test(title)) return 'deportes';
  if (/toy|juguete|niños|kids|bebe|baby/.test(title)) return 'juguetes';
  if (/pet|dog|cat|perro|gato|mascota/.test(title)) return 'mascotas';
  if (/home|hogar|cocina|luz|lampara|light|despacho|decor|decoracion/.test(title)) return 'hogar';
  if (/gamer|rgb|mouse gamer|teclado mecanico/.test(title)) return 'tech-gamer';

  return 'importados';
}

function extractShippingCost(cjData: any, cjPrice: number): number {
  const raw = cjData.shippingCost ?? cjData.freight ?? cjData.freightPrice ?? cjData.shippingPrice ?? cjData.shipping ?? cjData.totalCost ?? cjData.totalPrice ?? cjData.productTotal ?? 0;
  const value = parseFloat(String(raw));
  if (Number.isFinite(value) && value > 0) return value;
  const total = parseFloat(String(cjData.totalCost ?? cjData.totalPrice ?? cjData.productTotal ?? 0));
  if (Number.isFinite(total) && total > cjPrice) return total - cjPrice;
  return 0;
}

function extractCJStock(cjData: any): number {
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

function parseCJImages(cjData: any): string[] {
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

function mapCJVariant(v: any, cjPrice: number) {
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
async function resolveCategory(slug?: string): Promise<{ id: string; name: string; slug: string }> {
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

    const pid = extractPID(url);
    if (!pid) {
      res.status(400).json({ message: 'Could not extract product ID from URL' });
      return;
    }

    const cjData = await getCJProduct(pid);
    if (!cjData) {
      res.status(404).json({ message: 'Product not found on CJ' });
      return;
    }

    const productNameEn = cjData.productNameEn || cjData.productName || 'Producto CJ';
    const description = cjData.description || '';
    const cjImages = parseCJImages(cjData);
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
      res.status(400).json({ message: 'URL is required' });
      return;
    }

    const pid = extractPID(url);
    if (!pid) {
      res.status(400).json({ message: 'Could not extract product ID from URL' });
      return;
    }

    const cjData = await getCJProduct(pid);
    if (!cjData) {
      res.status(404).json({ message: 'Product not found on CJ' });
      return;
    }

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
