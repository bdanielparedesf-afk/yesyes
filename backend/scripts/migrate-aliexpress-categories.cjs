// Migra categorías heredadas creadas como "AliExpress #<category_id>".
// Reglas: NO borrar productos, NO perder relaciones Product → Category.
// Para cada categoría "AliExpress #...": se resuelve la categoría amigable con
// la MISMA resolución automática del importador (keywords controladas de los
// nombres de sus productos, si no → General, slug 'general'), se reasignan
// TODOS sus productos (el grupo completo se mantiene junto: mismo category_id
// AliExpress → misma categoría YesYes), y solo después se elimina la categoría
// antigua si quedó sin productos. Si la categoría destino ya existe, se
// reutiliza (nunca duplicados).
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
require('tsx/cjs');
const { prisma } = require('../src/lib/prisma.ts');
const { detectFriendlyCategoryName } = require('../src/services/aliexpress-dropship.service.ts');

// Mapeo nombre visible → slug predefinido (misma lista que usa el resolver).
const NAME_TO_SLUG = {
  'Electrónica': 'electronics', 'Moda': 'fashion', 'Hogar': 'home', 'Belleza': 'beauty',
  'Juguetes': 'toys', 'Deportes': 'sports', 'Oficina': 'office',
};

/**
 * Migra categorías heredadas "AliExpress #<id>" a su categoría amigable.
 * NO borra productos; reasigna el grupo completo de cada categoría (mismo
 * category_id AliExpress → misma categoría YesYes), reutiliza la categoría
 * destino si ya existe y solo elimina la antigua si quedó sin productos.
 */
async function migrateLegacyCategories(db, detectFriendlyName) {
  const legacy = await db.category.findMany({
    where: { name: { startsWith: 'AliExpress #' } },
    select: { id: true, name: true, slug: true },
  });
  const report = { migrated: 0, productsReassigned: 0, deleted: [], updated: [], errors: [] };
  const beforeCounts = {
    products: await db.product.count(),
    categories: await db.category.count(),
  };

  for (const cat of legacy) {
    try {
      const products = await db.product.findMany({
        where: { categoryId: cat.id },
        select: { id: true, name: true },
      });
      // Resolución amigable con la MISMA lógica del importador: primer keyword
      // match en los nombres de los productos de la categoría; si no → General.
      let targetName = null;
      for (const p of products) {
        const friendly = detectFriendlyName(p.name);
        if (friendly) { targetName = friendly; break; }
      }
      targetName = targetName ?? 'General';
      const targetSlug = NAME_TO_SLUG[targetName] ?? 'general';
      if (targetSlug === cat.slug) continue; // ya es la categoría destino
      // Reutiliza la categoría destino si ya existe; nunca duplicados.
      const canonical = await db.category.upsert({
        where: { slug: targetSlug },
        create: { name: targetName, slug: targetSlug },
        update: {},
        select: { id: true, slug: true, name: true },
      });
      if (canonical.id === cat.id) continue;
      const reassigned = await db.product.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: canonical.id },
      });
      const left = await db.product.count({ where: { categoryId: cat.id } });
      if (left === 0) {
        await db.category.delete({ where: { id: cat.id } });
        report.deleted.push(cat.name);
      } else {
        throw new Error(`La categoría ${cat.name} aún tiene ${left} productos; no se elimina.`);
      }
      report.migrated += 1;
      report.productsReassigned += reassigned.count;
      report.updated.push(`${cat.name} → ${canonical.name} (${canonical.slug})`);
    } catch (err) {
      report.errors.push(`${cat.name}: ${err?.message ?? err}`);
    }
  }

  const afterCounts = {
    products: await db.product.count(),
    categories: await db.category.count(),
  };
  return { beforeCounts, afterCounts, ...report };
}

async function migrateDryRun(db) {
  return (db ?? prisma).category.findMany({
    where: { name: { startsWith: 'AliExpress #' } },
    select: { id: true, name: true, slug: true, _count: { select: { products: true } } },
  });
}

module.exports = { migrateLegacyCategories, migrateDryRun, NAME_TO_SLUG };

if (require.main === module) {
  const db = prisma;
  const run = process.argv.includes('--dry-run')
    ? migrateDryRun(db).then(legacy => console.log(JSON.stringify({ legacyCategories: legacy.map(c => ({ ...c, products: c._count.products })) }, null, 2)))
    : migrateLegacyCategories(db, detectFriendlyCategoryName).then(report => console.log(JSON.stringify(report, null, 2)));
  run.then(() => prisma.$disconnect());
}
