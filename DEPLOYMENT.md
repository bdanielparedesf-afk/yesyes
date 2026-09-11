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

## Vercel CLI — Auth y teams (propietario)

Estado observado en este entorno:

- CLI autenticada con la cuenta personal `bdanielparedesf-4776`.
- `vercel teams list` solo lista `bdanielparedesf-4776's projects`; **no aparece** el team `team_Xy8elEWXcfl14BkrL1OakXaC`.
- El proyecto `yesyes` es accesible desde la CLI bajo la cuenta personal (`vercel ls yesyes`, `vercel inspect`, `vercel logs yesyes.cl` funcionan). Por tanto, en este momento el proyecto está registrado en Vercel bajo la ** cuenta personal**, no bajo el team.

Implicancias:

- `vercel --prod` (deploy manual) y `vercel project ls` contra el team fallan con `Not authorized` porque la CLI no pertenece al team. **No usar** `vercel --prod`.
- Deploy recomendado: `git push origin main`. El repo está conectado a Vercel vía integración GitHub, por lo que el push dispara el deploy automático sin necesidad de autorización del CLI al team.

Acciones para el dueño (opcional, para futuro):

- Si el project debe vivir en el team `team_Xy8elEWXcfl14BkrL1OakXaC`, invitar la cuenta `bdanielparedesf@gmail.com` a ese team y/o transferir el proyecto yesyes al team desde el Dashboard (Settings > General > Transfer project to team). Luego volver a autenticar la CLI (`vercel teams add` / `vercel login`) para que `vercel ls`, `vercel logs` y `vercel --prod` funcionen contra el team.
