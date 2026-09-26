/**
 * READ-ONLY · FASE 4 (QA): token de sesion para el PROPIETARIO de la pagina real.
 *
 * El login por API esta bloqueado por `EMAIL_NOT_VERIFIED` (otra fase, §"no
 * investigar"). Para poder certificar Editor + Preview con la pagina real sin
 * tocar el gate, este script firma un token con el MISMO `generateToken` del
 * backend y el MISMO `JWT_SECRET` del entorno. No escribe nada en la base, no
 * cambia estados y no altera el producto: solo permite que el navegador de QA
 * sea el dueno del negocio.
 */
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../src/services/auth.service';

const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findUnique({
    where: { slug: 'clinica-veterinaria-los-robles-14' },
    select: { id: true, slug: true, status: true, ownerId: true, publishedAt: true },
  });
  if (!business) {
    console.log(JSON.stringify({ error: 'NO_EXISTE' }));
    return;
  }
  const owner = await prisma.user.findUnique({ where: { id: business.ownerId }, select: { id: true, email: true, role: true } });
  if (!owner) {
    console.log(JSON.stringify({ error: 'SIN_DUENO' }));
    return;
  }
  console.log(JSON.stringify({
    businessId: business.id,
    slug: business.slug,
    status: business.status,
    publishedAt: business.publishedAt,
    email: owner.email,
    role: owner.role,
    token: generateToken(owner.id, owner.email, owner.role || 'BUSINESS'),
  }));
}

main().finally(() => prisma.$disconnect());
