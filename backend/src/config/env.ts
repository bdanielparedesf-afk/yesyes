import dotenv from 'dotenv';

dotenv.config();

const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production' || isVercel;
const isLocal = !isProduction;

if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}

if (isLocal) {
  const port =
    process.env.PORT && /^\d+$/.test(process.env.PORT) ? process.env.PORT : '3001';
  const localBackendUrl = `http://localhost:${port}`;
  process.env.AUTH_URL = localBackendUrl;
  process.env.NEXTAUTH_URL = localBackendUrl;
}

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    console.error(
      '[AUTH_CONFIG_ERROR] Missing: ' +
        [
          !process.env.AUTH_SECRET ? 'AUTH_SECRET' : '',
          !process.env.NEXTAUTH_SECRET ? 'NEXTAUTH_SECRET' : '',
        ]
          .filter(Boolean)
          .join(', '),
    );
  } else if (authSecret.length < 32) {
    throw new Error(
      `[config/env] AUTH_SECRET/NEXTAUTH_SECRET es demasiado corto (${authSecret.length} chars, mínimo 32).\n` +
        'Auth.js v5 requiere un secreto de al menos 32 caracteres para firmar cookies y JWTs.\n' +
        'Genera uno nuevo con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && !isVercel) {
  console.warn('[config/env] DATABASE_URL no está configurada.');
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('[config/env] JWT_SECRET no está configurado en las variables de entorno.');
}

if (jwtSecret.length < 32) {
  console.warn('[config/env] JWT_SECRET debería tener al menos 32 caracteres.');
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!isProduction && !corsOrigins.includes('http://localhost:5173')) {
  corsOrigins.push('http://localhost:5173');
}

const adminEmail = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();
if (!adminEmail.includes('@')) {
  console.warn('[config/env] ADMIN_EMAIL no parece un email válido.');
}

export const env = {
  isProduction,
  isLocal,
  isVercel,
  port: Number(process.env.PORT) || 3001,
  authSecret,
  corsOrigins,
  adminEmail,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || `http://localhost:${Number(process.env.PORT) || 3001}`,
};

export default env;
