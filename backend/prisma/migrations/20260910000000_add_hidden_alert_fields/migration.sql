-- Agregar campos faltantes al modelo Product
-- Estos campos existen en schema.prisma pero no en la base de datos

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hasAlert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "alert" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "alertLevel" TEXT NOT NULL DEFAULT ''info'';
