/**
 * YesYes commercial pricing rule (definitive).
 *
 * - If AliExpress confirms shipping (including $0):
 *     supplierAcquisition = product + confirmed shipping
 *     margin applies to supplierAcquisition
 *     customerShipping = $0 -> US$5 (commercial rule) | >$0 -> same real shipping
 * - If shipping unknown / API error / no cache (COMMERCIAL fallback):
 *     customerShipping = US$10
 *     US$10 NEVER enters the margin base, NEVER becomes supplier cost,
 *     NEVER multiplied, NEVER double-counted.
 *
 * All supplier costs are integer cents. Product sale / customer total in USD
 * may be fractional cents (e.g. 1803 * 1.5 = 2704.5) — rounding applies
 * ONLY for display, never before `customerTotal = productSalePrice + customerShipping`.
 */
export const COMMERCIAL_FALLBACK_SHIPPING_USD_CENTS = 1000;
export const FREE_SHIPPING_CUSTOMER_CHARGE_USD_CENTS = 500;

export type YesYesShippingState =
  | 'SHIPPING_CONFIRMED_FREE'
  | 'SHIPPING_CONFIRMED'
  | 'SHIPPING_UNKNOWN'
  | 'SHIPPING_ERROR'
  | 'SHIPPING_COMMERCIAL_FALLBACK'
  | 'SHIPPING_CACHED';

export interface YesYesPriceInput {
  supplierProductCostUsdCents: number;
  /** Confirmed AliExpress shipping (integer cents). Null = unknown/error. */
  supplierShippingCostUsdCents: number | null;
  marginPercent: number;
}

export interface YesYesPrice {
  supplierProductCostUsdCents: number;
  supplierShippingCostUsdCents: number | null;
  /** product + confirmed shipping. Null when shipping unknown (fallback never becomes acquisition). */
  supplierAcquisitionCostUsdCents: number | null;
  /** Base over which the margin is applied (integer cents, never includes US$10). */
  marginBaseUsdCents: number;
  /** Exact USD (may carry fractional cents, e.g. 27.045). */
  productSalePriceUsd: number;
  customerShippingUsdCents: number;
  /** Exact USD (productSalePriceUsd + customerShipping). */
  customerTotalUsd: number;
  shippingState: YesYesShippingState;
}

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} inválido.`);
}

export function computeYesYesPrice(input: YesYesPriceInput): YesYesPrice {
  assertCents(input.supplierProductCostUsdCents, 'Costo producto');
  if (input.supplierShippingCostUsdCents !== null) assertCents(input.supplierShippingCostUsdCents, 'Envío proveedor');
  if (!Number.isFinite(input.marginPercent) || input.marginPercent < 0 || input.marginPercent > 10000) {
    throw new Error('Margen inválido.');
  }
  const factor = 1 + input.marginPercent / 100;
  // Exact order: (integer cents × factor) / 100. Applying the factor to cents
  // first keeps the margin base intact and avoids premature decimal rounding:
  // 2102 × 1.5 = 3153 cents → USD 31.53; 1803 × 1.5 = 2704.5 → USD 27.045.
  const saleUsdFromCents = (cents: number): number => (cents * factor) / 100;
  if (input.supplierShippingCostUsdCents !== null) {
    const acquisition = input.supplierProductCostUsdCents + input.supplierShippingCostUsdCents;
    if (!Number.isSafeInteger(acquisition)) throw new Error('Costo fuera de rango.');
    const productSalePriceUsd = saleUsdFromCents(acquisition);
    // Envío confirmado $0 → cargo comercial al cliente US$5. Envío >$0 → el mismo
    // envío real como línea separada (no es doble cobro: ya está dentro del costo
    // proveedor sobre el que se aplicó el margen).
        const freeShipping = input.supplierShippingCostUsdCents === 0;
    const customerShippingUsdCents = freeShipping
      ? FREE_SHIPPING_CUSTOMER_CHARGE_USD_CENTS
      : input.supplierShippingCostUsdCents;
    // customerTotal computed in cents to avoid binary-float drift (e.g.
    // 14.44 + 5.00 must equal exactly 19.44). Mathematically identical to
    // productSalePriceUsd + customerShippingUsdCents/100, but numerically stable.
    const totalCentsExact = acquisition * factor + customerShippingUsdCents;
    return {
      supplierProductCostUsdCents: input.supplierProductCostUsdCents,
      supplierShippingCostUsdCents: input.supplierShippingCostUsdCents,
      supplierAcquisitionCostUsdCents: acquisition,
      marginBaseUsdCents: acquisition,
      productSalePriceUsd,
      customerShippingUsdCents,
      customerTotalUsd: totalCentsExact / 100,
      shippingState: freeShipping ? 'SHIPPING_CONFIRMED_FREE' : 'SHIPPING_CONFIRMED',
    };
  }
  // Fallback comercial US$10: fuera de la base del margen (nunca se multiplica,
  // nunca se suma al costo proveedor y se cobra una sola vez al cliente).
  const productSalePriceUsd = saleUsdFromCents(input.supplierProductCostUsdCents);
  const customerShippingUsdCents = COMMERCIAL_FALLBACK_SHIPPING_USD_CENTS;
  // Total en cents: el US$10 no recibe margen ni se multiplica (nunca entra en
  // marginBaseUsdCents). Evita drift float: 18.03×1.5 + 10 = 37.045 exacto.
  const totalCentsExactFallback = input.supplierProductCostUsdCents * factor + customerShippingUsdCents;
  return {
    supplierProductCostUsdCents: input.supplierProductCostUsdCents,
    supplierShippingCostUsdCents: null,
    supplierAcquisitionCostUsdCents: null,
    marginBaseUsdCents: input.supplierProductCostUsdCents,
    productSalePriceUsd,
    customerShippingUsdCents,
    customerTotalUsd: totalCentsExactFallback / 100,
    shippingState: 'SHIPPING_COMMERCIAL_FALLBACK',
  };
}

/** Display rounding to 2 decimals (USD). Internal math keeps full precision. */
export function roundUsd2(valueUsd: number): number {
  return Math.round(valueUsd * 100) / 100;
}

/** Exact invariant: customerTotal = productSalePrice + customerShipping. */
export function assertCustomerTotal(price: YesYesPrice): void {
  const expected = price.productSalePriceUsd + price.customerShippingUsdCents / 100;
  if (Math.abs(expected - price.customerTotalUsd) > 1e-9) throw new Error('Total cliente inconsistente.');
}
