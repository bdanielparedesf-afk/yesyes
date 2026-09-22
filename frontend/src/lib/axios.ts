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
    // El interceptor global solo limpia la sesión cuando la request YA llevaba
    // un Bearer token inválido/expirado. Antes limpiaba en CUALQUIER 401,
    // incluido el /auth/session sin cookie (visitante anónimo) o un login con
    // credenciales erróneas: borraba el token recién guardado en el store
    // persistido (zustand) y el usuario quedaba deslogueado tras loguearse.
    // Google no se toca: usa cookie de sesión, no Bearer.
    if (error.response?.status === 401) {
      const hadBearer = Boolean(
        error.config?.headers?.Authorization ||
          (error.config?.headers as any)?.authorization,
      );
      const url = String(error.config?.url || '');
      const isAuthFlow = url.includes('/auth/login') || url.includes('/auth/session');
      if (hadBearer && !isAuthFlow) {
        try {
          useAuthStore.getState().setUser(null);
        } catch {
          // store no listo → ignorar
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
