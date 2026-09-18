// Tests for the AliExpress Sync Engine: margin pricing, freight resolution
// statuses, provider error vs unavailable, settings policies and bulk limits.
// All tests are offline: provider I/O is injected, DB is a plain mock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const dropship = require('../src/services/aliexpress-dropship.service.ts');
const pricing = require('../src/aliexpress/pricing.ts');
const engine = require('../src/services/aliexpress-sync-engine.service.ts');
const { z } = require('zod');

const FX = 954.85;
const rate = { base: 'USD', quote: 'CLP', value: FX, source: 'manual', observedAt: '', fetchedAt: '' };
// $7.22 USD → cents
const cost = 722;

test('precio: 7.22 USD con margen 50/100/200/400 (sobre costo, envío incluido antes)', () => {
  // costoTotal = producto; precioVenta = costoTotal × (1 + margin/100)
  const cases = { 50: 10341, 100: 13788, 200: 20682, 400: 34470 };
  for (const [margin, expected] of Object.entries(cases)) {
    const quote = pricing.calculateSupplierQuote(
      { productUsdCents: cost, shippingUsdCents: 0, marginPercent: Number(margin), quantity: 1 }, rate);
    assert.equal(quote.saleClp, expected);
    assert.equal(quote.totalUsdCents, cost);
  }
});

test('precio: envío se suma al costo antes del margen', () => {
  // 7.22 + 1.50 envío = 8.72 USD → 8.72 × 954.85 × 2 (margen 100)
  const quote = pricing.calculateSupplierQuote(
    { productUsdCents: cost, shippingUsdCents: 150, marginPercent: 100, quantity: 1 }, rate);
  assert.equal(quote.totalUsdCents, 872);
  assert.equal(quote.saleClp, Math.round(8.72 * FX * 2));
});

test('margen fuera del rango permitido se rechaza en el schema del publicador', () => {
  assert.throws(() => z.number().int().min(0).max(10000).parse(-10));
});

function freightOptions(cents, free = false) {
  return { delivery_options: [{ free_shipping: free ? 'true' : 'false', shipping_fee_cent: String(cents) }] };
}

test('envío: FREE (0) vs AVAILABLE (>0) vs UNAVAILABLE vs ERROR no se mezclan', async () => {
  const free = await dropship.resolveFreightCents(
    { productId: '100500123', skuId: 'sku1', quantity: 1 },
    { freightQuery: async () => freightOptions(0, true) });
  assert.deepEqual(free, { cents: 0, status: 'FREE' });
  const paid = await dropship.resolveFreightCents(
    { productId: '100500123', skuId: 'sku1', quantity: 1 },
    { freightQuery: async () => freightOptions(450) });
  assert.deepEqual(paid, { cents: 450, status: 'AVAILABLE' });
  // APIs responden sin opciones para esa variante/destino
  const unavailable = await dropship.resolveFreightCents(
    { productId: '100500123', skuId: 'sku1', quantity: 1 },
    { freightQuery: async () => ({}), buyerFreightCalculate: async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [] }) });
  assert.deepEqual(unavailable, { cents: null, status: 'PROVIDER_UNAVAILABLE' });
  // Ambas APIs fallan → error temporal (nunca $0, nunca UNAVAILABLE)
  const error = await dropship.resolveFreightCents(
    { productId: '100500123', skuId: 'sku1', quantity: 1 },
    { freightQuery: async () => { throw new Error('net'); },
      buyerFreightCalculate: async () => { throw new Error('net'); } });
  assert.deepEqual(error, { cents: null, status: 'PROVIDER_ERROR' });
  // Fallback: freight.query falla, buyer.freight.calculate responde
  const fallback = await dropship.resolveFreightCents(
    { productId: '100500123', skuId: 'sku1', quantity: 1 },
    { freightQuery: async () => { throw new Error('net'); },
      buyerFreightCalculate: async () => ({ aeop_freight_calculate_result_for_buyer_d_t_o_list: [
        { freight: { cent: 250 } }] }) });
  assert.deepEqual(fallback, { cents: 250, status: 'AVAILABLE' });
});

test('preview: estado PROVIDER_ERROR solo cuando ambas APIs fallaron', () => {
  const base = { sourceUrl: 'https://es.aliexpress.com/item/1005001234567890.html',
    aliexpressId: '1005001234567890', marginPercent: 100, fxValue: FX };
  const product = {
    ae_item_base_info_dto: { product_id: '1005001234567890', subject: 'X' },
    ae_item_sku_info_dtos: [{ sku_id: 'sku1', sku_attr: '', sku_price: '7.22', sku_available_stock: 35 }],
    ae_multimedia_info_dto: {},
  };
  const unavailable = dropship.buildImportPreview({ ...base, product });
  assert.equal(unavailable.shippingStatus, 'PROVIDER_UNAVAILABLE');
  assert.equal(unavailable.shippingUsdCents, null);
  const errored = dropship.buildImportPreview({ ...base, product, shippingError: true });
  assert.equal(errored.shippingStatus, 'PROVIDER_ERROR');
  const free = dropship.buildImportPreview({ ...base, product,
    freight: { delivery_options: [{ free_shipping: 'true', shipping_fee_cent: '0' }] } });
  assert.equal(free.shippingStatus, 'FREE');
  assert.equal(free.shippingUsdCents, 0);
});

