/** Inventario de plantillas de negocio activas (solo lectura). */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  const rows = await p.businessTemplate.findMany({
    where: { active: true },
    select: { code: true, name: true, category: true, style: true },
    orderBy: [{ sortOrder: 'asc' }],
  });
  const byCategory = {};
  for (const t of rows) (byCategory[t.category] = byCategory[t.category] || []).push(`${t.code} (${t.name})`);
  for (const [cat, list] of Object.entries(byCategory)) {
    console.log(`${cat}: ${list.length}`);
    for (const item of list) console.log(`   - ${item}`);
  }
  console.log('TOTAL', rows.length);
} catch (e) {
  console.log('ERR', e.message);
} finally {
  await p.$disconnect();
}
