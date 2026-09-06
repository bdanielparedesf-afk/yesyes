-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

-- Add existing columns as nullable first
ALTER TABLE "products" ADD COLUMN "cj_product_id" TEXT;
ALTER TABLE "products" ADD COLUMN "cj_variants" JSONB;
ALTER TABLE "products" ADD COLUMN "collection_id" TEXT;

-- AlterColumn
ALTER TABLE "products" ALTER COLUMN "tags" SET DEFAULT '{}';
ALTER TABLE "products" ALTER COLUMN "tags" SET DATA TYPE TEXT[] USING tags::text[];

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
