import { prisma } from '../lib/prisma';
export interface CheckoutLine {
  productId: string;
  variantId: string | null;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku: string | null;
  stock: number;
}

export const FREE_SHIPPING_THRESHOLD = 50_000;
const SHIPPING_COST = 4_990;

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

function roundClp(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function resolveRequestedProductId(value: unknown): string {
  const raw = String(value || '').trim();
  const separator = raw.indexOf('::');
  return separator >= 0 ? raw.slice(0, separator) : raw;
}

function requestedVariantId(value: unknown): string | null {
  const raw = String(value || '').trim();
  const separator = raw.indexOf('::');
  return separator >= 0 && raw.slice(separator + 2) ? raw.slice(separator + 2) : null;
}

export interface CheckoutRequestLine {
  id?: unknown;
  productId?: unknown;
  variantId?: unknown;
  quantity?: unknown;
}

function productImage(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first.trim().slice(0, 2_000) : null;
  }
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 2_000) : null;
}

export async function resolveTrustedCheckout(rawItems: unknown): Promise<{
  lines: CheckoutLine[];
  subtotal: number;
  shipping: number;
  total: number;
}> {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    const error: any = new Error('El carrito debe contener entre 1 y 50 productos.');
    error.status = 400;
    throw error;
  }

  const requested = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const value of rawItems) {
    if (!value || typeof value !== 'object') {
      const error: any = new Error('Carrito inválido.');
      error.status = 400;
      throw error;
    }
    const item = value as CheckoutRequestLine;
    const productId = resolveRequestedProductId(item.productId || item.id);
    const variantId = String(item.variantId || '').trim() || requestedVariantId(item.id);
    const quantity = Number(item.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      const error: any = new Error('Producto o cantidad inválida.');
      error.status = 400;
      throw error;
    }
    const identity = `${productId}::${variantId || ''}`;
    const previous = requested.get(identity);
    requested.set(identity, { productId, variantId: variantId || null, quantity: (previous?.quantity || 0) + quantity });
  }
  for (const item of requested.values()) {
    if (item.quantity > 20) {
      const error: any = new Error('La cantidad máxima por producto es 20.');
      error.status = 400;
      throw error;
    }
  }

  const lines: CheckoutLine[] = [];
  for (const requestedLine of requested.values()) {
    const productId = requestedLine.productId;
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: 'PUBLISHED',
        hidden: false,
        businessId: null,
      },
      select: {
        id: true, name: true, images: true, salePrice: true, stock: true,
        productVariants: { select: { id: true, sku: true, price: true, stock: true, supplierImage: true } },
      },
    });
    if (!product) {
      const error: any = new Error('Uno de los productos ya no está disponible.');
      error.status = 409;
      error.code = 'PRODUCT_UNAVAILABLE';
      throw error;
    }

    const variant = requestedLine.variantId
      ? product.productVariants.find((item) => item.id === requestedLine.variantId)
      : null;
    if (requestedLine.variantId && !variant) {
      const error: any = new Error('La variante seleccionada ya no está disponible.');
      error.status = 409;
      error.code = 'VARIANT_UNAVAILABLE';
      throw error;
    }
    const stock = variant ? variant.stock : product.stock;
    if (stock < requestedLine.quantity) {
      const error: any = new Error(`Stock insuficiente para ${product.name}.`);
      error.status = 409;
      error.code = 'INSUFFICIENT_STOCK';
      throw error;
    }
    const rawPrice = variant ? Number(variant.price) : Number(product.salePrice);
    const unitPrice = roundClp(rawPrice);
    if (!Number.isFinite(rawPrice) || unitPrice <= 0) {
      const error: any = new Error(`El producto ${product.name} no tiene un precio válido.`);
      error.status = 409;
      error.code = 'PRICE_UNAVAILABLE';
      throw error;
    }
    lines.push({
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      image: variant?.supplierImage || productImage(product.images),
      quantity: requestedLine.quantity,
      unitPrice,
      totalPrice: unitPrice * requestedLine.quantity,
      sku: variant?.sku || null,
      stock,
    });
  }

  const subtotal = roundClp(lines.reduce((sum, line) => sum + line.totalPrice, 0));
  const shipping = calculateShipping(subtotal);
  return { lines, subtotal, shipping, total: subtotal + shipping };
}
