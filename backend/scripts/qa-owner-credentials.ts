/** READ-ONLY: la cuenta de la pagina real tiene credenciales utilizables? */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const b = await prisma.business.findUnique({
    where: { slug: 'clinica-veterinaria-los-robles-14' },
    select: { id: true, slug: true, status: true, ownerId: true, publishedAt: true },
  });
  if (!b) { console.log('no existe'); return; }
  const owner = await prisma.user.findUnique({ where: { id: b.ownerId }, select: { email: true, password: true, isActive: true, role: true } });
  console.log(JSON.stringify({ business: b, owner: { ...owner, password: owner?.password ? 'SET' : null } }, null, 1));
}

main().finally(() => prisma.$disconnect());
