# YESYES

YESYES es una tienda ecommerce moderna construida con React, TypeScript, Node.js y PostgreSQL.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + TypeScript + Express
- **Base de datos:** PostgreSQL
- **ORM:** Prisma
- **Autenticación:** Firebase Authentication + Google OAuth
- **Pagos:** Mercado Pago

## Estructura

```
YESYES/
├── frontend/        # Aplicación React
├── backend/         # API Node.js + Express
├── database/        # Migraciones y seeds Prisma
├── docs/            # Documentación adicional
├── tests/           # Tests unitarios, integración y E2E
├── scripts/         # Scripts de utilidad
├── .env.example
├── README.md
├── REQUERIMIENTOS.md
├── ARCHITECTURE.md
├── SECURITY.md
├── API.md
├── DATABASE.md
└── DEPLOYMENT.md
```

## Inicio rápido

### Backend
```bash
cd backend
npm install
cp ../.env.example .env
# Configurar variables en .env
npm run db:generate
npm run db:migrate
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Licencia

Privada
