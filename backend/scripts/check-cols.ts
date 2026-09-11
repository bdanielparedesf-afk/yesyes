import { prisma } from '../src/lib/prisma';

(async () => {
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('hidden','hasAlert','alert','alertLevel','sourceUrl','sourcePlatform','sourceId','costUsd','lastCheckedAt')
      ORDER BY column_name
    `;
    console.log('Columns found in products:');
    rows.forEach((r: any) => console.log(`  - ${r.column_name} (${r.data_type}) default: ${r.column_default}`));
    if (!rows.length) console.log('  NONE of the expected columns exist!');
  } catch (e: any) {
    console.error('DB error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
