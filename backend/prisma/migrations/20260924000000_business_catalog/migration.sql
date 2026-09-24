-- Business-owned catalog. It intentionally has no foreign key to products or categories.
CREATE TABLE "business_catalog_items" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "image" TEXT,
    "additionalImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cta" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_catalog_items_businessId_slug_key" ON "business_catalog_items"("businessId", "slug");
CREATE INDEX "business_catalog_items_businessId_active_sortOrder_idx" ON "business_catalog_items"("businessId", "active", "sortOrder");
CREATE INDEX "business_catalog_items_businessId_featured_idx" ON "business_catalog_items"("businessId", "featured");
ALTER TABLE "business_catalog_items" ADD CONSTRAINT "business_catalog_items_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Templates V3 for categories that previously had no selectable design.
INSERT INTO "business_templates" ("id", "code", "name", "category", "capabilities", "active", "createdAt", "updatedAt") VALUES
('a1000000-0000-4000-8000-000000000001', 'FOOD_01', 'Restaurante Editorial', 'FOOD', ARRAY['PRODUCTS','CATALOG','GALLERY','PROMOTIONS','OPENING_HOURS','MAP','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000002', 'BOUTIQUE_01', 'Boutique Premium', 'BOUTIQUE', ARRAY['PRODUCTS','CATALOG','GALLERY','PROMOTIONS','CONTACT','WHATSAPP','SOCIALS']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000003', 'PHOTO_01', 'Fotografía Portfolio', 'PHOTO', ARRAY['PORTFOLIO','GALLERY','SERVICES','TESTIMONIALS','BOOKING','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000004', 'BEAUTY_01', 'Belleza Serena', 'BEAUTY', ARRAY['SERVICES','PRICING','TEAM','GALLERY','TESTIMONIALS','PROMOTIONS','BOOKING','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000005', 'DETAILING_01', 'Detailing Studio', 'DETAILING', ARRAY['SERVICES','PRICING','BEFORE_AFTER','GALLERY','TESTIMONIALS','BOOKING','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000006', 'CLEANING_01', 'Servicios Profesionales', 'CLEANING', ARRAY['SERVICES','FEATURES','TEAM','TESTIMONIALS','FAQ','BOOKING','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000007', 'MECHANIC_01', 'Mecánica Profesional', 'MECHANIC', ARRAY['SERVICES','BEFORE_AFTER','GALLERY','TESTIMONIALS','BOOKING','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000008', 'TUTORING_01', 'Profesionales', 'TUTORING', ARRAY['SERVICES','TEAM','FEATURES','FAQ','BOOKING','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000009', 'CONSTRUCTION_01', 'Proyectos Profesionales', 'CONSTRUCTION', ARRAY['SERVICES','PORTFOLIO','GALLERY','TEAM','TESTIMONIALS','CONTACT','WHATSAPP']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category", "capabilities" = EXCLUDED."capabilities", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;