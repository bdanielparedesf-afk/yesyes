// Tests del margen de ganancia del importador masivo AliExpress (50–400%).
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const service = require('../src/services/aliexpress-dropship.service.ts');
const { calculateSupplierQuote, MARGIN_PRESETS } = require('../src/aliexpress/pricing.ts');

const fx = (value = 1) => ({ base: 'USD', quote: 'CLP', value, source: 'manual', observedAt: '', fetchedAt: '' });

// Producto $10.000 + envío $2.000 (CLP, fx=1 con centavos USD = CLP*100).
const CLP = clp => clp * 100; // centavos USD con fx 1

test('margen 50% calcula correctamente sobre costo total (producto + envío)', () => {
  const q = calculateSupplierQuote({ productUsdCents: CLP(10000), shippingUsdCents: CLP(2000), quantity: 1, marginPercent: 50 }, fx());
  assert.equal(q.totalClp, 12000);
  assert.equal(q.saleClp, 18000); // 12000 + 50% = 18000
});

test('margen 100% calcula correctamente (ejemplo del requisito: $24.000)', () => {
  const q = calculateSupplierQuote({ productUsdCents: CLP(10000), shippingUsdCents: CLP(2000), quantity: 1, marginPercent: 100 }, fx());
  assert.equal(q.totalClp, 12000);
  assert.equal(q.saleClp, 24000);
});

test('margen 200% calcula correctamente por producto individual', () => {
  const a = calculateSupplierQuote({ productUsdCents: CLP(5000), shippingUsdCents: CLP(2000), quantity: 1, marginPercent: 200 }, fx());
  assert.equal(a.saleClp, 21000); // 7000 * 3
  const b = calculateSupplierQuote({ productUsdCents: CLP(10000), shippingUsdCents: CLP(3000), quantity: 1, marginPercent: 200 }, fx());
  assert.equal(b.saleClp, 39000);
  const c = calculateSupplierQuote({ productUsdCents: CLP(20000), shippingUsdCents: CLP(5000), quantity: 1, marginPercent: 200 }, fx());
  assert.equal(c.saleClp, 75000);
});

test('margen 400% calcula correctamente', () => {
  const q = calculateSupplierQuote({ productUsdCents: CLP(10000), shippingUsdCents: CLP(2000), quantity: 1, marginPercent: 400 }, fx());
  assert.equal(q.saleClp, 60000);
});

test('todos los presets (50..400) usan costo total con envío', () => {
  assert.deepEqual([...MARGIN_PRESETS], [50, 100, 150, 200, 250, 300, 350, 400]);
  for (const m of MARGIN_PRESETS) {
    const q = calculateSupplierQuote({ productUsdCents: CLP(10000), shippingUsdCents: CLP(2000), quantity: 1, marginPercent: m }, fx());
    assert.equal(q.saleClp, 12000 * (1 + m / 100));
  }
});

test('margen personalizado dentro de 50–400 funciona', () => {
  for (const m of [50, 55, 73, 100, 199, 250, 333, 399, 400]) {
    const q = calculateSupplierQuote({ productUsdCents: CLP(10000), shippingUsdCents: CLP(2000), quantity: 1, marginPercent: m }, fx());
    assert.equal(q.saleClp, Math.round(12000 * (1 + m / 100)));
  }
});

// ── buildImportPreview: recálculo puro y envío individual ────────────────────

const providerProduct = {
  ae_item_base_info_dto: {
    product_id: '1005001234567890', subject: 'Producto', currency_code: 'USD', category_id: '1501',
  },
  ae_item_sku_info_dtos: [{ sku_id: '120000000000000001', sku_attr: '', sku_price: '10000.00', sku_available_stock: 5,
    ae_sku_property_dtos: [{ sku_property_name: 'Color', property_value_definition_name: 'Red' }] }],
  ae_multimedia_info_dto: { image_urls: 'a.jpg' },
};

function previewAt(marginPercent, freightCents) {
  return service.buildImportPreview({
    product: providerProduct,
    freight: freightCents === null ? undefined : { delivery_options: [{ free_shipping: 'false', shipping_fee_cent: String(freightCents) }] },
    sourceUrl: 'https://es.aliexpress.com/item/1005001234567890.html',
    aliexpressId: '1005001234567890', marginPercent, fxValue: 1, quantity: 1,
  });
}

