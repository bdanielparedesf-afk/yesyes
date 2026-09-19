// Regla comercial definitiva YesYes: costo proveedor vs envío al cliente.
// CASOS A-D, márgenes 50/100/200/400, respaldo comercial US$10 sin margen,
// sin doble cobro, con caché válida y con el producto real 1005011692664194.
// Todo es offline: el proveedor se inyecta y la DB no se toca.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const pricing = require('../src/aliexpress/yesyes-pricing.ts');
const service = require('../src/services/aliexpress-dropship.service.ts');

const REAL_URL = 'https://es.aliexpress.com/item/1005011692664194.html';
const REAL_SKU = '12000056260814029';
const realProduct = {
  ae_item_base_info_dto: { product_id: '1005011692664194', subject: 'Producto real', currency_code: 'USD' },
  ae_item_sku_info_dtos: [
    { sku_id: REAL_SKU, sku_attr: '', sku_price: '18.03', sku_available_stock: 10 },
  ],
};
const depsWith = (freightQuery, buyerFreightCalculate) => ({
  productGet: async () => realProduct,
  fx: async () => ({ value: 900, source: 'fixture' }),
  findDuplicate: async () => null,
  freightQuery, buyerFreightCalculate,
});
const previewReal = (marginPercent, deps) => service.previewAliExpressProduct(
  REAL_URL, { marginPercent, selectedSkuId: REAL_SKU }, deps);

// ─────────────────────────────────────────────────────────────────────────────
// CASOS A-D (motor de precios puro: computeYesYesPrice)
// ─────────────────────────────────────────────────────────────────────────────

test('CASO A: envío AliExpress US$0 → costo proveedor 18.03, producto 27.045, envío cliente US$5, total 32.045', () => {
  const price = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: 0, marginPercent: 50,
  });
  assert.equal(price.supplierProductCostUsdCents, 1803);
  assert.equal(price.supplierShippingCostUsdCents, 0);
  assert.equal(price.supplierAcquisitionCostUsdCents, 1803);
  assert.equal(price.marginBaseUsdCents, 1803);
  assert.equal(price.productSalePriceUsd, 27.045);
  assert.equal(price.customerShippingUsdCents, 500);
  assert.equal(price.customerTotalUsd, 32.045);
  assert.equal(price.shippingState, 'SHIPPING_CONFIRMED_FREE');
  pricing.assertCustomerTotal(price);
});

test('CASO B: envío AliExpress US$2.99 → costo proveedor 21.02, producto 31.53, envío cliente 2.99, total 34.52', () => {
  const price = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: 299, marginPercent: 50,
  });
  assert.equal(price.supplierProductCostUsdCents, 1803);
  assert.equal(price.supplierShippingCostUsdCents, 299);
  assert.equal(price.supplierAcquisitionCostUsdCents, 2102);
  assert.equal(price.marginBaseUsdCents, 2102);
  assert.equal(price.productSalePriceUsd, 31.53);
  assert.equal(price.customerShippingUsdCents, 299);
  assert.equal(price.customerTotalUsd, 34.52);
  assert.equal(price.shippingState, 'SHIPPING_CONFIRMED');
  pricing.assertCustomerTotal(price);
});

test('CASO C: envío AliExpress desconocido → producto 27.045, envío cliente US$10, total 37.045 y sin adquisición', () => {
  const price = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: null, marginPercent: 50,
  });
  assert.equal(price.supplierProductCostUsdCents, 1803);
  assert.equal(price.supplierShippingCostUsdCents, null);
  assert.equal(price.supplierAcquisitionCostUsdCents, null);
  assert.equal(price.marginBaseUsdCents, 1803); // nunca 1803 + 1000
  assert.equal(price.productSalePriceUsd, 27.045); // 18.03 × 1.5, sin US$10
  assert.equal(price.customerShippingUsdCents, 1000); // US$10 al cliente
  assert.equal(price.customerTotalUsd, 37.045); // 27.045 + 10, el US$10 no se multiplica
  assert.equal(price.shippingState, 'SHIPPING_COMMERCIAL_FALLBACK');
  pricing.assertCustomerTotal(price);
});

