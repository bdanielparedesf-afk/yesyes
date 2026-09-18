// One-off recovery: the dropship-catalog migration was registered in
// _prisma_migrations WITHOUT executing (drift). This script:
//  1) deletes failed migration bookkeeping rows for the sync-engine migration;
//  2) executes both additive-only SQL files (all statements are IF NOT EXISTS
//     / ADD COLUMN IF NOT EXISTS → zero data risk, idempotent);
//  3) registers them as applied.
// Run: node scripts/db-apply-migrations.cjs
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

const FILES = [
  { name: '20260917000000_aliexpress_dropship_catalog',
    path: 'prisma/migrations/20260917000000_aliexpress_dropship_catalog/migration.sql' },
  { name: '20260918000000_aliexpress_sync_engine',
    path: 'prisma/migrations/20260918000000_aliexpress_sync_engine/migration.sql' },
];

(async () => {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) { console.error('Sin DIRECT_URL/DATABASE_URL'); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM _prisma_migrations WHERE migration_name = '20260918000000_aliexpress_sync_engine'");
  for (const file of FILES) {
    const sql = fs.readFileSync(file.path, 'utf8');
    await client.query(sql); // simple query protocol: executes all statements atomically per statement
    console.log(`EJECUTADO: ${file.name}`);
  }
  for (const file of FILES) {
    const exists = await client.query('SELECT 1 FROM _prisma_migrations WHERE migration_name = $1', [file.name]);
    if (!exists.rowCount) {
      await client.query(
        'INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count) VALUES (gen_random_uuid()::text, \'\', $1, \'\', now(), now(), 1)',
        [file.name]);
    } else {
      await client.query('UPDATE _prisma_migrations SET finished_at = now(), logs = \'\' WHERE migration_name = $1', [file.name]);
    }
    console.log(`REGISTRADO: ${file.name}`);
  }
  for (const t of ['aliexpress_sync_logs', 'aliexpress_sync_settings', 'aliexpress_import_jobs',
    'aliexpress_import_job_items', 'aliexpress_order_snapshots']) {
    const reg = await client.query('SELECT to_regclass($1) AS reg', [`public.${t}`]);
    console.log(`${t}: ${reg.rows[0].reg ?? 'NO EXISTE'}`);
  }
  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
