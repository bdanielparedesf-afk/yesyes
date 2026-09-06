import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Resuelve la URL base de la API garantizando el prefijo `/api`.
 *
 * La API siempre vive bajo `/api`:
 *   - Desarrollo:  http://localhost:3001/api
 *   - Producción:  https://api.yesyes.cl/api
 *
 * Si `VITE_API_URL` está configurada sin el sufijo `/api`
 * (ej: https://api.yesyes.cl), se agrega automáticamente para evitar
 * llamadas a rutas inexistentes que devuelven 404 con HTML.
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) return '/api';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api')) return trimmed;
  return `${trimmed}/api`;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().setUser(null);
    }
    return Promise.reject(error);
  }
);

export default api;