test('cambiar el porcentaje recalcula la vista previa sin volver a consultar AliExpress', () => {
  // buildImportPreview es una función pura: el mismo payload del proveedor se
  // reutiliza para cualquier porcentaje (cero llamadas a AliExpress).
  const sale = m => previewAt(m, CLP(2000)).salePriceClp;
  assert.equal(sale(50), 18000);
  assert.equal(sale(100), 24000);
  assert.equal(sale(200), 36000);
  assert.equal(sale(400), 60000);
});

test('el precio almacenado coincide con el precio mostrado en la vista previa', () => {
  const preview = previewAt(200, CLP(2000));
  // Fórmula compartida: (producto + envío) * (1 + m/100), convertida por FX.
  const expected = Math.round((preview.supplierProductCostUsdCents + preview.supplierShippingCostUsdCents) / 100 * (1 + 200 / 100) * preview.fxRate);
  assert.equal(preview.salePriceClp, expected);
});

test('cada producto conserva su propio costo de envío y su precio individual', () => {
  const conEnvio = previewAt(200, CLP(2000));
  const sinEnvio = previewAt(200, 0);
  const otroEnvio = previewAt(200, CLP(5000));
  assert.equal(conEnvio.supplierShippingCostUsdCents, CLP(2000));
  assert.equal(sinEnvio.supplierShippingCostUsdCents, 0);
  assert.equal(otroEnvio.supplierShippingCostUsdCents, CLP(5000));
  assert.equal(conEnvio.salePriceClp, 36000);
  assert.equal(sinEnvio.salePriceClp, 30000);
  assert.equal(otroEnvio.salePriceClp, 45000); // (10000 + 5000) * 3
});


test('createImportJob: rechaza margen menor a 50%', async () => {
  await assert.rejects(() => service.createImportJob({ urls: ['https://es.aliexpress.com/item/1005001234567890.html'], marginPercent: 49 }, mockDb()));
});

test('createImportJob: rechaza margen mayor a 400%', async () => {
  await assert.rejects(() => service.createImportJob({ urls: ['https://es.aliexpress.com/item/1005001234567890.html'], marginPercent: 401 }, mockDb()));
});

test('createImportJob: acepta 50, 100, 200 y 400 (y personalizados intermedios)', async () => {
  for (const m of [50, 73, 100, 150, 200, 250, 300, 350, 400]) {
    const job = await service.createImportJob({ urls: ['https://es.aliexpress.com/item/1005001234567890.html'], marginPercent: m }, mockDb());
    assert.equal(job.marginPercent, m);
  }
});

function mockDb() {
  return { aliExpressImportJob: { create: async ({ data }) => ({ id: 'job1', total: data.total, marginPercent: data.marginPercent }) } };
}

// ── La carga entera usa el porcentaje del job; el resto no cambia ────────────

const basePreview = overrides => ({
  sourceUrl: 'https://es.aliexpress.com/item/1005001234567890.html',
  aliexpressId: '1005001234567890', name: 'Producto', description: 'd',
  images: ['a.jpg'], variants: [{ supplierVariantId: 'v1', skuAttr: '', attributes: [], image: undefined,
    costUsd: 10, stock: 5, stockKnown: true }],
  stockKnown: true, totalStock: 5,
  costUsdCents: 1000, shippingUsdCents: 0, shippingUnknown: false,
  shippingStatus: 'SHIPPING_CONFIRMED_FREE', shippingSource: 'ALIEXPRESS', shippingMessage: '',
  yesYesShippingState: 'SHIPPING_CONFIRMED_FREE',
  supplierProductCostUsdCents: 1000, supplierShippingCostUsdCents: 0,
  supplierAcquisitionCostUsdCents: 1000, productSalePriceUsd: 30,
  customerShippingUsdCents: 0, customerTotalUsd: 30,
  quantity: 1, selectedSkuId: 'v1', destination: { countryCode: 'CL' },
  acquisition: { productCostUsdCents: 1000, selectedSkuId: 'v1' },
  taxUsdCents: null, otherUsdCents: null, totalUsdCents: null,
  fx: 900, fxRate: 900, fxSource: 'manual', salePriceClp: 27000,
  duplicateOfProductId: null, wholesaleTiers: [], raw: {}, ...overrides,
});

