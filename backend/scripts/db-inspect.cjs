// One-off diagnostic: lists real tables + dropship objects in production DB.
// Read-only. Run: node scripts/db-inspect.cjs
const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

(async () => {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) { console.error('Sin DIRECT_URL/DATABASE_URL'); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1");
  console.log('== TABLAS ==');
  console.log(tables.rows.map(r => r.table_name).join('\n'));
  for (const t of ['aliexpress_sync_logs', 'aliexpress_sync_settings', 'aliexpress_import_jobs',
    'aliexpress_import_job_items', 'aliexpress_order_snapshots', 'aliexpress_oauth_attempts',
    'aliexpress_tokens', 'product_variants', '"ProductVariant"']) {
    const name = t.replace(/"/g, '');
    const exists = await client.query(
      "SELECT to_regclass($1) AS reg, count(*) AS n FROM _prisma_migrations WHERE migration_name LIKE $2",
      [`public.${name}`, `${name.slice(0, 20)}%`]).catch(() => null);
    const reg = await client.query('SELECT to_regclass($1) AS reg', [`public.${t}`]);
    console.log(`${t}: tabla=${reg.rows[0].reg ?? 'NO EXISTE'}`);
  }
  const cols = await client.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('aliexpressId','aliexpressShippingUsdCents','supplierVariantId') ORDER BY 1,2");
  console.log('== COLUMNAS CLAVE ==');
  console.log(cols.rows.map(r => `${r.table_name}.${r.column_name}`).join('\n'));
  const migrations = await client.query(
    'SELECT migration_name, started_at, finished_at, applied_steps_count, logs FROM _prisma_migrations ORDER BY migration_name, started_at');
  console.log('== MIGRACIONES ==');
  for (const m of migrations.rows) {
    console.log(`${m.migration_name} finished=${m.finished_at ? 'SI' : 'NO'} logs=${(m.logs || '').slice(0, 120)}`);
  }
  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
