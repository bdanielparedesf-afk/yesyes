// Tests obligatorios: resolución automática de categorías en imports AliExpress.
// Reglas: category_id de AliExpress → reutilizar/upsert ae-{id}; keywords controladas
// → categorías predefinidas; sin coincidencia → General. Sin input manual de frontend.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const service = require('../src/services/aliexpress-dropship.service.ts');

// Producto fixture básico.
const baseProduct = {
  ae_item_base_info_dto: {
    product_id: '1005001234567890', subject: 'Producto genérico de prueba',
    currency_code: 'USD', detail: '<p>detalle</p>',
  },
  ae_item_sku_info_dtos: [
    { sku_id: '120000000000000001', sku_attr: '', sku_price: '10.00', sku_available_stock: 50 },
  ],
  ae_multimedia_info_dto: { image_urls: 'a.jpg;b.jpg', ae_video_dtos: [] },
};
const basePreview = (overrides = {}) => ({
  sourceUrl: 'https://es.aliexpress.com/item/1005001234567890.html',
  aliexpressId: '1005001234567890',
  name: overrides.name ?? baseProduct.ae_item_base_info_dto.subject,
  description: 'detalle',
  images: ['a.jpg', 'b.jpg'],
  video: undefined,
  categoryId: overrides.categoryId ?? undefined,
  weight: undefined,
  variants: [{
    supplierVariantId: 'v1', skuAttr: '', attributes: [],
    image: undefined, costUsd: 10.00, stock: 50, stockKnown: true,
  }],
  stockKnown: true, totalStock: 50,
  costUsdCents: 1000,
  shippingUsdCents: 0, shippingUnknown: false,
  shippingStatus: 'SHIPPING_CONFIRMED_FREE', shippingSource: 'ALIEXPRESS', shippingMessage: '',
  yesYesShippingState: 'SHIPPING_CONFIRMED_FREE',
  supplierProductCostUsdCents: 1000, supplierShippingCostUsdCents: 0,
  supplierAcquisitionCostUsdCents: 1000,
  productSalePriceUsd: 20.00, customerShippingUsdCents: 0, customerTotalUsd: 20.00,
  quantity: 1, selectedSkuId: '120000000000000001',
  destination: { countryCode: 'CL' },
  acquisition: { productCostUsdCents: 1000, selectedSkuId: '120000000000000001' },
  taxUsdCents: null, otherUsdCents: null, totalUsdCents: null,
  fx: 900, fxRate: 900, fxSource: 'manual',
  salePriceClp: 18000,
  duplicateOfProductId: null,
  wholesaleTiers: [],
  raw: {},
  ...overrides,
});

// Mock DB que acumula operaciones para inspección.
function freshDb(upsertOverride) {
  const categories = new Map();
  let catIdSeq = 1;
  return {
    category: {
      findUnique: async ({ where }) => {
        const cat = where.id
          ? Array.from(categories.values()).find(c => c.id === where.id)
          : categories.get(where.slug);
        return cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null;
      },
      upsert: async ({ where, create, select }) => {
        let result;
        if (upsertOverride) {
          result = await upsertOverride(categories, { where, create, select });
        } else {
          let existing = categories.get(where.slug);
          if (!existing) {
            const id = `cat-${String(catIdSeq++).padStart(4, '0')}`;
            existing = { id, name: create.name, slug: create.slug };
            categories.set(where.slug, existing);
          }
          result = select.id ? { id: existing.id } : existing;
        }
        return result;
      },
      findFirst: async () => null,
      create: async ({ data }) => {
        const id = `cat-${String(catIdSeq++).padStart(4, '0')}`;
        const cat = { id, name: data.name, slug: data.slug };
        categories.set(data.slug, cat);
        return cat;
      },
    },
    product: {
      findMany: async () => [],
      create: async ({ data }) => ({
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: data.name, slug: data.slug, categoryId: data.categoryId,
        salePrice: data.salePrice, status: data.status, margin: data.margin,
        productCost: data.productCost, shippingCost: data.shippingCost, totalCost: data.totalCost,
        aliexpressId: data.aliexpressId,
      }),
    },
    aliExpressDuplicate: { findFirst: async () => null },
  };
}

