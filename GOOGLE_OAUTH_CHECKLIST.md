# Google OAuth Checklist

Configuración requerida en **Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client > Authorized redirect URIs** y **Authorized JavaScript origins**.

## Authorized redirect URIs (2)

1. `http://localhost:3001/api/auth/callback/google`
2. `https://api.yesyes.cl/api/auth/callback/google`

## Authorized JavaScript origins (4)

1. `http://localhost:3001`
2. `http://localhost:5173`
3. `https://api.yesyes.cl`
4. `https://yesyes.cl`

## Pasos

1. Ve a https://console.cloud.google.com/
2. Selecciona el proyecto YESYES.
3. APIs & Services > Credentials.
4. Crea un OAuth 2.0 Client ID (aplicación web).
5. Origen JavaScript autorizado: `https://yesyes.cl`, `https://api.yesyes.cl`, `http://localhost:5173`, `http://localhost:3001`.
6. URI de redirección autorizada: `https://api.yesyes.cl/api/auth/callback/google` y `http://localhost:3001/api/auth/callback/google`.
7. Copia el Client ID y Client Secret a Vercel > Settings > Environment Variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
8. Habilita la API de Google (Google People API / OAuth consent screen).

## Nota

- El callback llega a `api.yesyes.cl/api/auth/callback/google` → `backend/src/index.ts` (rewrite `/api/*`).
- `AUTH_TRUST_HOST=true` en Vercel para que NextAuth acepte el host.
- Frontend URL: `https://yesyes.cl`. Backend URL: `https://api.yesyes.cl`.