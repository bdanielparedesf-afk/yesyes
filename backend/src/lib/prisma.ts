import { PrismaClient } from '@prisma/client';

/**
 * Normaliza la DATABASE_URL para que funcione de forma fiable con el pooler de
 * Supabase (PgBouncer en modo transaccional, puerto 6543).
 *
 * Sin `pgbouncer=true`, Prisma usa prepared statements con nombre (s0, s1, ...).
 * Con PgBouncer en modo transacción varias conexiones lógicas comparten la misma
 * conexión física del servidor y aparece el error:
 *   `prepared statement "s0" already exists` (42P05)
 * que rompía el login (y cualquier consulta) en producción.
 *
 * Forzamos:
 *   - pgbouncer=true      → Prisma NO usa prepared statements con nombre.
 *   - connection_limit=1  → una conexión por instancia de la función serverless.
 */
function normalizeDatabaseUrl(url?: string): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    const isPooler = u.hostname.includes('pooler.supabase') || u.port === '6543';
    if (!isPooler) return url;
    if (u.searchParams.get('pgbouncer') !== 'true') {
      u.searchParams.set('pgbouncer', 'true');
    }
    if (!u.searchParams.get('connection_limit')) {
      u.searchParams.set('connection_limit', '1');
    }
    return u.toString();
  } catch {
    return url;
  }
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
if (databaseUrl && databaseUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

/**
 * UNA sola instancia de PrismaClient por proceso.
 *
 * Antes cada módulo (controllers, routes, services, middlewares, auth-handler)
 * creaba su propio `new PrismaClient()`: hasta 9 pools simultáneos que, sobre
 * PgBouncer, colisionaban entre sí y provocaban el error 42P05. El singleton
 * además reutiliza el pool en cada invocación "warm" de la función serverless.
 */
const globalForPrisma = globalThis as unknown as { __yesyesPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__yesyesPrisma ??
  new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined
  );

globalForPrisma.__yesyesPrisma = prisma;

export default prisma;
