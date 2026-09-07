# Google OAuth Checklist

Configuración requerida en **Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client > Authorized redirect URIs** y **Authorized JavaScript origins**.

> **Importante:** Todo el flujo OAuth ocurre en el dominio `https://yesyes.cl` (el frontend y el backend `/api/*` viven en el mismo proyecto de Vercel). El subdominio `api.yesyes.cl` NO se usa (su función de Vercel no está disponible/caída). Por eso el callback debe registrarse con `yesyes.cl`.

## Authorized redirect URIs (2)

1. `http://localhost:3001/api/auth/callback/google` (desarrollo local)
2. `https://yesyes.cl/api/auth/callback/google` (producción)

## Authorized JavaScript origins (3)

1. `http://localhost:5173`
2. `http://localhost:3001`
3. `https://yesyes.cl`

## Pasos

1. Ve a https://console.cloud.google.com/
2. Selecciona el proyecto YESYES.
3. APIs & Services > Credentials.
4. Crea un OAuth 2.0 Client ID (aplicación web).
5. Origen JavaScript autorizado: `https://yesyes.cl`, `http://localhost:5173`, `http://localhost:3001`.
6. URI de redirección autorizada: `https://yesyes.cl/api/auth/callback/google` y `http://localhost:3001/api/auth/callback/google`.
7. Copia el Client ID y Client Secret a Vercel > Settings > Environment Variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
8. Habilita la API de Google (Google People API / OAuth consent screen).

## Nota

- El callback llega a `yesyes.cl/api/auth/callback/google` → rewrite `/api/*` → serverless function → `@auth/core`.
- `AUTH_TRUST_HOST=true` en Vercel para que Auth.js acepte el host.
- El frontend usa siempre el mismo origen (`/api`) — ver `frontend/src/lib/axios.ts`.