// ── 1. category_id AliExpress existente → reutilizar + autocura de nombre ───
test('category_id AliExpress existente → reutilizar y autocurar nombre "AliExpress #..."', async () => {
  const db = freshDb();
  // Seed directo de la categoría heredada en el mapa del mock.
  const categories = new Map([['ae-1501', { id: 'cat-0001', name: 'AliExpress #1501', slug: 'ae-1501' }]]);
  db.category.findUnique = async ({ where }) => categories.get(where.slug) ?? null;
  db.category.update = async ({ where, data }) => {
    const cat = categories.get(where.slug);
    cat.name = data.name;
    return cat;
  };
  db.category.upsert = async ({ where, create }) => {
    let cat = categories.get(where.slug);
    if (!cat) { cat = { id: 'cat-new', name: create.name, slug: create.slug }; categories.set(where.slug, cat); }
    return cat;
  };
  const preview = basePreview({ categoryId: '1501' });
  const resolvedId = await service.resolveCategory(preview, db);
  assert.equal(resolvedId, 'cat-0001');
  const cat = await db.category.findUnique({ where: { slug: 'ae-1501' } });
  assert.ok(cat, 'La categoría debe seguir existiendo');
  assert.ok(!/AliExpress #/.test(cat.name), 'el nombre visible nunca debe ser "AliExpress #ID"');
  assert.equal(cat.name, 'General');
});

test('category_id nuevo con keywords → categoría ae-{id} con nombre amigable', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: '7777', name: 'Smartphone case funda' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'ae-7777' } });
  assert.ok(cat);
  assert.equal(cat.slug, 'ae-7777');
  assert.ok(!/AliExpress #/.test(cat.name), 'el nombre visible nunca debe ser "AliExpress #ID"');
  assert.equal(cat.name, 'Electrónica');
});

// ── 2. category_id nuevo → crear ────────────────────────────────────────────
test('category_id nuevo → crear categoría ae-{id} vía upsert', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: '9999' });
  const resolvedId = await service.resolveCategory(preview, db);
  assert.match(resolvedId, /^cat-/);
  const cat = await db.category.findUnique({ where: { slug: 'ae-9999' } });
  assert.ok(cat, 'La categoría ae-9999 debe existir en DB después del upsert');
  assert.equal(cat.name, 'General', 'el nombre visible debe ser amigable, nunca "AliExpress #ID"');
  assert.equal(cat.slug, 'ae-9999');
});

// ── 3. Dos productos misma categoría → misma categoría YesYes ───────────────
test('dos productos con mismo category_id → misma categoría YesYes', async () => {
  const db = freshDb();
  const p1 = basePreview({ categoryId: '1501', name: 'Producto A' });
  const p2 = basePreview({ categoryId: '1501', name: 'Producto B' });
  const id1 = await service.resolveCategory(p1, db);
  const id2 = await service.resolveCategory(p2, db);
  assert.equal(id1, id2, 'Ambos productos deben obtener la misma categoryId');
  const cat = await db.category.findUnique({ where: { slug: 'ae-1501' } });
  assert.ok(cat, 'La categoría ae-1501 debe existir');
  assert.equal(cat.name, 'General', 'mismo slug técnico ae-{id}, nombre amigable');
});

// ── 4. Importaciones concurrentes → no duplicar ─────────────────────────────
test('importaciones concurrentes → no duplicar (upsert atómico)', async () => {
  const db = freshDb();
  const N = 10;
  const promises = Array.from({ length: N }, () =>
    service.resolveCategory(basePreview({ categoryId: '1501' }), db),
  );
  const ids = await Promise.all(promises);
  for (const id of ids) assert.equal(id, ids[0]);
  const cat = await db.category.findUnique({ where: { slug: 'ae-1501' } });
  assert.ok(cat, 'La categoría debe existir');
  assert.equal(cat.slug, 'ae-1501');
});

// ── 5. Sin category_id → keywords ───────────────────────────────────────────
test('sin category_id → detección por keywords (electrónica)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Bluetooth Headphones Pro' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'electronics' } });
  assert.ok(cat, 'Categoría electronics debe existir');
  assert.equal(cat.name, 'Electrónica');
});

