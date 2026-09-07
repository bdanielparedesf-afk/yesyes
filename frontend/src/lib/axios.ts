import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Resuelve la URL base de la API. Siempre es el mismo origen bajo `/api`:
 *   - Desarrollo:  vite proxya `/api` → http://localhost:3001
 *   - Producción:  Vercel reescribe `/api/*` → serverless function del backend
 *
 * Mantener todo en el mismo origen evita problemas de CORS y de cookies
 * entre subdominios (no depende de VITE_API_URL / api.yesyes.cl).
 */
function resolveApiBaseUrl(): string {
  return '/api';
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
