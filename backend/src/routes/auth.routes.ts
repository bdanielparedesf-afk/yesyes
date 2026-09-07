import { Router, Request as ExpressRequest, Response, NextFunction } from 'express';
import { handleAuth, handleAuthError } from '../lib/auth-handler';
import { logger } from '../utils/logger';
import { registerUser, loginUser, generateToken, verifyEmail, createVerificationToken, sendVerificationEmail, getCurrentUser, registerSchema, loginSchema } from '../services/auth.service';
import { loginLimiter } from '../middlewares/rateLimiter';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();

router.post('/register', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: validation.error.errors?.[0]?.message || 'Error de validación' });
      return;
    }

    const { name, lastName, email, password } = validation.data;

    if (email.toLowerCase().trim() === ADMIN_EMAIL) {
      res.status(400).json({ message: 'Correo reservado para admin' });
      return;
    }

    const user = await registerUser({ name, lastName, email, password });
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      token,
      verificationToken: (user as any).verificationToken,
      emailVerified: false,
      message: 'Cuenta creada. Revisa tu email para verificar tu cuenta.',
    });
  } catch (error: any) {
    if (error.message === 'El email ya está registrado') {
      res.status(409).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.post('/login', loginLimiter, async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: validation.error.errors?.[0]?.message || 'Error de validación' });
      return;
    }

    const { email, password } = validation.data;

    const result = await loginUser(email, password);

    res.status(200).json({
      id: result.id,
      email: result.email,
      name: result.name,
      lastName: result.lastName,
      token: result.token,
      emailVerified: result.emailVerified,
      role: result.role,
    });
  } catch (error: any) {
    if (error.message === 'Credenciales inválidas' || error.message === 'Cuenta desactivada') {
      res.status(401).json({ message: error.message });
      return;
    }
    if (error.message === 'EMAIL_NOT_VERIFIED') {
      res.status(403).json({ message: 'EMAIL_NOT_VERIFIED', detail: 'Debes verificar tu email antes de iniciar sesión' });
      return;
    }
    if (error.message.includes('Google')) {
      res.status(403).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.get('/me', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No autorizado: token faltante' });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      res.status(500).json({ message: 'Error de configuración del servidor' });
      return;
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET as string;
    const decoded = (jwt.default.verify as any)(token, jwtSecret) as unknown as { id: string };

    const user = await getCurrentUser(decoded.id);
    if (!user) {
      res.status(401).json({ message: 'No autorizado: usuario inválido o inactivo' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ message: 'No autorizado: token inválido' });
  }
});

router.get('/verify-email', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/verificar-email?error=${encodeURIComponent('Token de verificación requerido')}`);
      return;
    }

    await verifyEmail(token);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/verificar-email?success=true`);
  } catch (error: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const message = error.message === 'Token de verificación inválido' || error.message === 'El token de verificación ha expirado'
      ? error.message
      : 'Error al verificar el email';
    res.redirect(`${frontendUrl}/verificar-email?error=${encodeURIComponent(message)}`);
  }
});

router.post('/resend-verification', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email requerido' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(200).json({ message: 'Si el email existe, recibirás un nuevo enlace de verificación' });
      return;
    }

    if (user.emailVerified) {
      res.status(200).json({ message: 'La cuenta ya está verificada' });
      return;
    }

    const verificationToken = await createVerificationToken(user.id);
    await sendVerificationEmail(user.email, verificationToken);

    res.status(200).json({ message: 'Email de verificación enviado' });
  } catch (error: any) {
    next(error);
  }
});

router.post('/forgot-password', (req: ExpressRequest, res: Response) => {
  res.status(200).json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
});

router.post('/signout', async (req: ExpressRequest, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  res.cookie('authjs.session-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  res.cookie('authjs.csrf-token', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  res.json({ redirectTo: frontendUrl });
});

router.get('/error', async (req: ExpressRequest, res: Response) => {
  const authResponse = await handleAuthError(req as unknown as Request);
  const body = await authResponse.text();
  res.status(authResponse.status);
  res.setHeader('Content-Type', 'application/json');
  res.send(body);
});

router.use('*', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const host = req.get('host') || 'localhost';
    const protocol = req.protocol || 'http';
    const url = `${protocol}://${host}${req.originalUrl}`;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'content-length') continue;
      if (key.toLowerCase() === 'host') continue;
      if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      } else if (value !== undefined && value !== null) {
        headers[key] = String(value);
      }
    }

    let body: string | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        const contentType = headers['content-type'] || headers['Content-Type'];
        if (contentType?.includes('application/x-www-form-urlencoded')) {
          body = new URLSearchParams(req.body as Record<string, string>).toString();
        } else {
          body = JSON.stringify(req.body);
        }
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        body = req.body;
      }
    }

    const fetchRequest = new globalThis.Request(url, {
      method: req.method,
      headers,
      body,
    });

    const response = await handleAuth(fetchRequest);

    res.status(response.status);

    let setCookies: string[] = [];
    if (typeof (response.headers as any).getSetCookie === 'function') {
      setCookies = (response.headers as any).getSetCookie();
    } else {
      const rawHeaders = (response.headers as any).raw?.();
      if (rawHeaders && typeof rawHeaders === 'object') {
        const rawSetCookies = rawHeaders['set-cookie'];
        if (Array.isArray(rawSetCookies)) {
          setCookies = rawSetCookies;
        }
      }
      if (setCookies.length === 0) {
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          setCookies = [setCookieHeader];
        }
      }
    }

    if (setCookies.length > 0) {
      for (const cookie of setCookies) {
        res.append('Set-Cookie', cookie);
      }
    }

    response.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() !== 'set-cookie') {
        res.setHeader(key, value);
      }
    });

    const data = await response.text();
    if (data) {
      res.end(data);
    } else {
      res.end();
    }
  } catch (error) {
    logger.error('Auth route error', error);
    next(error);
  }
});

export default router;