test('sin category_id → detección por keywords (moda)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Camiseta algodón hombre' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'fashion' } });
  assert.ok(cat, 'Categoría fashion debe existir');
  assert.equal(cat.name, 'Moda');
});

test('sin category_id → detección por keywords (hogar)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Lámpara de escritorio LED' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'home' } });
  assert.ok(cat, 'Categoría home debe existir');
  assert.equal(cat.name, 'Hogar');
});

test('sin category_id → detección por keywords (belleza)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Crema hidratante facial' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'beauty' } });
  assert.ok(cat);
  assert.equal(cat.name, 'Belleza');
});

test('sin category_id → detección por keywords (juguetes)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Peluche oso grande' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'toys' } });
  assert.ok(cat);
  assert.equal(cat.name, 'Juguetes');
});

test('sin category_id → detección por keywords (deportes)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Bicicleta estática profesional' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'sports' } });
  assert.ok(cat);
  assert.equal(cat.name, 'Deportes');
});

test('sin category_id → detección por keywords (oficina)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Cuaderno universitario A4' });
  await service.resolveCategory(preview, db);
  const cat = await db.category.findUnique({ where: { slug: 'office' } });
  assert.ok(cat);
  assert.equal(cat.name, 'Oficina');
});

// ── 6. Sin coincidencia de keywords → General ────────────────────────────────
test('sin category_id y sin keywords → General', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Producto totalmente desconocido xyz' });
  const resolvedId = await service.resolveCategory(preview, db);
  assert.match(resolvedId, /^cat-/);
  const cat = await db.category.findUnique({ where: { slug: 'general' } });
  assert.ok(cat, 'Categoría general debe existir');
  assert.equal(cat.name, 'General');
  assert.equal(cat.slug, 'general');
});

test('varios productos sin keywords → todos van a General', async () => {
  const db = freshDb();
  const products = [
    basePreview({ categoryId: undefined, name: 'Producto sin categoría A' }),
    basePreview({ categoryId: undefined, name: 'Producto sin categoría B' }),
    basePreview({ categoryId: undefined, name: 'Impletro C' }),
  ];
  const ids = await Promise.all(products.map(p => service.resolveCategory(p, db)));
  for (const id of ids) assert.equal(id, ids[0], 'Todos deben ir a General');
  const cat = await db.category.findUnique({ where: { slug: 'general' } });
  assert.ok(cat);
});

// ── 7. Publicación sin categoryId manual ─────────────────────────────────────
test('publicación sin categoryId → backend resuelve automáticamente', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Zapatilla deportiva running' });
  const product = await service.publishAliExpressProduct(
    { preview, marginPercent: 100, publish: true }, db,
  );
  assert.ok(product.id, 'El producto debe ser creado');
  const cat = await db.category.findUnique({ where: { slug: 'fashion' } });
  assert.ok(cat, 'Categoría fashion debe existir');
  assert.equal(product.categoryId, cat.id);
  assert.equal(product.status, 'PUBLISHED');
});

test('publicación con categoryId de AliExpress → usa ae-{id}', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: '1501', name: 'Smartphone X' });
  const product = await service.publishAliExpressProduct(
    { preview, marginPercent: 100, publish: true }, db,
  );
  assert.ok(product.id);
  const cat = await db.category.findUnique({ where: { slug: 'ae-1501' } });
  assert.ok(cat);
  assert.equal(product.categoryId, cat.id);
  assert.ok(!/AliExpress #/.test(cat.name), 'el nombre visible nunca debe ser "AliExpress #ID"');
  assert.equal(cat.name, 'Electrónica');
});

// ── 8. Bulk sin categoryId manual → resolver por producto ────────────────────
test('bulk sin categoryId → resolver individualmente, mismo category_id → misma categoría', async () => {
  const db = freshDb();
  const p1 = basePreview({ categoryId: '1501', name: 'Product A' });
  const p2 = basePreview({ categoryId: '1501', name: 'Product B' });
  const p3 = basePreview({ categoryId: undefined, name: 'Cámara digital HD' });
  const catId1 = await service.resolveCategory(p1, db);
  const catId2 = await service.resolveCategory(p2, db);
  const catId3 = await service.resolveCategory(p3, db);
  assert.equal(catId1, catId2, 'Productos A y B → misma categoría (ae-1501)');
  assert.notEqual(catId1, catId3, 'Producto C → categoría diferente (electronics)');
  const aeCat = await db.category.findUnique({ where: { slug: 'ae-1501' } });
  const elecCat = await db.category.findUnique({ where: { slug: 'electronics' } });
  assert.ok(aeCat);
  assert.ok(elecCat);
});

