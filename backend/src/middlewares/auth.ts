import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || '';

interface TokenPayload extends JwtPayload {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    lastName: string;
    role: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No autorizado: token faltante' });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!JWT_SECRET) {
      res.status(500).json({ message: 'Error de configuración del servidor' });
      return;
    }

    const decoded = (jwt.verify as any)(token, JWT_SECRET) as unknown as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'No autorizado: usuario inválido o inactivo' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: 'No autorizado: token inválido' });
  }
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!JWT_SECRET) {
      next();
      return;
    }

    const decoded = (jwt.verify as any)(token, JWT_SECRET) as unknown as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        role: user.role,
      };
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ message: 'Prohibido: se requiere rol de administrador' });
    return;
  }
  next();
};

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'No autorizado' });
    return;
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();
  if (req.user.email.toLowerCase().trim() !== adminEmail) {
    res.status(403).json({ message: 'Prohibido: se requiere rol de administrador' });
    return;
  }

  next();
};
