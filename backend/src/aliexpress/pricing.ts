import { FxRate } from '../services/fx.service';
export const MARGIN_PRESETS = [50, 100, 150, 200, 250, 300, 350, 400] as const;

/** Internal quote, not an AliExpress freight response. Shipping must be explicit. */
export function calculateSupplierQuote(input: {
  productUsdCents: number; shippingUsdCents: number; marginPercent: number; quantity: number;
}, rate: FxRate) {
  for (const value of [input.productUsdCents, input.shippingUsdCents]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Costo o shipping inválido; no se admite costo desconocido.');
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10000
    || !Number.isFinite(input.marginPercent) || input.marginPercent < 0 || input.marginPercent > 10000
    || rate.base !== 'USD' || rate.quote !== 'CLP' || !Number.isFinite(rate.value) || rate.value <= 0) {
    throw new Error('Cantidad, margen o tasa inválida.');
  }
  // Shipping is the total quote for this quantity, not an assumed per-unit cost.
  const totalUsdCents = input.productUsdCents * input.quantity + input.shippingUsdCents;
  const totalClp = totalUsdCents / 100 * rate.value;
  const saleClp = Math.round(totalClp * (1 + input.marginPercent / 100));
  if (!Number.isSafeInteger(totalUsdCents) || !Number.isSafeInteger(saleClp)) throw new Error('Costo fuera de rango.');
  return { ...input, totalUsdCents, totalClp: Math.round(totalClp), saleClp, fx: { ...rate } };
}
