# Deployment - YESYES

## Requisitos previos

- Node.js >= 18
- PostgreSQL
- Cuenta Mercado Pago (producción)
- Firebase Project
- Google OAuth credentials
- Dominio y SSL

## Variables de entorno

Ver `.env.example` para la lista completa.

## Backend

### Desarrollo
```bash
cd backend
npm install
cp ../.env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

### Producción
```bash
cd backend
npm install --production
npm run build
npm run db:migrate
npm start
```

Recomendado usar PM2 o Docker.

## Frontend

### Desarrollo
```bash
cd frontend
npm install
npm run dev
```

### Producción
```bash
cd frontend
npm install
npm run build
npm run preview
```

El build se sirve desde cualquier CDN o servidor estático.

## Base de datos

### Backup
```bash
pg_dump -U yesyes yesyes > backup.sql
```

### Restauración
```bash
psql -U yesyes yesyes < backup.sql
```

### Migraciones
```bash
cd backend
npm run db:migrate
```

## Checklist producción

- [ ] Variables de entorno configuradas
- [ ] HTTPS activo
- [ ] Mercado Pago en modo producción
- [ ] Firebase configurado
- [ ] Google OAuth verificado
- [ ] Webhooks configurados y verificados
- [ ] Backups automáticos
- [ ] Logs centralizados
- [ ] Monitoreo activo
- [ ] Tests pasando
- [ ] Responsive verificado
- [ ] Performance verificado
- [ ] Legal revisado (términos, privacidad, SII)

## Vercel — Redeploy sin cache

Después de agregar o cambiar variables de entorno en el Dashboard de Vercel, el deploy anterior puede usar cache. Sigue estos pasos:

1. **Vercel Dashboard** > Settings > Environment Variables
   - Asegúrate de que las vars críticas estén en **Production, Preview y Development**:
     - `AUTH_SECRET` / `NEXTAUTH_SECRET` (mismo valor)
     - `JWT_SECRET`
     - `NEXTAUTH_URL=https://api.yesyes.cl`
     - `AUTH_URL=https://api.yesyes.cl`
     - `FRONTEND_URL=https://yesyes.cl`
     - `BACKEND_URL=https://api.yesyes.cl`
     - `DATABASE_URL`
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `ADMIN_EMAIL=bdanielparedesf@gmail.com`
     - `AUTH_TRUST_HOST=true`

2. **Redeploy sin cache** (elige uno):
   - Opción A (recomendada): Dashboard > Deployments > ⋯ > **Redeploy** > "Redeploy" (esto fuerza un nuevo build con las vars actualizadas).
   - Opción B: `vercel --force` desde CLI después de instalar `vercel`.
   - Opción C: Haz un commit vacío o con un cambio trivial y ve al Dashboard > Deployments > "Deploy" (Production Branch).

3. **Verifica**:
   ```bash
   curl -I https://api.yesyes.cl/api/auth/google
   ```
   Debe devolver `HTTP/2 200` (o 302 a Google). Si vuelve `error=Configuration`, faltan ENV en Vercel.

4. **Limpia cache del navegador**: borra cookies de `authjs.session-token` y `authjs.csrf-token` en `yesyes.cl` y `api.yesyes.cl`.

## Google OAuth

Ver `GOOGLE_OAUTH_CHECKLIST.md` para las URIs y origins exactos que deben estar en Google Cloud Console.
