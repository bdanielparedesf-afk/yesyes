import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || '';
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';

// Mismo truco de import dinámico que backend/src/lib/auth-handler.ts para que el
// bundler de Vercel no intente resolver `@auth/core` desde la raíz del repo.
const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;

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

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  lastName: true,
  role: true,
  isActive: true,
} as const;

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key || !value) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

async function loadAuthUser(userId: string): Promise<AuthRequest['user'] | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    lastName: user.lastName || '',
    role: user.role,
  };
}

/**
 * Autentica con la cookie de sesión de Auth.js (login con Google).
 *
 * Auth.js v5 almacena la sesión en una cookie JWE (`authjs.session-token`),
 * cifrada con A256CBC-HS512 usando una clave derivada de AUTH_SECRET y el
 * nombre de la cookie como salt. La desciframos con `@auth/core/jwt` para
 * obtener el `sub` (id de usuario) y así permitir que el admin (o la API)
 * funcione tras iniciar sesión con Google, sin necesidad de Bearer token.
 */
async function userFromAuthSession(req: Request): Promise<AuthRequest['user'] | null> {
  if (!AUTH_SECRET) return null;
  const cookies = parseCookies(req.headers.cookie as string | undefined);
  const sessionToken = cookies['authjs.session-token'] || cookies['__Secure-authjs.session-token'];
  if (!sessionToken) return null;

  try {
    const { decode } = await dynamicImport('@auth/core/jwt');
    const payload = await decode({
      token: sessionToken,
      secret: AUTH_SECRET,
      salt: 'authjs.session-token',
    });
    if (!payload) return null;

    // 1) Sesiones de credenciales: el token lleva el id de nuestra BD.
    const candidateIds = [payload.id, payload.sub].filter(Boolean).map(String);
    for (const id of candidateIds) {
      const user = await loadAuthUser(id);
      if (user) return user;
    }

    // 2) Sesiones de Google: `sub` es el id de la cuenta de Google, NO el id de la
    //    BD (no hay adapter). El JWT siempre incluye el email → buscamos por email.
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : '';
    if (email) {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: USER_SELECT,
      });
      if (dbUser?.isActive) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name || '',
          lastName: dbUser.lastName || '',
          role: dbUser.role,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // 1) Bearer token (login con email/contraseña / registro)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      if (!JWT_SECRET) {
        res.status(500).json({ message: 'Error de configuración del servidor' });
        return;
      }

      try {
        const decoded = (jwt.verify as any)(token, JWT_SECRET) as unknown as TokenPayload;
        const user = await loadAuthUser(decoded.id);
        if (!user) {
          res.status(401).json({ message: 'No autorizado: usuario inválido o inactivo' });
          return;
        }
        req.user = user;
        next();
        return;
      } catch {
        // Token inválido: caemos a la cookie de sesión por si acaso
      }
    }

    // 2) Cookie de sesión Auth.js (login con Google)
    const sessionUser = await userFromAuthSession(req);
    if (sessionUser) {
      req.user = sessionUser;
      next();
      return;
    }

    res.status(401).json({ message: 'No autorizado: token faltante' });
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
    const user = await loadAuthUser(decoded.id);
    if (user) {
      req.user = user;
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
