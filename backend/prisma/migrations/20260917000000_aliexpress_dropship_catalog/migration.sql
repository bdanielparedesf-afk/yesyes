-- Additive only: new AliExpress Dropship columns/tables. No existing column is
-- rewritten or removed, so CJ and legacy AliExpress rows are unaffected.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "aliexpressMarginPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "aliexpressShippingUsdCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "aliexpressShippingUnknown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aliexpressSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aliexpressSnapshot" JSONB;

ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "supplierVariantId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierAttributes" JSONB,
  ADD COLUMN IF NOT EXISTS "supplierImage" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierCostUsd" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "supplierShippingUsd" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "supplierStock" INTEGER,
  ADD COLUMN IF NOT EXISTS "supplierStockKnown" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "product_variants_productId_supplierVariantId_idx"
  ON "product_variants"("productId", "supplierVariantId");

CREATE TABLE IF NOT EXISTS public.aliexpress_import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  "marginPercent" INTEGER NOT NULL DEFAULT 100,
  "shippingMode" TEXT NOT NULL DEFAULT 'PROVIDER',
  "categoryId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aliexpress_import_job_items (
  id TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES public.aliexpress_import_jobs(id) ON DELETE CASCADE,
  "sourceUrl" TEXT NOT NULL,
  "aliexpressId" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  "createdProductId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aliexpress_import_job_items_jobId_status_idx"
  ON public.aliexpress_import_job_items("jobId", status);

CREATE TABLE IF NOT EXISTS public.aliexpress_sync_logs (
  id TEXT PRIMARY KEY,
  "productId" TEXT,
  "aliexpressId" TEXT NOT NULL,
  status TEXT NOT NULL,
  "costBeforeUsd" DOUBLE PRECISION,
  "costAfterUsd" DOUBLE PRECISION,
  "stockBefore" INTEGER,
  "stockAfter" INTEGER,
  changes JSONB,
  error TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aliexpress_sync_logs_productId_createdAt_idx"
  ON public.aliexpress_sync_logs("productId", "createdAt");

CREATE TABLE IF NOT EXISTS public.aliexpress_order_snapshots (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL UNIQUE,
  "aliexpressOrderId" TEXT,
  status TEXT NOT NULL DEFAULT 'PREPARED',
  request JSONB NOT NULL,
  response JSONB,
  tracking JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Browser roles get no access to supplier/queue/history tables (backend only).
ALTER TABLE public.aliexpress_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_import_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_order_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_import_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_import_job_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_sync_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_order_snapshots FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.aliexpress_import_jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.aliexpress_import_job_items FROM PUBLIC;
REVOKE ALL ON TABLE public.aliexpress_sync_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.aliexpress_order_snapshots FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.aliexpress_import_jobs FROM anon;
    REVOKE ALL ON TABLE public.aliexpress_import_job_items FROM anon;
    REVOKE ALL ON TABLE public.aliexpress_sync_logs FROM anon;
    REVOKE ALL ON TABLE public.aliexpress_order_snapshots FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.aliexpress_import_jobs FROM authenticated;
    REVOKE ALL ON TABLE public.aliexpress_import_job_items FROM authenticated;
    REVOKE ALL ON TABLE public.aliexpress_sync_logs FROM authenticated;
    REVOKE ALL ON TABLE public.aliexpress_order_snapshots FROM authenticated;
  END IF;
END $$;
-- No browser policies: the backend connects with its private privileged DB role.
