-- YESYES BUSINESS · BIBLIOTECA DE PÁGINAS REUTILIZABLES
--
-- Migración ADITIVA e idempotente. NO toca negocios, plantillas ni suscripciones.
--
-- Guardar una página terminada como "ejemplo reutilizable" es una necesidad
-- real del negocio: una peluquería que quedó bien sirve de base para las
-- docenas de peluquerias que vendran. Es contenido del ADMIN, no del cliente:
-- por eso es una tabla aparte y no un campo en `businesses`. La página original
-- se puede borrar sin que el ejemplo se pierda, que es justamente el motivo
-- para que viva en su propia tabla y no como un business más.


CREATE TABLE IF NOT EXISTS "business_page_library" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "label"               TEXT,
  "category"            TEXT,
  "sourceBusinessId"    TEXT,
  "sourceBusinessName"  TEXT,
  "snapshot"            JSONB NOT NULL,
  "templateId"          TEXT,
  "manifest"            JSONB,
  "timesUsed"           INTEGER NOT NULL DEFAULT 0,
  "archived"            BOOLEAN NOT NULL DEFAULT false,
  "createdById"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_page_library_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "business_page_library_archived_idx"
  ON "business_page_library" ("archived", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "business_page_library_category_idx"
  ON "business_page_library" ("category");

COMMENT ON TABLE "business_page_library" IS
  'Ejemplos de página guardados por el admin para reutilizar. El contenido es un snapshot: no depende de que la página original siga existiendo.';
