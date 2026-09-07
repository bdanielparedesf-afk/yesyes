# Vercel Domains

Este proyecto está desplegado en Vercel como **monorepo** con 2 dominios custom:

## Dominios requeridos (agregar en Vercel > Settings > Domains)

1. **Frontend**: `yesyes.cl`
   - Proyecto: yesyes (raíz del repo)
   - Sirve `frontend/dist` (Vite SPA)

2. **Backend**: `api.yesyes.cl`
   - Proyecto: yesyes (raíz del repo, mismo proyecto)
   - Sirve `api/index.js` → `backend/dist/index.js` (Express + @auth/core)
   - Rutas `/api/*` redirigen al backend

## Flujo de request OAuth Google

```
https://yesyes.cl → frontend (Vite SPA)
   ↓ /api/auth/callback/google
https://api.yesyes.cl/api/auth/callback/google → backend/src/index.ts
   ↓ @auth/core procesa el callback
```

## Configuración DNS

Asegúrate de que:
- `yesyes.cl` apunte al frontend de Vercel
- `api.yesyes.cl` apunte al backend de Vercel
- `www.yesyes.cl` redirija a `yesyes.cl` (ver `vercel.json` raíz)

## Variables de entorno (Vercel > Settings > Environment Variables)

Ver `.env.production.example` para la lista completa. Las vars críticas son:

- `AUTH_SECRET` (mismo que `NEXTAUTH_SECRET`)
- `JWT_SECRET`
- `NEXTAUTH_URL=https://api.yesyes.cl`
- `AUTH_URL=https://api.yesyes.cl`
- `FRONTEND_URL=https://yesyes.cl`
- `BACKEND_URL=https://api.yesyes.cl`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAIL`
- `AUTH_TRUST_HOST=true`

Aplica las mismas vars en **Production, Preview y Development**.