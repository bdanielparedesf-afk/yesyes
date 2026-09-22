-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BusinessCategoryCode" AS ENUM ('HAIR', 'BARBER', 'BAKERY', 'FLOWERS', 'FOOD', 'BOUTIQUE', 'FURNITURE', 'REAL_ESTATE', 'MECHANIC', 'PHONE', 'CLEANING', 'PHOTO', 'TUTORING', 'CONSTRUCTION', 'BEAUTY', 'PET', 'DETAILING');

-- CreateEnum
CREATE TYPE "PropertyOperation" AS ENUM ('VENTA', 'ARRIENDO');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('CASA', 'DEPARTAMENTO', 'TERRENO', 'OFICINA', 'LOCAL', 'PARCELA', 'BODEGA');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('RESERVA', 'COTIZACION', 'CONSULTA', 'PEDIDO', 'PROPERTY_INQUIRY');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BUSINESS';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "businessId" TEXT;

-- CreateTable
CREATE TABLE "business_categories" (
    "id" TEXT NOT NULL,
    "code" "BusinessCategoryCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "business_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_templates" (
    "id" TEXT NOT NULL,
    "category" "BusinessCategoryCode" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "previewUrl" TEXT,
    "capabilities" TEXT[],
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "BusinessCategoryCode" NOT NULL,
    "templateId" TEXT,
    "status" "BusinessStatus" NOT NULL DEFAULT 'DRAFT',
    "logo" TEXT,
    "cover" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "mapsUrl" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "hours" JSONB,
    "socials" JSONB,
    "cta" JSONB,
    "settings" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImage" TEXT,
    "canonical" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_services" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" DOUBLE PRECISION,
    "durationMin" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "operation" "PropertyOperation" NOT NULL,
    "type" "PropertyType" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "parking" INTEGER,
    "areaBuilt" DOUBLE PRECISION,
    "areaTotal" DOUBLE PRECISION,
    "features" TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "agent" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_gallery_images" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_leads" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "LeadType" NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "waClick" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_stats_daily" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "waClicks" INTEGER NOT NULL DEFAULT 0,
    "phoneClicks" INTEGER NOT NULL DEFAULT 0,
    "emailClicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "productViews" INTEGER NOT NULL DEFAULT 0,
    "propertyViews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_categories_code_key" ON "business_categories"("code");

-- CreateIndex
CREATE INDEX "business_categories_active_idx" ON "business_categories"("active");

-- CreateIndex
CREATE INDEX "business_categories_order_idx" ON "business_categories"("order");

-- CreateIndex
CREATE UNIQUE INDEX "business_templates_code_key" ON "business_templates"("code");

-- CreateIndex
CREATE INDEX "business_templates_category_idx" ON "business_templates"("category");

-- CreateIndex
CREATE INDEX "business_templates_active_idx" ON "business_templates"("active");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_ownerId_idx" ON "businesses"("ownerId");

-- CreateIndex
CREATE INDEX "businesses_category_idx" ON "businesses"("category");

-- CreateIndex
CREATE INDEX "businesses_status_idx" ON "businesses"("status");

-- CreateIndex
CREATE INDEX "business_services_businessId_idx" ON "business_services"("businessId");

-- CreateIndex
CREATE INDEX "business_services_businessId_active_idx" ON "business_services"("businessId", "active");

-- CreateIndex
CREATE INDEX "properties_businessId_idx" ON "properties"("businessId");

-- CreateIndex
CREATE INDEX "properties_operation_idx" ON "properties"("operation");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_businessId_published_idx" ON "properties"("businessId", "published");

-- CreateIndex
CREATE INDEX "property_images_propertyId_idx" ON "property_images"("propertyId");

-- CreateIndex
CREATE INDEX "business_gallery_images_businessId_idx" ON "business_gallery_images"("businessId");

-- CreateIndex
CREATE INDEX "business_gallery_images_businessId_position_idx" ON "business_gallery_images"("businessId", "position");

-- CreateIndex
CREATE INDEX "business_leads_businessId_idx" ON "business_leads"("businessId");

-- CreateIndex
CREATE INDEX "business_leads_type_idx" ON "business_leads"("type");

-- CreateIndex
CREATE INDEX "business_leads_businessId_createdAt_idx" ON "business_leads"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "business_stats_daily_businessId_idx" ON "business_stats_daily"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_stats_daily_businessId_date_key" ON "business_stats_daily"("businessId", "date");

-- CreateIndex
CREATE INDEX "products_businessId_idx" ON "products"("businessId");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "business_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_services" ADD CONSTRAINT "business_services_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_gallery_images" ADD CONSTRAINT "business_gallery_images_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_leads" ADD CONSTRAINT "business_leads_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

