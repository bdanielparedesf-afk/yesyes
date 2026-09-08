/**
 * Simula la sesión que Auth.js crearía después del callback de Google.
 *
 * Genera EXACTAMENTE el mismo JWE que @auth/core guarda en la cookie
 * `authjs.session-token` tras un login con Google exitoso (misma clave
 * derivada de AUTH_SECRET y mismo salt), para poder probar de punta a punta
 * /auth/session y las rutas admin sin pasar por la pantalla de Google.
 *
 * Uso:  npx tsx scripts/simulate-google-session.ts [email]
 * Imprime el token por stdout.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const email = (process.argv[2] || process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com')
  .toLowerCase()
  .trim();
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

async function main() {
  if (!secret) throw new Error('Falta AUTH_SECRET/NEXTAUTH_SECRET');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Usuario ${email} no existe en la BD`);

  const { encode } = await import('@auth/core/jwt');

  // Payload equivalente al del jwt callback de auth-handler.ts
  const token = await encode({
    token: {
      id: user.id,
      sub: user.id,
      name: `${user.name} ${user.lastName}`.trim(),
      email: user.email,
      picture: user.avatar || null,
      role: user.role,
    },
    secret,
    salt: 'authjs.session-token',
  });

  console.log(token);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });