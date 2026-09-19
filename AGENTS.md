# AGENTS.md — Development Guide for YesYes

## Project Structure
- **Backend**: `backend/` — Node.js + Express + Prisma (TypeScript)
- **Frontend**: `frontend/` — Vite + React 18 + Tailwind CSS (TypeScript)
- **Shared Prisma schema**: `backend/prisma/schema.prisma`

## Commands

### Backend (`backend/`)
```bash
npm run dev          # Start dev server (port 3001, watch mode)
npm run build        # Compile TypeScript → dist/
npm run typecheck    # tsc --noEmit (type check only)
npm run test         # Run test suite: node --test tests/*.test.cjs
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:push      # Push schema to DB (dev)
```
**Note**: ESLint is not configured (no `.eslintrc*` or `eslint.config.*` at root). Type checking via `tsc --noEmit` is the primary validation.

### Frontend (`frontend/`)
```bash
npm run dev          # Start dev server (port 5173, proxies /api → localhost:3001)
npm run build        # tsc && vite build (type check + production build)
npm run preview      # Preview production build
npm test             # Jest (no test files currently exist)
```
**Note**: ESLint is referenced in `package.json` scripts but is not configured.

## Database
- PostgreSQL (Supabase) via `DATABASE_URL` in `backend/.env`
- Schema file: `backend/prisma/schema.prisma`
- Generated client imports from `@prisma/client`

## Key Architecture Notes
- API base: `/api/*` (Vite proxy in dev, Vercel rewrite in prod)
- Public product catalog: `GET /api/products` (all published) and `GET /api/products/home` (sections for home page)
- Public categories: `GET /api/categories` (active only)
- Product detail: `GET /api/products/:slug`
- Category products: `GET /api/products/category/:slug`
- Admin routes: `GET /api/admin/*` (requires admin auth)
