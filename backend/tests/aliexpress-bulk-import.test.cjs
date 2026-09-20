// Tests de carga masiva (bulk import) AliExpress: categorÃ­as por producto,
// reutilizaciÃ³n, aislamiento de errores, duplicados, reintento y concurrencia.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const service = require('../src/services/aliexpress-dropship.service.ts');

const basePreview = overrides => ({
  sourceUrl: 'https://es.aliexpress.com/item/1005001234567890.html',
  aliexpressId: '1005001234567890',
  name: 'Producto prueba', description: 'detalle',
  images: ['a.jpg'], video: undefined, categoryId: undefined, weight: undefined,
  variants: [{ supplierVariantId: 'v1', skuAttr: '', attributes: [], image: undefined,
    costUsd: 10, stock: 5, stockKnown: true }],
  stockKnown: true, totalStock: 5,
  costUsdCents: 1000, shippingUsdCents: 0, shippingUnknown: false,
  shippingStatus: 'SHIPPING_CONFIRMED_FREE', shippingSource: 'ALIEXPRESS', shippingMessage: '',
  yesYesShippingState: 'SHIPPING_CONFIRMED_FREE',
  supplierProductCostUsdCents: 1000, supplierShippingCostUsdCents: 0,
  supplierAcquisitionCostUsdCents: 1000,
  productSalePriceUsd: 20, customerShippingUsdCents: 0, customerTotalUsd: 20,
  quantity: 1, selectedSkuId: 'v1', destination: { countryCode: 'CL' },
  acquisition: { productCostUsdCents: 1000, selectedSkuId: 'v1' },
  taxUsdCents: null, otherUsdCents: null, totalUsdCents: null,
  fx: 900, fxRate: 900, fxSource: 'manual', salePriceClp: 18000,
  duplicateOfProductId: null, wholesaleTiers: [], raw: {},
  ...overrides,
});

// Mock DB en memoria compatible con Prisma para job/items/category/product.
function freshDb() {
  const categories = new Map(); const products = [];
  const job = { id: 'job1', status: 'PENDING', total: 0, processed: 0, succeeded: 0,
    failed: 0, marginPercent: 100, categoryId: null };
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
        const target = items.find(i => i.id === where.id && (!where.status || i.status === where.status));
        if (!target) return { count: 0 };
        Object.assign(target, data);
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const target = items.find(i => i.id === where.id);
        if (!target) throw new Error('item no encontrado');
        Object.assign(target, data);
        return target;
      },
      findUnique: async ({ where }) => items.find(i => i.id === where.id) || null,
    },
    category: {
      findUnique: async ({ where }) => {
        const found = where.id ? [...categories.values()].find(c => c.id === where.id) : categories.get(where.slug);
        return found ? { ...found } : null;
      },
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

// Simula preview por URL con categoryId AliExpress propio (o error/duplicado).
function fakePreviewFactory(spec) {
  return async (url) => {
    const s = spec[url];
    if (s.throw) throw new Error('TRANSPORT_DOWN');
    return basePreview({
      aliexpressId: s.aeId, sourceUrl: url, name: s.name,
      categoryId: s.categoryId, duplicateOfProductId: s.duplicate ?? null,
    });
  };
}

function fakePublish(db, log) {
  return async (options) => {
    log.push({ aeId: options.preview.aliexpressId, categoryId: options.categoryId,
      publish: options.publish, price: options.preview.salePriceClp });
    return service.publishAliExpressProduct(options, db);
  };
}

function seed(db, spec) {
  Object.entries(spec).forEach(([url], i) => {
    db._state.items.push({ id: `item-${i + 1}`, jobId: 'job1', sourceUrl: url,
      status: 'PENDING', attempts: 0, error: null, aliexpressId: null, createdProductId: null });
    db._state.job.total += 1;
  });
}

test('bulk: cada producto resuelve su categorÃ­a individualmente y reutiliza ae-{id}', async () => {
  const db = freshDb();
  const calls = [];
  const spec = {
    'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501' },
    'https://x/p2': { aeId: '1002', name: 'Producto 2', categoryId: '2002' },
    'https://x/p3': { aeId: '1003', name: 'Producto 3', categoryId: '1501' },
  };
  seed(db, spec);
  await service.processImportJob('job1', db,
    { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 });
  const products = db._state.products;
  assert.equal(products.length, 3);
  const slug = aeId => products.find(p => p.aliexpressId === aeId).categoryId;
  const cat1 = slug('1001'), cat2 = slug('1002'), cat3 = slug('1003');
  assert.equal(cat1, cat3, 'mismo category_id AliExpress â†’ misma categorÃ­a');
  assert.notEqual(cat1, cat2, 'category_id distinto â†’ categorÃ­a distinta');
  const aeCat = db._state.categories.get('ae-1501');
  assert.ok(aeCat, 'categorÃ­a ae-1501 creada/reutilizada');
  assert.equal(cat1, aeCat.id);
  assert.ok(db._state.categories.get('ae-2002'));
  assert.equal([...db._state.categories.values()].filter(c => c.slug === 'ae-1501').length, 1,
    'no duplicar categorÃ­a');
});

