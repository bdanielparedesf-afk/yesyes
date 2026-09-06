import { Router, Request as ExpressRequest, Response, NextFunction } from 'express';
import { handleAuth } from '../lib/auth';
import { logger } from '../utils/logger';
import { registerUser, loginUser, generateToken } from '../services/auth.service';

const router = Router();

router.post('/register', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const { name, lastName, email, password, confirmPassword } = req.body;

    if (!name || !lastName || !email || !password || !confirmPassword) {
      res.status(400).json({ message: 'Todos los campos son obligatorios' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ message: 'Las contraseñas no coinciden' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
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
    });
  } catch (error: any) {
    if (error.message === 'El email ya está registrado') {
      res.status(409).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.post('/login', async (req: ExpressRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email y contraseña son obligatorios' });
      return;
    }

    const result = await loginUser(email, password);

    res.status(200).json({
      id: result.id,
      email: result.email,
      name: result.name,
      lastName: result.lastName,
      token: result.token,
    });
  } catch (error: any) {
    if (error.message === 'Credenciales inválidas' || error.message === 'Cuenta desactivada') {
      res.status(401).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.post('/forgot-password', (req: ExpressRequest, res: Response) => {
  res.status(200).json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
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

    const fetchRequest = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    const response = await handleAuth(fetchRequest);

    res.status(response.status);

    const setCookies = (response.headers as any).getSetCookie?.() || [];
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
