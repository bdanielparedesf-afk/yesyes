/**
 * Garantiza que la cuenta admin exista y pueda entrar siempre:
 *  - La crea si no existe.
 *  - Le pone la contraseña de ADMIN_PASSWORD (hash bcrypt).
 *  - role=ADMIN, emailVerified=true, isActive=true.
 *
 * Uso (desde /backend):  npx tsx scripts/ensure-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD no está configurada');

  const hashed = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashed,
        role: 'ADMIN',
        emailVerified: true,
        isActive: true,
      },
    });
    console.log(`[ensure-admin] Actualizado: ${ADMIN_EMAIL} (id=${existing.id})`);
  } else {
    const created = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'Daniel',
        lastName: 'Paredes',
        password: hashed,
        role: 'ADMIN',
        emailVerified: true,
        isActive: true,
      },
    });
    console.log(`[ensure-admin] Creado: ${ADMIN_EMAIL} (id=${created.id})`);
  }

  const check = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  const passwordOk = check?.password ? await bcrypt.compare(password, check.password) : false;
  console.log(
    `[ensure-admin] Verificación → role=${check?.role} emailVerified=${check?.emailVerified} isActive=${check?.isActive} googleId=${check?.googleId ?? '(ninguno)'} password=${passwordOk ? 'OK' : 'FALLA'}`
  );
  if (!passwordOk || check?.role !== 'ADMIN') {
    throw new Error('La verificación posterior falló');
  }
}

main()
  .catch((e) => {
    console.error('[ensure-admin] ERROR:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });