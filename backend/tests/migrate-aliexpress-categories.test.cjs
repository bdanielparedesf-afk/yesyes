// Tests de migración de categorías heredadas "AliExpress #<id>".
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { migrateLegacyCategories } = require('../scripts/migrate-aliexpress-categories.cjs');
const { detectFriendlyCategoryName } = require('../src/services/aliexpress-dropship.service.ts');

function mockDb(seed) {
  const state = {
    categories: new Map(seed.categories.map(c => [c.id, { ...c }])),
    products: seed.products.map(p => ({ ...p })),
  };
  let catSeq = 100;
  const bySlug = slug => [...state.categories.values()].find(c => c.slug === slug);
  const db = {
    category: {
      findMany: async ({ where }) => [...state.categories.values()].filter(c => c.name.startsWith(where.name.startsWith)),
      upsert: async ({ where, create }) => {
        let cat = bySlug(where.slug);
        if (!cat) {
          cat = { id: `cat-${++catSeq}`, name: create.name, slug: create.slug };
          state.categories.set(cat.id, cat);
        }
        return cat;
      },
      delete: async ({ where: { id } }) => { state.categories.delete(id); return {}; },
      count: async () => state.categories.size,
    },
    product: {
      findMany: async ({ where }) => state.products.filter(p => p.categoryId === where.categoryId).map(p => ({ id: p.id, name: p.name })),
      updateMany: async ({ where, data }) => {
        let n = 0;
        for (const p of state.products) if (p.categoryId === where.categoryId) { p.categoryId = data.categoryId; n++; }
        return { count: n };
      },
      count: async ({ where } = {}) => where?.categoryId ? state.products.filter(p => p.categoryId === where.categoryId).length : state.products.length,
    },
    _state: state,
  };
  return db;
}

test('migración: "AliExpress #..." se reasigna a la categoría amigable y la antigua se elimina', async () => {
  const db = mockDb({
    categories: [
      { id: 'c1', name: 'AliExpress #200001419', slug: 'ae-200001419' },
      { id: 'c2', name: 'Electrónica', slug: 'electronics' },
    ],
    products: [
      { id: 'p1', name: 'Phone case smartphone', categoryId: 'c1' },
    ],
  });
  const report = await migrateLegacyCategories(db, detectFriendlyCategoryName);
  assert.equal(report.migrated, 1);
  assert.equal(report.productsReassigned, 1);
  assert.deepEqual(report.deleted, ['AliExpress #200001419']);
  // El producto sobrevive y apunta a la categoría amigable existente (reutilizada).
  assert.equal(db._state.products[0].categoryId, 'c2');
  assert.equal(db._state.categories.size, 1, 'la categoría antigua se eliminó; no hay duplicados');
});

test('migración: sin keywords → todos van a General (categoría General compartida)', async () => {
  const db = mockDb({
    categories: [{ id: 'c1', name: 'AliExpress #200393147', slug: 'ae-200393147' }],
    products: [
      { id: 'p1', name: 'Artículo desconocido XYZ', categoryId: 'c1' },
      { id: 'p2', name: 'Otro sin coincidencia', categoryId: 'c1' },
    ],
  });
  const report = await migrateLegacyCategories(db, detectFriendlyCategoryName);
  assert.equal(report.migrated, 1);
  assert.equal(report.productsReassigned, 2);
  assert.ok(db._state.products.every(p => p.categoryId === [...db._state.categories.values()].find(c => c.slug === 'general').id));
  assert.ok(![...db._state.categories.values()].some(c => /AliExpress #/.test(c.name)));
});

test('migración: ningún producto se pierde y no aparecen duplicados', async () => {
  const db = mockDb({
    categories: [
      { id: 'c1', name: 'AliExpress #200000384', slug: 'ae-200000384' },
      { id: 'c2', name: 'AliExpress #200393147', slug: 'ae-200393147' },
      { id: 'c3', name: 'Hogar', slug: 'home' },
    ],
    products: [
      { id: 'p1', name: 'Silla de cocina', categoryId: 'c1' },
      { id: 'p2', name: 'Cortina living', categoryId: 'c2' },
    ],
  });
  const before = db._state.products.length;
  const report = await migrateLegacyCategories(db, detectFriendlyCategoryName);
  assert.equal(report.beforeCounts.products, before);
  assert.equal(report.afterCounts.products, before, 'ningún producto se pierde');
  assert.equal(report.migrated, 2);
  assert.equal(report.productsReassigned, 2);
  const names = [...db._state.categories.values()].map(c => c.name);
  assert.ok(!names.some(n => /AliExpress #/.test(n)));
  assert.equal(new Set(names).size, names.length, 'no hay categorías con el mismo nombre');
  // Ambos productos comparten la misma categoría Hogar (home).
  const homeId = [...db._state.categories.values()].find(c => c.slug === 'home').id;
  assert.ok(db._state.products.every(p => p.categoryId === homeId));
});

test('migración: los productos conservan nombre, precio y demás propiedades', async () => {
  const db = mockDb({
    categories: [{ id: 'c1', name: 'AliExpress #200001419', slug: 'ae-200001419' }],
    products: [{ id: 'p1', name: 'Phone barato', categoryId: 'c1', salePrice: 21000, shippingCost: 2000 }],
  });
  await migrateLegacyCategories(db, detectFriendlyCategoryName);
  const p = db._state.products[0];
  assert.equal(p.name, 'Phone barato');
  assert.equal(p.salePrice, 21000, 'el precio no cambia');
  assert.equal(p.shippingCost, 2000, 'el shipping no cambia');
});
