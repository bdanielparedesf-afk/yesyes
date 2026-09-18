-- Additive-only Sync Engine support: settings singleton + sync-log detail columns.
-- No existing column is rewritten or removed.

CREATE TABLE IF NOT EXISTS public.aliexpress_sync_settings (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  "interval_minutes" INTEGER NOT NULL DEFAULT 60,
  "stalePricePolicy" TEXT NOT NULL DEFAULT 'AUTO_UPDATE',
  "noQuotePolicy" TEXT NOT NULL DEFAULT 'BLOCK',
  "batchSize" INTEGER NOT NULL DEFAULT 10,
  "last_run_at" TIMESTAMPTZ,
  "last_cursor" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Browser roles get no access: backend/admin only.
ALTER TABLE public.aliexpress_sync_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.aliexpress_sync_logs ADD COLUMN IF NOT EXISTS "skuId" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingBeforeUsdCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "shippingAfterUsdCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "shippingStatus" TEXT;

CREATE INDEX IF NOT EXISTS "aliexpress_sync_logs_createdAt_idx"
  ON public.aliexpress_sync_logs("createdAt");
