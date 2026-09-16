BEGIN;
-- Additive only; does not rewrite or remove existing credentials.
CREATE TABLE IF NOT EXISTS public.aliexpress_tokens (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL UNIQUE,
  seller_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.aliexpress_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliexpress_tokens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.aliexpress_tokens FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.aliexpress_tokens FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.aliexpress_tokens FROM authenticated;
  END IF;
END $$;
-- No browser policies. Backend connects with its private privileged DB role.
COMMIT;