// ── 9. Producto publicado asociado correctamente ────────────────────────────
test('producto publicado queda asociado a la categoría resuelta', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Mochila viaje edición limitada' });
  const product = await service.publishAliExpressProduct(
    { preview, marginPercent: 100, publish: false }, db,
  );
  assert.equal(product.status, 'DRAFT');
  const fashionCat = await db.category.findUnique({ where: { slug: 'fashion' } });
  assert.ok(fashionCat);
  assert.equal(product.categoryId, fashionCat.id);
  assert.equal(product.salePrice, 18000);
  assert.ok(product.id);
});

// ── 10. Producto duplicado sigue bloqueado ──────────────────────────────────
test('producto duplicado → sigue bloqueado (duplicateOfProductId)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: '1501', name: 'Product' });
  preview.duplicateOfProductId = 'existing-product-id';
  await assert.rejects(
    () => service.publishAliExpressProduct({ preview, marginPercent: 100, publish: true }, db),
    { reason: 'INPUT' },
  );
});

// ── 11. Precios y envíos: lógica existente intacta ──────────────────────────
test('precio CLP se calcula correctamente (lógica YesYes intacta)', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: '1501' });
  assert.equal(preview.salePriceClp, 18000);
  const product = await service.publishAliExpressProduct(
    { preview, marginPercent: 100, publish: true }, db,
  );
  assert.equal(product.salePrice, 18000, 'El salePrice CLP debe coincidir con el cálculo esperado');
});

test('salePrice SIEMPRE viene del motor de precios (preview.salePriceClp)', async () => {
  const db = freshDb();
  // preview.salePriceClp ya trae el margen aplicado por yesyes-pricing.
  // publishAliExpressProduct NO debe recalcular el precio por su cuenta.
  for (const marginPercent of [50, 100, 200, 400]) {
    const preview = basePreview({ categoryId: '1501', salePriceClp: 9000 + marginPercent * 90 });
    const product = await service.publishAliExpressProduct(
      { preview, marginPercent, publish: true }, db,
    );
    assert.equal(product.salePrice, preview.salePriceClp,
      `Margen ${marginPercent}%: salePrice debe salir del motor de precios, no recalcularse`);
    assert.equal(product.margin, marginPercent);
  }
});

// ── Adicionales ─────────────────────────────────────────────────────────────

test('bulk con categoryId null/undefined → no lanza INPUT', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Zapatos negros' });
  const product = await service.publishAliExpressProduct(
    { preview, marginPercent: 100, publish: false }, db,
  );
  assert.ok(product.id, 'Debe crear el producto aunque no haya categoryId');
  const fashionCat = await db.category.findUnique({ where: { slug: 'fashion' } });
  assert.ok(fashionCat, 'Categoría fashion debe ser creada');
  assert.equal(product.categoryId, fashionCat.id);
});

test('no se crean categorías con slugs arbitrarios a partir del título', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Xylophone Musical Instrument' });
  const resolvedId = await service.resolveCategory(preview, db);
  const general = await db.category.findUnique({ where: { slug: 'general' } });
  assert.ok(general);
  assert.equal(resolvedId, general.id);
  const arbitrary = await db.category.findUnique({ where: { slug: 'xylophone-musical-instrument' } });
  assert.equal(arbitrary, null, 'No debe crearse una categoría con slug arbitrario del título');
});

test('categoría General se crea automáticamente si no existe', async () => {
  const db = freshDb();
  const preview = basePreview({ categoryId: undefined, name: 'Producto sin categoría' });
  const resolvedId = await service.resolveCategory(preview, db);
  const general = await db.category.findUnique({ where: { slug: 'general' } });
  assert.ok(general, 'General debe ser creado por el resolver');
  assert.equal(general.name, 'General');
  assert.equal(resolvedId, general.id);
});

console.log('Tests de resolución de categorías listos.');
