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
