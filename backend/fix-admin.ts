import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'bdanielparedesf@gmail.com';
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD no está configurado en las variables de entorno');
  }
  const adminPassword = process.env.ADMIN_PASSWORD;

  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!user) {
    console.log('Usuario no encontrado');
    return;
  }

  console.log(`Usuario encontrado: ${user.email}, role: ${user.role}`);

  // Actualizar contraseña
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  console.log('Contraseña actualizada');

  // Verificar que la contraseña funciona
  const updatedUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (updatedUser?.password) {
    const isValid = await bcrypt.compare(adminPassword, updatedUser.password);
    console.log(`Contraseña verificada: ${isValid ? 'CORRECTA' : 'INCORRECTA'}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });