import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    // 1. Check products columns
    const cols = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position"
    );
    console.log('PRODUCTS COLUMNS:', JSON.stringify((cols as any[]).map((c: any) => c.column_name)));

    // 2. Check products count and status
    const prodResult: any[] = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*)::text as total, COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END)::text as published, COUNT(CASE WHEN hidden = false THEN 1 END)::text as visible FROM products"
    );
    console.log('PRODUCTS:', JSON.stringify(prodResult));

    // 3. Sample products
    const sampleProds: any[] = await prisma.$queryRawUnsafe(
      'SELECT id, name, slug, status, hidden, "salePrice", stock FROM products ORDER BY "createdAt" DESC LIMIT 5'
    );
    console.log('SAMPLE PRODUCTS:', JSON.stringify(sampleProds));

    // 3. Check users columns
    const userCols = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
    );
    console.log('USERS COLUMNS:', JSON.stringify((userCols as any[]).map((c: any) => c.column_name)));

    // 4. Check admin user
    const adminResult: any[] = await prisma.$queryRawUnsafe(
      "SELECT id, email, role, \"emailVerified\", \"isActive\", (password IS NOT NULL) as has_password FROM users WHERE email = 'bdanielparedesf@gmail.com'"
    );
    console.log('ADMIN USER:', JSON.stringify(adminResult));

    // 5. Check all users
    const allUsers: any[] = await prisma.$queryRawUnsafe(
      'SELECT id, email, role, "emailVerified", "isActive" FROM users'
    );
    console.log('ALL USERS:', JSON.stringify(allUsers));

    // 5. Check table names
    const tables = await prisma.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log('ALL TABLES:', JSON.stringify((tables as any[]).map((t: any) => t.tablename)));

  } catch (e: any) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
