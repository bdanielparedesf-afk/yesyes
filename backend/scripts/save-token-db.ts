import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "aliexpress_tokens"`);
  console.log('Table dropped (if existed)');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "aliexpress_tokens" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      account TEXT NOT NULL UNIQUE,
      seller_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      refresh_expires_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('Table created');

  await prisma.$executeRawUnsafe(`
    INSERT INTO "aliexpress_tokens" (account, seller_id, access_token, refresh_token, expires_at, refresh_expires_at, is_active)
    VALUES ($1, $2, $3, $4, to_timestamp($5), to_timestamp($6), true)
  `, 'google_112734970190422978939@aliexpress.com', '2441704508',
    '50000801436djVksdjvfuoGbbiQ4PWYeklwoxhrSll0kwpBS1c11854fqXuFM4cNLq0h',
    '50001801836xnEuYsqiceaT8kzUdKIyi0lT0BgxiQxevwwQu11c2ea3coX0YOkxtC8SN',
    Math.floor(Date.now() / 1000) + 86400,
    Math.floor(Date.now() / 1000) + 171612);
  console.log('Token saved');

  const verify = await prisma.$queryRawUnsafe(`
    SELECT id, account, seller_id, is_active, expires_at, refresh_expires_at
    FROM "aliexpress_tokens"
    WHERE account = $1
  `, 'google_112734970190422978939@aliexpress.com');
  console.log('Verified:', JSON.stringify(verify, null, 2));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
