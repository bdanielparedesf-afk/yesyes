-- Additive only. Does not update aliexpress_tokens or activate any account.
CREATE TABLE "aliexpress_oauth_attempts" (
  "state_hash" TEXT NOT NULL,
  "browser_hash" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "account" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aliexpress_oauth_attempts_pkey" PRIMARY KEY ("state_hash")
);
CREATE INDEX "aliexpress_oauth_attempts_expires_at_idx" ON "aliexpress_oauth_attempts"("expires_at");
