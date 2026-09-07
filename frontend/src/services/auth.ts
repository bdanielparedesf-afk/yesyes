import api from '@/lib/axios';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role?: string;
}

export interface Session {
  user: SessionUser;
  expires: string;
}

/**
 * La API siempre vive en el MISMO origen bajo `/api`:
 *   - Desarrollo: vite hace proxy de `/api` → http://localhost:3001
 *   - Producción: Vercel reescribe `/api/*` → serverless function del backend
 *
 * Usar el mismo origen evita problemas de CORS y de cookies entre subdominios,
 * y no depende de dominios adicionales (ej: api.yesyes.cl).
 */
const API_BASE = '/api';

/** Construye URLs de Auth.js sobre la base de la API (ej: /api/auth/csrf). */
export function authUrl(path: string): string {
  return `${API_BASE}/auth${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Inicia sesión con un proveedor OAuth (Google, GitHub).
 *
 * Auth.js v5 (@auth/core) ya NO soporta `GET /api/auth/signin/:provider`
 * (devuelve `UnknownAction` → error=Configuration). El flujo correcto es:
 *
 *   1) GET  /api/auth/csrf              → { csrfToken } (setea la cookie CSRF)
 *   2) POST /api/auth/signin/:provider  con { csrfToken, callbackUrl } y el
 *      header `X-Auth-Return-Redirect: true` → responde { url } (sin redirigir)
 *   3) window.location.href = url       → navega al consentimiento de Google
 */
export async function signIn(provider: 'google' | 'github' | string = 'google', callbackUrl = '/') {
  try {
    const csrfRes = await api.get('/auth/csrf', { withCredentials: true });
    const csrfToken = csrfRes.data?.csrfToken;
    if (!csrfToken) throw new Error('No se pudo obtener el token CSRF');

    const signInRes = await api.post(
      `/auth/signin/${provider}`,
      { csrfToken, callbackUrl },
      { withCredentials: true, headers: { 'X-Auth-Return-Redirect': 'true' } }
    );

    const redirectUrl = signInRes.data?.url;
    if (!redirectUrl) throw new Error('No se recibió la URL de autorización');

    window.location.href = redirectUrl;
  } catch (error) {
    console.error('Sign in error', error);
    window.location.href =
      '/login?error=' + encodeURIComponent('No se pudo iniciar sesión con Google. Intenta de nuevo.');
  }
}

export async function signOut(callbackUrl = '/') {
  try {
    const csrfRes = await api.get('/auth/csrf', { withCredentials: true });
    const csrfToken = csrfRes.data?.csrfToken;
    if (csrfToken) {
      try {
        await api.post('/auth/signout', { csrfToken, callbackUrl }, { withCredentials: true });
      } catch {
        // El servidor ya elimina las cookies; si falla, navegamos igualmente.
      }
    }
  } catch (error) {
    console.error('Logout error', error);
  } finally {
    window.location.href = callbackUrl;
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const res = await api.get('/auth/session', { withCredentials: true });
    if (res.status === 401 || res.status === 403) return null;
    const data = res.data;
    if (data?.user) return data as Session;
    return null;
  } catch {
    return null;
  }
}

export async function updateSession(): Promise<Session | null> {
  try {
    const res = await api.get('/auth/session?update=true', { withCredentials: true });
    if (res.status === 401 || res.status === 403) return null;
    const data = res.data;
    if (data?.user) return data as Session;
    return null;
  } catch {
    return null;
  }
}

export async function register(data: { name: string; lastName: string; email: string; password: string; confirmPassword?: string }) {
  const res = await api.post('/auth/register', data);
  return res.data;
}

export async function login(data: { email: string; password: string }) {
  const res = await api.post('/auth/login', data);
  return res.data;
}
