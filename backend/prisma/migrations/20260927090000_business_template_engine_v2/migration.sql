-- YESYES BUSINESS · TEMPLATE ENGINE V2 (Fase 3)
--
-- Migración ADITIVA e idempotente. NO hace DROP, NO toca el enum
-- `BusinessCategoryCode`, NO borra ni modifica filas de `business_templates`
-- ni de `businesses`. Los 97 templates legacy siguen intactos y activos.
--
-- Agrega la arquitectura de versionado, instancia de sitio y medios:
--   business_template_versions -> manifests inmutables (template version)
--   business_site_instances    -> sitio real de cada negocio (1:1)
--   business_site_revisions    -> historial append-only de la instancia
--   business_media             -> contrato de medios (video en Fase 5)

CREATE TABLE IF NOT EXISTS "business_template_versions" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "manifestVersion" INTEGER NOT NULL DEFAULT 1,
  "manifest" JSONB NOT NULL,
  "changelog" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "business_site_instances" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "templateVersionId" TEXT,
  "manifestVersion" INTEGER NOT NULL DEFAULT 1,
  "manifest" JSONB NOT NULL,
  "overrides" JSONB,
  "legacyCompatibility" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_site_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "business_site_revisions" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "manifestVersion" INTEGER NOT NULL,
  "manifest" JSONB NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_site_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "business_media" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "posterUrl" TEXT,
  "mimeType" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "durationSec" INTEGER,
  "alt" TEXT,
  "title" TEXT,
  "metadata" JSONB,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_template_versions_templateId_templateVersion_key"
  ON "business_template_versions"("templateId", "templateVersion");
CREATE INDEX IF NOT EXISTS "business_template_versions_templateId_published_idx"
  ON "business_template_versions"("templateId", "published");

CREATE UNIQUE INDEX IF NOT EXISTS "business_site_instances_businessId_key"
  ON "business_site_instances"("businessId");
CREATE INDEX IF NOT EXISTS "business_site_instances_templateId_idx"
  ON "business_site_instances"("templateId");
CREATE INDEX IF NOT EXISTS "business_site_instances_templateVersionId_idx"
  ON "business_site_instances"("templateVersionId");

CREATE INDEX IF NOT EXISTS "business_site_revisions_instanceId_createdAt_idx"
  ON "business_site_revisions"("instanceId", "createdAt");

CREATE INDEX IF NOT EXISTS "business_media_businessId_kind_idx"
  ON "business_media"("businessId", "kind");
CREATE INDEX IF NOT EXISTS "business_media_businessId_position_idx"
  ON "business_media"("businessId", "position");

-- Foreign keys: se agregan de forma defensiva (Postgres no tiene
-- IF NOT EXISTS para constraints, por eso se comprueba con un DO block) para
-- que esta migracion sea re-ejecutable sin fallar.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_template_versions_templateId_fkey') THEN
    ALTER TABLE "business_template_versions" ADD CONSTRAINT "business_template_versions_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "business_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_site_instances_businessId_fkey') THEN
    ALTER TABLE "business_site_instances" ADD CONSTRAINT "business_site_instances_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_site_instances_templateId_fkey') THEN
    ALTER TABLE "business_site_instances" ADD CONSTRAINT "business_site_instances_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "business_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_site_instances_templateVersionId_fkey') THEN
    ALTER TABLE "business_site_instances" ADD CONSTRAINT "business_site_instances_templateVersionId_fkey"
      FOREIGN KEY ("templateVersionId") REFERENCES "business_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_site_revisions_instanceId_fkey') THEN
    ALTER TABLE "business_site_revisions" ADD CONSTRAINT "business_site_revisions_instanceId_fkey"
      FOREIGN KEY ("instanceId") REFERENCES "business_site_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_media_businessId_fkey') THEN
    ALTER TABLE "business_media" ADD CONSTRAINT "business_media_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
