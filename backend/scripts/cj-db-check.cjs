// Read-only integrity check: database reachable + CJ authentication works.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
require('tsx/cjs');
const { prisma } = require('../src/lib/prisma.ts');
const { getCJToken } = require('../src/lib/cj.ts');
(async () => {
  try {
    const products = await prisma.product.count();
    const cj = await prisma.product.count({ where: { cjProductId: { not: null } } });
    console.log(JSON.stringify({ dbCheck: 'PASS', products, cjProducts: cj }));
  } catch (error) {
    console.log(JSON.stringify({ dbCheck: 'FAIL', detail: error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 400) : 'UNAVAILABLE' }));
  }
  try {
    await getCJToken();
    console.log(JSON.stringify({ cjCheck: 'PASS', note: 'CJ authentication succeeded (read-only)' }));
  } catch (error) {
    console.log(JSON.stringify({ cjCheck: 'FAIL', detail: error instanceof Error ? error.message.slice(0, 200) : 'UNAVAILABLE' }));
  }
  await prisma.$disconnect().catch(() => {});
})();
