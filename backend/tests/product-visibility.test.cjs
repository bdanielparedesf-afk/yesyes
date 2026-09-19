const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { buildHomeData } = require('../src/controllers/product.controller.ts');

function makeMockDb() {
  const products = [
    { id: 'p1', name: 'Producto 1', slug: 'producto-1', salePrice: 50000, compareAtPrice: 60000,
      status: 'PUBLISHED', hidden: false, collectionId: null, categoryId: 'cat-elec',
      isFeatured: true, isOffer: false, stock: 10,
      productImages: [{ id: 'img1', url: 'img1.jpg', alt: 'Test', position: 0 }],
      productVariants: [],
      category: { id: 'cat-elec', name: 'Electrónica', slug: 'electronics' },
      collection: null,
    },
    { id: 'p2', name: 'Producto 2', slug: 'producto-2', salePrice: 30000, compareAtPrice: null,
      status: 'PUBLISHED', hidden: false, collectionId: 'col-1', categoryId: 'cat-home',
      isFeatured: false, isOffer: true, stock: 5,
      productImages: [{ id: 'img2', url: 'img2.jpg', alt: 'Test', position: 0 }],
      productVariants: [],
      category: { id: 'cat-home', name: 'Hogar', slug: 'home' },
      collection: { id: 'col-1', name: 'Ofertas', slug: 'special-offers' },
    },
    { id: 'p3', name: 'Borrador', slug: 'borrador', salePrice: 10000,
      status: 'DRAFT', hidden: false, collectionId: null, categoryId: 'cat-elec',
      isFeatured: false, isOffer: false, stock: 3,
      productImages: [], productVariants: [],
      category: { id: 'cat-elec', name: 'Electrónica', slug: 'electronics' },
      collection: null,
    },
    { id: 'p4', name: 'Oculto', slug: 'oculto', salePrice: 20000,
      status: 'PUBLISHED', hidden: true, collectionId: null, categoryId: 'cat-elec',
      isFeatured: false, isOffer: false, stock: 0,
      productImages: [], productVariants: [],
      category: { id: 'cat-elec', name: 'Electrónica', slug: 'electronics' },
      collection: null,
    },
    { id: 'p5', name: 'Producto 5', slug: 'producto-5', salePrice: 25000, compareAtPrice: 30000,
      status: 'PUBLISHED', hidden: false, collectionId: null, categoryId: 'cat-elec',
      isFeatured: true, isOffer: false, stock: 8,
      productImages: [{ id: 'img5', url: 'img5.jpg', alt: 'Test', position: 0 }],
      productVariants: [],
      category: { id: 'cat-elec', name: 'Electrónica', slug: 'electronics' },
      collection: null,
    },
  ];

  const categories = [
    { id: 'cat-elec', name: 'Electrónica', slug: 'electronics', image: null, order: 0, active: true,
      _count: { products: 1 } },
    { id: 'cat-home', name: 'Hogar', slug: 'home', image: null, order: 1, active: true,
      _count: { products: 1 } },
    { id: 'cat-gen', name: 'General', slug: 'general', image: null, order: 99, active: true,
      _count: { products: 3 } },
  ];

  function findProducts(where) {
    return products.filter(p => {
      if (where.status && p.status !== where.status) return false;
      if (where.hidden !== undefined && p.hidden !== where.hidden) return false;
      if (where.isFeatured !== undefined && p.isFeatured !== where.isFeatured) return false;
      if (where.isOffer !== undefined && p.isOffer !== where.isOffer) return false;
      if (where.collectionId !== undefined && p.collectionId !== where.collectionId) return false;
      if (where.categoryId !== undefined && p.categoryId !== where.categoryId) return false;
      return true;
    }).slice(0, where.take || 100);
  }

  return {
    category: {
      findMany: async () => categories,
    },
    product: {
      findMany: async ({ where, take, orderBy, include }) => {
        void orderBy; void include;
        return findProducts(where || {}).slice(0, take || 100);
      },
      count: async ({ where }) => findProducts(where || {}).length,
    },
  };
}

test('buildHomeData returns products without collection (root cause fix)', async () => {
  const db = makeMockDb();
  const result = await buildHomeData(db);

  // latest should include ALL published products (including collectionless)
  const p1InLatest = result.latest.some(p => p.id === 'p1');
  const p5InLatest = result.latest.some(p => p.id === 'p5');
  console.log('✓ Latest includes collectionless product p1:', p1InLatest);
  console.log('✓ Latest includes collectionless product p5:', p5InLatest);

  // uncategorized should include only collectionless products
  const uncategorizedIds = result.uncategorized.map(p => p.id);
  console.log('✓ Uncategorized includes p1 (no collection):', uncategorizedIds.includes('p1'));
  console.log('✓ Uncategorized includes p5 (no collection):', uncategorizedIds.includes('p5'));

  // Draft and hidden products should NOT appear
  const allReturned = [
    ...result.latest, ...result.featured, ...result.offers, ...result.uncategorized,
    ...Object.values(result.byCategory).flat(),
  ];
  const p3Visible = allReturned.some(p => p.id === 'p3'); // DRAFT
  const p4Visible = allReturned.some(p => p.id === 'p4'); // HIDDEN
  console.log('✗ Draft product p3 excluded:', !p3Visible);
  console.log('✗ Hidden product p4 excluded:', !p4Visible);

  assert.ok(p1InLatest, 'Collectionless product p1 should appear in latest');
  assert.ok(p5InLatest, 'Collectionless product p5 should appear in latest');
  assert.ok(uncategorizedIds.includes('p1'), 'Collectionless product p1 should be in uncategorized');
  assert.ok(uncategorizedIds.includes('p5'), 'Collectionless product p5 should be in uncategorized');
  assert.ok(!p3Visible, 'Draft product p3 should not appear');
  assert.ok(!p4Visible, 'Hidden product p4 should not appear');
});

test('buildHomeData returns categories with active filter', async () => {
  const db = makeMockDb();
  const result = await buildHomeData(db);

  assert.ok(result.categories.length >= 2, 'Should have categories with products');
  const elec = result.categories.find(c => c.slug === 'electronics');
  assert.ok(elec, 'Electronics category should be present');
  console.log('✓ Categories returned:', result.categories.map(c => c.name));
});

test('buildHomeData separates featured and offers', async () => {
  const db = makeMockDb();
  const result = await buildHomeData(db);

  const featuredIds = result.featured.map(p => p.id);
  const offerIds = result.offers.map(p => p.id);

  assert.ok(featuredIds.includes('p1'), 'Featured section should include p1 (isFeatured)');
  assert.ok(offerIds.includes('p2'), 'Offers section should include p2 (isOffer)');
  console.log('✓ Featured products:', featuredIds);
  console.log('✓ Offer products:', offerIds);
});

test('buildHomeData groups products by category', async () => {
  const db = makeMockDb();
  const result = await buildHomeData(db);

  assert.ok(result.byCategory['electronics'], 'Should have electronics section');
  assert.ok(result.byCategory['home'], 'Should have home section');
  const elecProducts = result.byCategory['electronics'];
  console.log('✓ Products by electronics:', elecProducts.map(p => p.name));
});
