-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- Same lockdown as every other table in `public` (see
-- 20260818204500_lock_down_public_schema). A new table would otherwise be
-- published through PostgREST; the default-privileges revoke from that migration
-- already denies `anon` the grants, but RLS is the other half and does not apply
-- itself to tables created later. security-rls.test.ts enforces this line.
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