test('CASO D: API AliExpress con error → estado SHIPPING_ERROR, envío cliente US$10 y US$10 fuera del costo', async () => {
  service.clearFreightCache();
  const preview = await previewReal(50, depsWith(
    async () => { throw new Error('freight down'); },
    async () => { throw new Error('buyer freight down'); }));
  assert.equal(preview.shippingStatus, 'SHIPPING_ERROR');
  assert.equal(preview.yesYesShippingState, 'SHIPPING_ERROR');
  assert.equal(preview.shippingSource, 'COMMERCIAL');
  assert.equal(preview.supplierProductCostUsdCents, 1803);
  assert.equal(preview.supplierShippingCostUsdCents, null);
  assert.equal(preview.supplierAcquisitionCostUsdCents, null);
  assert.equal(preview.shippingUsdCents, null); // jamás "Envío AliExpress: US$10"

// ── Caso real 1005011692664194 / 12000056260814029 ────────────────────────────
test('caso real 1005011692664194: 18.03 + 2.99 → 21.02 × 1.5 = 31.53, envío 2.99, total 34.52 (sin US$10)', async () => {
  service.clearFreightCache();
  const preview = await previewReal(50, depsWith(
    async () => ({ delivery_options: [{ shipping_fee_cent: '2.99', shipping_fee_currency: 'USD' }] }),
    undefined));
  assert.equal(preview.aliexpressId, '1005011692664194');
  assert.equal(preview.selectedSkuId, REAL_SKU);
  assert.equal(preview.supplierProductCostUsdCents, 1803);
  assert.equal(preview.supplierShippingCostUsdCents, 299);
  assert.equal(preview.supplierAcquisitionCostUsdCents, 2102);
  assert.equal(preview.productSalePriceUsd, 31.53);
  assert.equal(preview.customerShippingUsdCents, 299);
  assert.equal(preview.customerTotalUsd, 34.52);
  assert.equal(preview.shippingUsdCents, 299);
  assert.equal(preview.shippingStatus, 'SHIPPING_CONFIRMED');
  assert.equal(preview.yesYesShippingState, 'SHIPPING_CONFIRMED');
  assert.equal(preview.shippingSource, 'ALIEXPRESS');
  assert.equal(preview.totalUsdCents, 2102);
  assert.equal(preview.salePriceClp, Math.round(31.53 * 900));
  // El respaldo comercial US$10 no debe aparecer en el caso real.
  assert.notEqual(preview.customerShippingUsdCents, 1000);
});

test('envío gratis confirmado por preview: costo proveedor 18.03, producto 27.045, envío cliente US$5', async () => {
  service.clearFreightCache();
  const preview = await previewReal(50, depsWith(
    async () => ({ delivery_options: [{ free_shipping: 'true', shipping_fee_cent: '0' }] }),
    undefined));
  assert.equal(preview.supplierAcquisitionCostUsdCents, 1803);
  assert.equal(preview.productSalePriceUsd, 27.045);
  assert.equal(preview.customerShippingUsdCents, 500);
  assert.equal(preview.customerTotalUsd, 32.045);
  assert.equal(preview.shippingStatus, 'SHIPPING_CONFIRMED_FREE');
  assert.equal(preview.shippingUsdCents, 0);
  assert.equal(preview.totalUsdCents, 1803);
});

test('envío desconocido por preview (ambas APIs vacías): US$10 al cliente, estado SHIPPING_COMMERCIAL_FALLBACK', async () => {
  service.clearFreightCache();
  const preview = await previewReal(50, depsWith(
    async () => ({}),
    async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [] })));
  assert.equal(preview.shippingSource, 'COMMERCIAL');
  assert.equal(preview.shippingStatus, 'SHIPPING_COMMERCIAL_FALLBACK');
  assert.equal(preview.yesYesShippingState, 'SHIPPING_COMMERCIAL_FALLBACK');
  assert.equal(preview.supplierShippingCostUsdCents, null);
  assert.equal(preview.shippingUsdCents, null);
  assert.equal(preview.productSalePriceUsd, 27.045);
  assert.equal(preview.customerShippingUsdCents, 1000);
  assert.equal(preview.customerTotalUsd, 37.045);
});

test('caché válida: reutiliza una cotización real de AliExpress (con margen), no el US$10', async () => {
  service.clearFreightCache();
  service.rememberFreightQuote('1005011692664194', REAL_SKU, 299);
  const preview = await previewReal(50, depsWith(async () => ({}),
    async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [] })));
  assert.equal(preview.shippingStatus, 'SHIPPING_CACHED');
  assert.equal(preview.yesYesShippingState, 'SHIPPING_CACHED');
  assert.equal(preview.shippingSource, 'ALIEXPRESS');
  assert.equal(preview.supplierShippingCostUsdCents, 299);
  assert.equal(preview.supplierAcquisitionCostUsdCents, 2102);
  assert.equal(preview.productSalePriceUsd, 31.53);
  assert.equal(preview.customerShippingUsdCents, 299);
  assert.equal(preview.customerTotalUsd, 34.52);
  assert.equal(preview.totalUsdCents, 2102);
  service.clearFreightCache();
});

  assert.equal(preview.productSalePriceUsd, 27.045);
  assert.equal(preview.customerShippingUsdCents, 1000);
  assert.equal(preview.customerTotalUsd, 37.045);
  assert.equal(preview.totalUsdCents, null); // el US$10 no es costo proveedor
});
// ─────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Márgenes e invariantes
// ────────────────────────────────────────────────────────────────────────────