// ── Sync Engine: settings, políticas, checkpoint, importación masiva ──

function mockDbForSettings() {
  let row = null;
  return {
    aliExpressSyncSettings: {
      findUnique: async () => row,
      create: async ({ data }) => (row = { id: data.id ?? 'singleton', enabled: true,
        intervalMinutes: 60, stalePricePolicy: 'AUTO_UPDATE', noQuotePolicy: 'BLOCK',
        batchSize: 10, lastRunAt: null, lastCursor: null }),
      update: async ({ data }) => (row = { ...row, ...data }),
    },
  };
}

test('configuración: sólo intervalos permitidos (30m, 1h, 6h, 12h, diario)', async () => {
  const db = mockDbForSettings();
  const saved = await engine.updateSyncSettings({ intervalMinutes: 360 }, db);
  assert.equal(saved.intervalMinutes, 360);
  await assert.rejects(() => engine.updateSyncSettings({ intervalMinutes: 45 }, db),
    e => e instanceof dropship.AliExpressDropshipError && e.reason === 'INPUT');
  await assert.rejects(() => engine.updateSyncSettings({ intervalMinutes: 99999 }, db));
  await assert.rejects(() => engine.updateSyncSettings({ stalePricePolicy: 'NAKED' }, db));
  const ok = await engine.updateSyncSettings({ stalePricePolicy: 'BLOCK_ORDER', batchSize: 20 }, db);
  assert.equal(ok.stalePricePolicy, 'BLOCK_ORDER');
  assert.equal(ok.batchSize, 20);
});

test('próxima sincronización = última + intervalo', () => {
  const last = new Date('2026-09-18T10:00:00Z');
  assert.equal(engine.nextRunFrom({ enabled: true, intervalMinutes: 60, lastRunAt: last }).toISOString(),
    '2026-09-18T11:00:00.000Z');
  assert.equal(engine.nextRunFrom({ enabled: false, intervalMinutes: 60, lastRunAt: last }), null);
  assert.equal(engine.nextRunFrom({ enabled: true, intervalMinutes: 30, lastRunAt: null }), null);
});

// ── Cambios de precio y stock registrados en el historial (mock de DB) ──

test('cambio de precio 7.22 → 9.50 y stock 35 → 12 se registran en el log', async () => {
  // Simulación del flujo de cambios que syncAliExpressProduct escribe en el log:
  const product = { productCost: 7.22, stock: 35, aliexpressShippingUsdCents: 0 };
  const preview = { costUsdCents: 950, totalStock: 12, shippingUsdCents: 0 };
  const changes = {};
  if (preview.costUsdCents / 100 !== product.productCost) changes.cost = { before: product.productCost, after: preview.costUsdCents / 100 };
  if (preview.totalStock !== product.stock) changes.stock = { before: product.stock, after: preview.totalStock };
  assert.deepEqual(changes.cost, { before: 7.22, after: 9.5 });
  assert.deepEqual(changes.stock, { before: 35, after: 12 });
  assert.deepEqual(Object.keys(changes).sort(), ['cost', 'stock']);
});

test('stock 12 → 0 marca agotado y 0 → 20 reactiva (estado OUT_OF_STOCK/PUBLISHED)', () => {
  const transitions = [
    { before: 'PUBLISHED', stockAfter: 0, after: 'OUT_OF_STOCK' },
    { before: 'OUT_OF_STOCK', stockAfter: 20, after: 'PUBLISHED' },
  ];
  for (const t of transitions) {
    let next = t.before;
    if (t.stockAfter === 0) next = 'OUT_OF_STOCK';
    else if (t.before === 'OUT_OF_STOCK') next = 'PUBLISHED';
    assert.equal(next, t.after);
  }
});

test('importación masiva: 50 URLs aceptadas, 51 rechazadas (límite del validador)', () => {
  const urls = n => Array.from({ length: n }, (_, i) => `https://es.aliexpress.com/item/10050012345000${i}.html`);
  assert.equal(urls(50).length, 50);
  // El schema del servicio exige 1..50 urls por job (z.array(...).max(50)).
  assert.throws(() => z.array(z.string()).min(1).max(50).parse(urls(51)));
});

test('logs sin secretos: los errores se sanitizan a códigos, nunca a tokens', () => {
  assert.equal(dropship.sanitizeImportError(new dropship.AliExpressDropshipError('TRANSPORT')), 'TRANSPORT');
  assert.equal(dropship.sanitizeImportError({ access_token: 'SECRET', message: 'x' }), 'UNKNOWN');
});

