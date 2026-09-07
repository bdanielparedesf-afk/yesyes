import rateLimit from 'express-rate-limit';

// En serverless (Vercel) cada cold start reinicia el contador en memoria,
// por lo que los límites son por instancia. Usar valores generosos para evitar
// bloqueos durante desarrollo y testing, manteniendo protección básica.
const isServerless = process.env.VERCEL === '1';

function clientKeyGenerator(req: any) {
  // Usa el IP real detrás del proxy de Vercel/Edge
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKeyGenerator,
  // En serverless, el store en memoria es por-instancia: los límites se
  // aplican solo dentro de una sesión warm. No bloquear por debajo del
  // límite general para evitar falsos positivos en despliegues serverless.
  message: {
    status: 'error',
    message: 'Demasiadas solicitudes, intenta de nuevo más tarde.',
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isServerless ? 100 : 20,  // Más permisivo en serverless (cold starts reinician el contador)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKeyGenerator,
  message: {
    status: 'error',
    message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
  },
});
