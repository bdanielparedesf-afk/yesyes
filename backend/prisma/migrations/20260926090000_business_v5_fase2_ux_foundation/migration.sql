-- YESYES BUSINESS V5 · Fase 2 (UX Foundation)
-- Migración ADITIVA e idempotente: no toca el enum BusinessCategoryCode,
-- no borra templates ni datos. Solo agrega metadatos de presentación.
ALTER TABLE "business_templates" ADD COLUMN IF NOT EXISTS "style" TEXT;
ALTER TABLE "business_templates" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT false;

-- Todas las plantillas existentes son del modelo V3: se marcan legacy.
-- Siguen activas y visibles (compatibilidad V3), la galería solo las etiqueta.
UPDATE "business_templates" SET "legacy" = true WHERE "legacy" = false;