test('bulk: publica productos PUBLISHED visibles en el catÃ¡logo', async () => {
  const db = freshDb();
  const calls = [];
  const spec = { 'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501' } };
  seed(db, spec);
  await service.processImportJob('job1', db,
    { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 });
  assert.equal(calls[0].publish, true);
  assert.equal(db._state.products[0].status, 'PUBLISHED');
  assert.equal(db._state.job.succeeded, 1);
});

test('bulk: un Ã­tem con error no detiene la cola y registra el motivo', async () => {
  const db = freshDb();
  const calls = [];
  const spec = {
    'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501' },
    'https://x/bad': { aeId: '1002', name: 'Mal', categoryId: '1501', throw: true },
    'https://x/p3': { aeId: '1003', name: 'Producto 3', categoryId: '2002' },
  };
  seed(db, spec);
  await service.processImportJob('job1', db,
    { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 });
  const items = db._state.items;
  assert.equal(items.find(i => i.sourceUrl === 'https://x/p1').status, 'DONE');
  assert.equal(items.find(i => i.sourceUrl === 'https://x/bad').status, 'FAILED');
  assert.ok(items.find(i => i.sourceUrl === 'https://x/bad').error, 'motivo registrado');
  assert.equal(items.find(i => i.sourceUrl === 'https://x/p3').status, 'DONE');
  assert.equal(db._state.products.length, 2);
  assert.equal(db._state.job.failed, 1, 'tras MAX_ATTEMPTS el fallo queda contabilizado');
});

test('bulk: duplicado falla de inmediato sin publicar y sin frenar la cola', async () => {
  const db = freshDb();
  const calls = [];
  const spec = {
    'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501' },
    'https://x/dup': { aeId: '1001', name: 'Duplicado', categoryId: '1501', duplicate: 'prod-existente' },
    'https://x/p3': { aeId: '1003', name: 'Producto 3', categoryId: '1501' },
  };
  seed(db, spec);
  await service.processImportJob('job1', db,
    { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 });
  const dup = db._state.items.find(i => i.sourceUrl === 'https://x/dup');
  assert.equal(dup.status, 'FAILED');
  assert.equal(dup.error, 'DUPLICATE');
  assert.equal(dup.attempts, 3, 'sin reintentos innecesarios');
  assert.equal(db._state.products.length, 2, 'no se crea producto duplicado');
  assert.equal(db._state.items.find(i => i.sourceUrl === 'https://x/p3').status, 'DONE');
});

test('bulk: reintento procesa el Ã­tem fallido sin crear duplicados', async () => {
  const db = freshDb();
  const calls = [];
  const spec = { 'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501', throw: true } };
  seed(db, spec);
  const deps = { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 };
  await service.processImportJob('job1', db, deps);
  assert.equal(db._state.products.length, 0);
  const item = db._state.items[0];
  // Quitar el fallo y reintentar (nueva spec sin throw)
  delete spec['https://x/p1'].throw;
  await service.retryImportJobItem(item.id, db, deps);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(db._state.products.length, 1, 'reintento crea exactamente un producto');
  assert.equal(db._state.items[0].status, 'DONE');
});

test('bulk: workers concurrentes no duplican productos ni Ã­tems', async () => {
  const db = freshDb();
  const calls = [];
  const spec = {
    'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501' },
    'https://x/p2': { aeId: '1002', name: 'Producto 2', categoryId: '1501' },
    'https://x/p3': { aeId: '1003', name: 'Producto 3', categoryId: '2002' },
  };
  seed(db, spec);
  const deps = { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 };
  await Promise.all([service.processImportJob('job1', db, deps), service.processImportJob('job1', db, deps)]);
  assert.equal(db._state.products.length, 3, 'cada producto creado exactamente una vez');
  const ids = db._state.products.map(p => p.aliexpressId).sort();
  assert.deepEqual(ids, ['1001', '1002', '1003']);
  assert.equal(calls.length, 3, 'ninguna publicaciÃ³n doble');
  const p1 = db._state.products.find(p => p.aliexpressId === '1001');
  const p3 = db._state.products.find(p => p.aliexpressId === '1003');
  assert.notEqual(p1.categoryId, p3.categoryId, 'categorÃ­as no mezcladas');
});

test('bulk: imÃ¡genes y variantes de cada producto quedan aisladas', async () => {
  const db = freshDb();
  const calls = [];
  const spec = {
    'https://x/p1': { aeId: '1001', name: 'Producto 1', categoryId: '1501' },
    'https://x/p2': { aeId: '1002', name: 'Producto 2', categoryId: '1501' },
  };
  seed(db, spec);
  const deps = { preview: fakePreviewFactory(spec), publish: fakePublish(db, calls), rateLimitMs: 0 };
  await service.processImportJob('job1', db, deps);
  const [p1, p2] = db._state.products;
  assert.deepEqual(p1.images, ['a.jpg']);
  assert.deepEqual(p2.images, ['a.jpg']);
  assert.equal(p1.productVariants.create[0].sku, '1001-v1');
  assert.equal(p2.productVariants.create[0].sku, '1002-v1');
  assert.equal(p1.salePrice, 18000, 'precio del motor de precios intacto');
  assert.equal(p2.salePrice, 18000);
});

