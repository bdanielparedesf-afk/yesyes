-- AlterTable
ALTER TABLE "products" ADD COLUMN     "alert" TEXT,
ADD COLUMN     "alertLevel" TEXT NOT NULL DEFAULT 'info',
ADD COLUMN     "hasAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;