function freshDb() {
  const categories = new Map(); const products = [];
  const job = { id: 'job1', status: 'PENDING', total: 0, processed: 0, succeeded: 0,
    failed: 0, marginPercent: 200, categoryId: null };
  const items = [];
  let seq = 0;
  const db = {
    aliExpressImportJob: {
      findUnique: async () => ({ ...job }),
      update: async ({ data }) => Object.assign(job, data),
    },
    aliExpressImportJobItem: {
      findFirst: async ({ where }) =>
        items.find(i => i.jobId === where.jobId && i.status === 'PENDING' && i.attempts < 3) || null,
      updateMany: async ({ where, data }) => {
        const t = items.find(i => i.id === where.id && (!where.status || i.status === where.status));
        if (!t) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const t = items.find(i => i.id === where.id);
        Object.assign(t, data);
        return t;
      },
      count: async ({ where }) =>
        items.filter(i => i.jobId === where.jobId && i.status === where.status
          && (!where.attempts || i.attempts < where.attempts.lt)).length,
    },
    category: {
      findUnique: async ({ where }) => where.id ? [...categories.values()].find(c => c.id === where.id) : categories.get(where.slug) || null,
      upsert: async ({ where, create }) => {
        let existing = categories.get(where.slug);
        if (!existing) { existing = { id: `cat-${categories.size + 1}`, name: create.name, slug: create.slug }; categories.set(where.slug, existing); }
        return { id: existing.id };
      },
    },
    product: {
      findMany: async ({ where }) => products.filter(p =>
        !where.OR || where.OR.some(cond => Object.values(cond).some(v => p.aliexpressId === v || p.sourceUrl === v))),
      create: async ({ data }) => {
        if (products.some(p => p.aliexpressId === data.aliexpressId)) throw new Error('dup');
        const p = { id: `prod-${++seq}`, ...data };
        products.push(p);
        return { id: p.id, slug: p.slug, status: p.status };
      },
    },
    _state: { categories, products, job, items },
  };
  return db;
}

function seed(db, urls) {
  urls.forEach((url, i) => {
    db._state.items.push({ id: `item-${i + 1}`, jobId: 'job1', sourceUrl: url,
      status: 'PENDING', attempts: 0, error: null, aliexpressId: null, createdProductId: null });
    db._state.job.total += 1;
  });
}

test('toda la carga usa el margen del job y publica cada producto con su precio', async () => {
  const db = freshDb();
  const seenMargins = [];
  const seenPrices = [];
  const spec = {
    'https://x/p1': { aeId: '1001', categoryId: '1501' },
    'https://x/p2': { aeId: '1002', categoryId: '2002' },
  };
  seed(db, Object.keys(spec));
  const previewFactory = async url => {
    const s = spec[url];
    return basePreview({ aliexpressId: s.aeId, sourceUrl: url, categoryId: s.categoryId });
  };
  const publishMock = async options => {
    seenMargins.push(options.marginPercent);
    seenPrices.push(options.preview.salePriceClp);
    return service.publishAliExpressProduct(options, db);
  };
  await service.processImportJob('job1', db, { preview: previewFactory, publish: publishMock, rateLimitMs: 0 });
  // 8. todos los productos usan el porcentaje del job (200%)
  assert.deepEqual(seenMargins, [200, 200]);
  // 11–15: categorías, variantes, imágenes, duplicados y publicación intactos
  assert.equal(db._state.products.length, 2);
  assert.equal(db._state.products[0].status, 'PUBLISHED');
  assert.equal(db._state.products[0].productVariants.create.length, 1);
  assert.deepEqual(db._state.products[0].productImages.create.map(i => i.url), ['a.jpg']);
  assert.ok(db._state.categories.get('ae-1501'));
  assert.ok(db._state.categories.get('ae-2002'));
  assert.notEqual(db._state.products[0].categoryId, db._state.products[1].categoryId);
  // 16. precio almacenado = precio de vista previa
  assert.deepEqual(seenPrices, [27000, 27000]);
  assert.equal(db._state.products[0].salePrice, 27000);
});

test('duplicados siguen bloqueados durante la carga masiva', async () => {
  const db = freshDb();
  db._state.products.push({ id: 'existing', aliexpressId: '1001', sourceUrl: 'https://x/p1', slug: 'x', status: 'PUBLISHED' });
  seed(db, ['https://x/p1']);
  const previewFactory = async () => basePreview({ duplicateOfProductId: 'existing' });
  const publishMock = async () => { throw new Error('no debe publicarse'); };
  await service.processImportJob('job1', db, { preview: previewFactory, publish: publishMock, rateLimitMs: 0 });
  assert.equal(db._state.items[0].status, 'FAILED');
  assert.equal(db._state.items[0].error, 'DUPLICATE');
});
