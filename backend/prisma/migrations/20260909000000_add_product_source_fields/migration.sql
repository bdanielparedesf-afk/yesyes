-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourcePlatform" TEXT,
ADD COLUMN     "sourceUrl" TEXT;
