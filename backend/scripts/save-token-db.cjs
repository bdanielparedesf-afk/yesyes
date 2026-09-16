import { prisma } from './lib/prisma';

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "aliexpress_tokens" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      account TEXT NOT NULL,
      seller_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      refresh_expires_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('Table created:', result);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const refreshExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const insertResult = await prisma.$executeRawUnsafe(`
    INSERT INTO "aliexpress_tokens" (account, seller_id, access_token, refresh_token, expires_at, refresh_expires_at, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (account) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      refresh_expires_at = EXCLUDED.refresh_expires_at,
      is_active = true,
      updated_at = now()
  `, 'google_112734970190422978939@aliexpress.com', '2441704508',
    '50000801723j49moatuiZbEu3sSuHKILl3G1e967430yuDdWkxsCRpWynO0PexIZ7udp',
    '50001801723j49moatuiZbEu3sSuHKILl3G1d95ee04yuDdWkxsCRpWynO0PexIZ7udp',
    expiresAt.toISOString(), refreshExpiresAt.toISOString());
  console.log('Token inserted:', insertResult);

  const verify = await prisma.$queryRawUnsafe(`
    SELECT id, account, seller_id, is_active, expires_at, refresh_expires_at
    FROM "aliexpress_tokens"
    WHERE account = $1
  `, 'google_112734970190422978939@aliexpress.com');
  console.log('Verified:', JSON.stringify(verify, null, 2));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
