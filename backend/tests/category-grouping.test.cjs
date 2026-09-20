// Agrupacion ae-* -> categoria comercial (solo presentacion, sin tocar BD).
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { buildHomeData } = require('../src/controllers/product.controller.ts');
const groups = require('../src/utils/category-groups.ts');

function makeDb() {
  const categories = [
    { id: 'c-ae1', name: 'Electrónica', slug: 'ae-440504', image: null, order: 0, active: true },
    { id: 'c-ae2', name: 'Electrónica', slug: 'ae-200001091', image: null, order: 0, active: true },
    { id: 'c-ae3', name: 'Electrónica', slug: 'ae-5093004', image: null, order: 0, active: true },
    { id: 'c-ae4', name: 'General', slug: 'ae-200000769', image: null, order: 0, active: true },
    { id: 'c-gen', name: 'General', slug: 'general', image: null, order: 99, active: true },
  ];
  const products = [
    { id: 'p1', categoryId: 'c-ae1', status: 'PUBLISHED', hidden: false, collectionId: null, isFeatured: false, isOffer: false, createdAt: new Date('2026-01-03'), category: { id: 'c-ae1', name: 'Electrónica', slug: 'ae-440504' }, collection: null, productImages: [], productVariants: [] },
    { id: 'p2', categoryId: 'c-ae2', status: 'PUBLISHED', hidden: false, collectionId: null, isFeatured: false, isOffer: false, createdAt: new Date('2026-01-02'), category: { id: 'c-ae2', name: 'Electrónica', slug: 'ae-200001091' }, collection: null, productImages: [], productVariants: [] },
    { id: 'p3', categoryId: 'c-ae3', status: 'PUBLISHED', hidden: false, collectionId: null, isFeatured: false, isOffer: false, createdAt: new Date('2026-01-01'), category: { id: 'c-ae3', name: 'Electrónica', slug: 'ae-5093004' }, collection: null, productImages: [], productVariants: [] },
    { id: 'p4', categoryId: 'c-ae3', status: 'PUBLISHED', hidden: false, collectionId: null, isFeatured: false, isOffer: false, createdAt: new Date('2026-01-01'), category: { id: 'c-ae3', name: 'Electrónica', slug: 'ae-5093004' }, collection: null, productImages: [], productVariants: [] },
    { id: 'p5', categoryId: 'c-ae4', status: 'PUBLISHED', hidden: false, collectionId: null, isFeatured: false, isOffer: false, createdAt: new Date('2026-01-01'), category: { id: 'c-ae4', name: 'General', slug: 'ae-200000769' }, collection: null, productImages: [], productVariants: [] },
    { id: 'p6', categoryId: 'c-ae1', status: 'DRAFT', hidden: false, collectionId: null, isFeatured: false, isOffer: false, createdAt: new Date('2026-01-04'), category: { id: 'c-ae1', name: 'Electrónica', slug: 'ae-440504' }, collection: null, productImages: [], productVariants: [] },
  ];
  function match(p, where) {
    if (!where) return true;
    if (where.status && p.status !== where.status) return false;
    if (where.hidden !== undefined && p.hidden !== where.hidden) return false;
    if (where.categoryId !== undefined) {
      if (typeof where.categoryId === 'string' && p.categoryId !== where.categoryId) return false;
    }
    if (where.collectionId !== undefined && p.collectionId !== where.collectionId) return false;
    return true;
  }
  return {
    category: { findMany: async () => categories },
    product: {
      findMany: async ({ where, take }) => products.filter((p) => match(p, where)).slice(0, take || 100),
      count: async ({ where }) => products.filter((p) => match(p, where)).length,
    },
  };
}

test('ae-* con mismo nombre se agrupan en 1 tarjeta comercial con contador sumado', async () => {
  const result = await buildHomeData(makeDb());
  const slugs = result.categories.map((c) => c.slug);
  assert.ok(!slugs.some((s) => s.startsWith('ae-')), 'No debe haber slugs ae-* en Home: ' + slugs.join(','));
  const elec = result.categories.find((c) => c.slug === 'electronics');
  assert.ok(elec, 'Debe existir tarjeta electronics, slugs: ' + slugs.join(','));
  assert.equal(elec.productCount, 4, 'Electronica suma ae-440504(1)+ae-200001091(1)+ae-5093004(2)');
  const general = result.categories.find((c) => c.slug === 'general');
  assert.ok(general);
  assert.equal(general.productCount, 1);
  assert.equal(result.categories.filter((c) => c.name === 'Electrónica').length, 1, 'Sin tarjetas repetidas');
});

test('resolveGroupIds: canonico y alias espanol agrupan; legacy ae-* sigue resolviendo', () => {
  const cats = [
    { id: 'c-ae1', name: 'Electrónica', slug: 'ae-440504' },
    { id: 'c-ae2', name: 'Electrónica', slug: 'ae-200001091' },
    { id: 'c-e', name: 'Electrónica', slug: 'electronics' },
  ];
  const a = groups.resolveGroupIds(cats, 'electronics');
  assert.ok(a && a.ids.length === 3);
  const b = groups.resolveGroupIds(cats, 'electronica');
  assert.ok(b && b.ids.length === 3, 'Alias /electronica debe agrupar igual');
  const legacy = groups.resolveGroupIds(cats, 'ae-440504');
  assert.ok(legacy && legacy.ids.length === 1, 'Legacy ae-* sigue funcionando');
  assert.equal(groups.resolveGroupIds(cats, 'no-existe'), null);
});
