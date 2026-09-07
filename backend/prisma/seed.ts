import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('YESYES database seed started...');
  
  const category = await prisma.category.upsert({
    where: { slug: 'general' },
    update: {},
    create: {
      name: 'General',
      slug: 'general',
      description: 'Categoría general de productos',
      active: true,
    },
  });

  // Crear usuario admin
  const adminEmail = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD no está configurado en las variables de entorno');
  }
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    // Actualizar rol a ADMIN si no lo tiene
    if (existingAdmin.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: 'ADMIN', emailVerified: true },
      });
      console.log(`Usuario ${adminEmail} actualizado a ADMIN`);
    } else {
      console.log(`Usuario admin ${adminEmail} ya existe y tiene rol ADMIN`);
    }
  } else {
    // Crear nuevo usuario admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        lastName: 'YESYES',
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: true,
        isActive: true,
      },
    });
    console.log(`Usuario admin ${adminEmail} creado`);
  }

  console.log('Seed completed:', { category: category.name });
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
