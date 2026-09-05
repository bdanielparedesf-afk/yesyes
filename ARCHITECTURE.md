# Arquitectura - YESYES

## Visión general

YESYES sigue una arquitectura monolítica modular con separación clara de responsabilidades.

## Estructura

```
YESYES/
├── frontend/          # SPA React
│   └── src/
│       ├── components/  # Componentes reutilizables
│       ├── pages/       # Vistas
│       ├── layouts/     # Layouts compartidos
│       ├── hooks/       # Custom hooks
│       ├── services/    # Clientes API
│       ├── store/       # Estado global (Zustand)
│       ├── types/       # Tipos TypeScript
│       └── utils/       # Utilidades
│
├── backend/           # API REST Node.js
│   └── src/
│       ├── controllers/ # Manejo de requests/responses
│       ├── services/    # Lógica de negocio
│       ├── repositories/# Acceso a datos (Prisma)
│       ├── middlewares/  # Auth, validación, errores
│       ├── routes/      # Definición de endpoints
│       ├── validators/  # Esquemas de validación (Zod)
│       ├── integrations/# Proveedores externos
│       ├── webhooks/    # Manejo de webhooks
│       ├── jobs/        # Tareas programadas
│       ├── utils/       # Utilidades
│       └── config/      # Configuración
│
├── database/          # Prisma schema y migraciones
│   ├── schema.prisma
│   └── migrations/
│
├── tests/             # Tests unitarios, integración y E2E
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/              # Documentación adicional
└── scripts/           # Scripts de utilidad
```

## Patrones

- **Servicios:** Lógica de negocio aislada.
- **Repositorios:** Acceso a datos centralizado.
- **DTOs / Validadores:** Esquemas de validación con Zod.
- **Middleware:** Separación de cross-cutting concerns.
- **Proveedores:** Interfaz SupplierProvider para integración con AliExpress, Temu, Amazon.

## Flujo de datos

Cliente -> Frontend -> Backend (Express) -> Servicios -> Repositorios (Prisma) -> PostgreSQL

Integraciones externas (Mercado Pago, AliExpress, Firebase) se manejan en módulos dedicados.

## Configuración

- Variables de entorno en `.env`
- Configuración por ambiente (development, production)
- Ningún secreto en frontend