test('márgenes 50/100/200/400 sobre costo proveedor real 21.02 (envío real incluido)', () => {
  const expected = { 50: 31.53, 100: 42.04, 200: 63.06, 400: 105.1 };
  for (const [margin, sale] of Object.entries(expected)) {
    const price = pricing.computeYesYesPrice({
      supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: 299,
      marginPercent: Number(margin),
    });
    assert.equal(price.marginBaseUsdCents, 2102, `margen ${margin}`);
    assert.equal(price.productSalePriceUsd, sale, `margen ${margin}`);
    assert.equal(price.customerShippingUsdCents, 299, `margen ${margin}`);
    // customerTotal = productSalePrice + customerShipping (el envío real se
    // cobra aparte y también forma parte del costo proveedor, sin duplicarse).
    assert.equal(pricing.roundUsd2(price.customerTotalUsd), pricing.roundUsd2(sale + 2.99));
    pricing.assertCustomerTotal(price);
  }
});

test('márgenes 50/100/200/400 en el respaldo comercial: el US$10 nunca recibe margen', () => {
  for (const margin of [50, 100, 200, 400]) {
    const price = pricing.computeYesYesPrice({
      supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: null, marginPercent: margin,
    });
    const factor = 1 + margin / 100;
    assert.equal(price.marginBaseUsdCents, 1803, `base margen ${margin}`);
    assert.equal(price.productSalePriceUsd, (1803 * factor) / 100, `producto ${margin}`);
    // Si el US$10 llevara margen y se sumara al costo, el producto sería (1803+1000)×factor.
    assert.notEqual(price.productSalePriceUsd, ((1803 + 1000) * factor) / 100, `US$10 sin margen (${margin})`);
    assert.equal(price.supplierAcquisitionCostUsdCents, null, `sin adquisición ${margin}`);
    assert.equal(price.customerShippingUsdCents, 1000, `envío cliente ${margin}`);
    // El US$10 se cobra una sola vez: total = producto + 10.
    assert.equal(pricing.roundUsd2(price.customerTotalUsd), pricing.roundUsd2(price.productSalePriceUsd + 10));
    pricing.assertCustomerTotal(price);
  }
});

test('precisión y redondeo: el envío real no se pierde ni se duplica (21.02 × 1.5 = 31.53)', () => {
  const price = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: 299, marginPercent: 50,
  });
  assert.equal(pricing.roundUsd2(price.productSalePriceUsd), 31.53);
  assert.equal(pricing.roundUsd2(price.customerShippingUsdCents / 100), 2.99);
  assert.equal(pricing.roundUsd2(price.customerTotalUsd), 34.52);
  assert.equal(price.customerTotalUsd, 34.52); // 31.53 + 2.99 exacto
  // Free/desconocido: la precisión exacta se mantiene y solo se redondea al mostrar.
  const free = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: 0, marginPercent: 50,
  });
  assert.equal(free.productSalePriceUsd, 27.045);
  assert.equal(pricing.roundUsd2(free.productSalePriceUsd), 27.05);
  assert.equal(pricing.roundUsd2(free.customerTotalUsd), 32.05);
  const fallback = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: null, marginPercent: 50,
  });
  assert.equal(fallback.productSalePriceUsd, 27.045);
  assert.equal(pricing.roundUsd2(fallback.customerTotalUsd), 37.05);
});

test('costo proveedor y cargo al cliente son campos distintos y nunca se mezclan', () => {
  const price = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: 299, marginPercent: 100,
  });
  assert.equal(price.supplierProductCostUsdCents, 1803);      // producto AliExpress
  assert.equal(price.supplierShippingCostUsdCents, 299);      // envío AliExpress confirmado
  assert.equal(price.supplierAcquisitionCostUsdCents, 2102);  // producto + envío
  assert.equal(price.customerShippingUsdCents, 299);          // lo que paga el cliente
  assert.equal(price.productSalePriceUsd, 42.04);             // precio producto con margen
  assert.equal(price.customerTotalUsd, 45.03);                // precio producto + envío cliente
  assert.equal(price.supplierAcquisitionCostUsdCents,
    price.supplierProductCostUsdCents + price.supplierShippingCostUsdCents);
  // customerTotal = productSalePrice + customerShipping siempre, incluso con drift float.
  assert.equal(pricing.roundUsd2(price.customerTotalUsd),
    pricing.roundUsd2(price.productSalePriceUsd + price.customerShippingUsdCents / 100));
});

test('el US$10 de fallback no se suma dos veces ni entra al costo proveedor (CASO C/D)', () => {
  // Fallback: el US$10 NUNCA forma parte de marginBase ni de acquisition.
  const fb = pricing.computeYesYesPrice({
    supplierProductCostUsdCents: 1803, supplierShippingCostUsdCents: null, marginPercent: 50,
  });
  assert.equal(fb.marginBaseUsdCents, 1803);                     // sin US$10
  assert.equal(fb.supplierAcquisitionCostUsdCents, null);        // sin US$10
  assert.equal(fb.productSalePriceUsd, 27.045);                 // 18.03 × 1.5
  assert.equal(fb.customerShippingUsdCents, 1000);              // US$10 cargo único
  assert.equal(fb.customerTotalUsd, 37.045);                    // 27.045 + 10 (un cargo)
  assert.notEqual(fb.productSalePriceUsd, (1803 + 1000) * 1.5 / 100); // no se multiplicó el US$10
  pricing.assertCustomerTotal(fb);
});
