import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

export const registerUser = async (data: {
  name: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ id: string; email: string; name: string; lastName: string }> => {
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

  return user;
};

export const loginUser = async (email: string, password: string): Promise<{
  id: string;
  email: string;
  name: string;
  lastName: string;
  token: string;
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
  };
};
