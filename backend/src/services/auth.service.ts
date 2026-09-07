import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado en las variables de entorno');
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string, email: string, role: string = 'CUSTOMER'): string => {
  return jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

export const createVerificationToken = async (userId: string): Promise<string> => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
};

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
    return true;
  }

  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { emailVerified: true },
  });

  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  return true;
};

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verificar-email?token=${token}`;

  console.log(`[Email] Verification link for ${email}: ${verificationUrl}`);
};

export const registerUser = async (data: {
  name: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ id: string; email: string; name: string; lastName: string; verificationToken: string }> => {
  const normalizedEmail = data.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new Error('El email ya está registrado');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      lastName: data.lastName.trim(),
      email: normalizedEmail,
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
  role: string;
}> => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.password) {
    throw new Error('Credenciales inválidas');
  }

  if (!user.isActive) {
    throw new Error('Cuenta desactivada');
  }

  if (user.googleId && !user.password) {
    throw new Error('Esta cuenta está registrada con Google. Inicia sesión con Google.');
  }

  const isValid = await comparePasswords(password, user.password);

  if (!isValid) {
    throw new Error('Credenciales inválidas');
  }

  if (!user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  const role = user.email.toLowerCase().trim() === ADMIN_EMAIL ? 'ADMIN' : user.role;
  const token = generateToken(user.id, user.email, role);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    token,
    emailVerified: user.emailVerified,
    role,
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      lastName: true,
      role: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
};

export const registerSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});
