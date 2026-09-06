import api from '@/lib/axios';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
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
  const res = await fetch(authUrl('/csrf'), { credentials: 'include' });
  const { csrfToken } = await res.json();
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${authUrl(`/signin/${provider}`)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'csrfToken';
  input.value = csrfToken;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

export async function signOut(callbackUrl = '/login') {
  const url = `${authUrl('/signout')}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  window.location.href = url;
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
