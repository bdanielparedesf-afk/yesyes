import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado en las variables de entorno');
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string, email: string): string => {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

// Generar token de verificación de email
export const createVerificationToken = async (userId: string): Promise<string> => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
};

// Verificar email con token
export const verifyEmail = async (token: string): Promise<boolean> => {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken) {
    throw new Error('Token de verificación inválido');
  }

  if (verificationToken.expiresAt < new Date()) {
    throw new Error('El token de verificación ha expirado');
  }

  if (verificationToken.user.emailVerified) {
    return true; // Ya verificado
  }

  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { emailVerified: true },
  });

  // Eliminar token usado
  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  return true;
};

// Enviar email de verificación (simulado - en producción usar servicio como SendGrid, Resend, etc.)
export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verificar-email?token=${token}`;

  // En producción, aquí se enviaría el email real
  // Por ahora, logeamos el enlace para desarrollo
  console.log(`\n📧 VERIFICACIÓN DE EMAIL`);
  console.log(`   Para: ${email}`);
  console.log(`   Enlace: ${verificationUrl}`);
  console.log(`   Token: ${token}\n`);

  // TODO: Integrar con servicio de email (SendGrid, Resend, Mailgun, etc.)
  // Ejemplo con fetch a API de email:
  /*
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: 'noreply@yesyes.cl' },
      subject: 'Verifica tu cuenta en YESYES',
      content: [{
        type: 'text/html',
        value: `<h1>¡Bienvenido a YESYES!</h1><p>Haz clic <a href="${verificationUrl}">aquí</a> para verificar tu cuenta.</p>`
      }]
    })
  });
  */
};

export const registerUser = async (data: {
  name: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ id: string; email: string; name: string; lastName: string; verificationToken: string }> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('El email ya está registrado');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      emailVerified: false,
      role: 'CUSTOMER',
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      lastName: true,
    },
  });

  // Crear y enviar token de verificación
  const verificationToken = await createVerificationToken(user.id);
  await sendVerificationEmail(user.email, verificationToken);

  return { ...user, verificationToken };
};

export const loginUser = async (email: string, password: string): Promise<{
  id: string;
  email: string;
  name: string;
  lastName: string;
  token: string;
  emailVerified: boolean;
}> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.password) {
    throw new Error('Credenciales inválidas');
  }

  if (!user.isActive) {
    throw new Error('Cuenta desactivada');
  }

  const isValid = await comparePasswords(password, user.password);

  if (!isValid) {
    throw new Error('Credenciales inválidas');
  }

  const token = generateToken(user.id, user.email);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    token,
    emailVerified: user.emailVerified,
  };
};
