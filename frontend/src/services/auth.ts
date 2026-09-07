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

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

/** Construye URLs de Auth.js sobre la base de la API (ej: /api/auth/csrf). */
export function authUrl(path: string): string {
  return `${API_BASE}/auth${path.startsWith('/') ? path : `/${path}`}`;
}

export async function signIn(provider: 'google' | 'github' | string = 'google', callbackUrl = '/') {
  // Para proveedores OAuth (Google, GitHub), usar navegación directa (GET)
  // Auth.js maneja la protección CSRF con el parámetro state
  window.location.href = `${authUrl(`/signin/${provider}`)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export async function signOut(callbackUrl = '/') {
  try {
    const csrfRes = await api.get('/auth/csrf', { withCredentials: true });
    const csrfToken = csrfRes.data?.csrfToken;
    if (csrfToken) {
      await api.post('/auth/signout', { csrfToken, callbackUrl }, { withCredentials: true });
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
