-- YESYES BUSINESS - Plataforma de negocios (migracion ADITIVA).
--
-- Solo agrega enums, tablas, columnas e indices. No elimina ni
-- modifica columnas existentes: la columna legacy "scopes" de
-- mercadopago_oauth_attempts se conserva intacta (la regla del proyecto
-- prohibe DROP COLUMN sobre funcionalidad existente).
-- Se agrega "code_verifier_encrypted", que el codigo de MP OAuth ya usaba
-- pero que faltaba en la base de datos (drift detectado en la auditoria).

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'IN_PROGRESS', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('PERCENTAGE', 'FIXED', 'TEXT_ONLY');

-- CreateEnum
CREATE TYPE "BusinessReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessStatus" ADD VALUE 'PREVIEW';
ALTER TYPE "BusinessStatus" ADD VALUE 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "business_categories" ADD COLUMN     "defaultCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "business_gallery_images" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "business_leads" ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_templates" ADD COLUMN     "description" TEXT,
ADD COLUMN     "previewImage" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "visual" JSONB;

-- AlterTable
ALTER TABLE "mercadopago_oauth_attempts"
ADD COLUMN     "code_verifier_encrypted" TEXT;

-- AlterTable
ALTER TABLE "property_images" ADD COLUMN     "alt" TEXT;

-- CreateTable
CREATE TABLE "business_capabilities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group" TEXT,
    "core" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "frequencyType" "SubscriptionFrequency" NOT NULL DEFAULT 'MONTH',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_subscriptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "providerSubscriptionId" TEXT,
    "providerPlanId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "frequencyType" "SubscriptionFrequency" NOT NULL DEFAULT 'MONTH',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextPaymentAt" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_payment_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_preview_tokens" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_preview_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_team_members" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "bio" TEXT,
    "photo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "socials" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_testimonials" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "photo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_faqs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_promotions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "discountType" "PromotionDiscountType" NOT NULL DEFAULT 'TEXT_ONLY',
    "discountValue" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_booking_slots" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_bookings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_reviews" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" "BusinessReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_blog_posts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "cover" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_capabilities_code_key" ON "business_capabilities"("code");

-- CreateIndex
CREATE INDEX "business_capabilities_active_idx" ON "business_capabilities"("active");

-- CreateIndex
CREATE INDEX "business_capabilities_order_idx" ON "business_capabilities"("order");

-- CreateIndex
CREATE UNIQUE INDEX "business_plans_code_key" ON "business_plans"("code");

-- CreateIndex
CREATE INDEX "business_plans_active_idx" ON "business_plans"("active");

-- CreateIndex
CREATE UNIQUE INDEX "business_subscriptions_businessId_key" ON "business_subscriptions"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_subscriptions_providerSubscriptionId_key" ON "business_subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "business_subscriptions_businessId_idx" ON "business_subscriptions"("businessId");

-- CreateIndex
CREATE INDEX "business_subscriptions_providerSubscriptionId_idx" ON "business_subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "business_subscriptions_status_idx" ON "business_subscriptions"("status");

-- CreateIndex
CREATE INDEX "business_subscriptions_nextPaymentAt_idx" ON "business_subscriptions"("nextPaymentAt");

-- CreateIndex
CREATE INDEX "business_payment_events_businessId_idx" ON "business_payment_events"("businessId");

-- CreateIndex
CREATE INDEX "business_payment_events_subscriptionId_idx" ON "business_payment_events"("subscriptionId");

-- CreateIndex
CREATE INDEX "business_payment_events_createdAt_idx" ON "business_payment_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_payment_events_provider_providerEventId_key" ON "business_payment_events"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "business_preview_tokens_tokenHash_key" ON "business_preview_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "business_preview_tokens_businessId_idx" ON "business_preview_tokens"("businessId");

-- CreateIndex
CREATE INDEX "business_preview_tokens_expiresAt_idx" ON "business_preview_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "business_team_members_businessId_idx" ON "business_team_members"("businessId");

-- CreateIndex
CREATE INDEX "business_team_members_businessId_active_idx" ON "business_team_members"("businessId", "active");

-- CreateIndex
CREATE INDEX "business_testimonials_businessId_idx" ON "business_testimonials"("businessId");

-- CreateIndex
CREATE INDEX "business_testimonials_businessId_active_idx" ON "business_testimonials"("businessId", "active");

-- CreateIndex
CREATE INDEX "business_faqs_businessId_idx" ON "business_faqs"("businessId");

-- CreateIndex
CREATE INDEX "business_faqs_businessId_active_idx" ON "business_faqs"("businessId", "active");

-- CreateIndex
CREATE INDEX "business_promotions_businessId_idx" ON "business_promotions"("businessId");

-- CreateIndex
CREATE INDEX "business_promotions_businessId_active_idx" ON "business_promotions"("businessId", "active");

-- CreateIndex
CREATE INDEX "business_booking_slots_businessId_idx" ON "business_booking_slots"("businessId");

-- CreateIndex
CREATE INDEX "business_booking_slots_businessId_weekday_idx" ON "business_booking_slots"("businessId", "weekday");

-- CreateIndex
CREATE INDEX "business_bookings_businessId_idx" ON "business_bookings"("businessId");

-- CreateIndex
CREATE INDEX "business_bookings_businessId_date_idx" ON "business_bookings"("businessId", "date");

-- CreateIndex
CREATE INDEX "business_bookings_status_idx" ON "business_bookings"("status");

-- CreateIndex
CREATE INDEX "business_reviews_businessId_idx" ON "business_reviews"("businessId");

-- CreateIndex
CREATE INDEX "business_reviews_businessId_status_idx" ON "business_reviews"("businessId", "status");

-- CreateIndex
CREATE INDEX "business_blog_posts_businessId_idx" ON "business_blog_posts"("businessId");

-- CreateIndex
CREATE INDEX "business_blog_posts_businessId_status_idx" ON "business_blog_posts"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_blog_posts_businessId_slug_key" ON "business_blog_posts"("businessId", "slug");

-- CreateIndex
CREATE INDEX "business_events_businessId_idx" ON "business_events"("businessId");

-- CreateIndex
CREATE INDEX "business_events_businessId_startAt_idx" ON "business_events"("businessId", "startAt");

-- CreateIndex
CREATE INDEX "business_leads_status_idx" ON "business_leads"("status");

-- AddForeignKey
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "business_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_payment_events" ADD CONSTRAINT "business_payment_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_payment_events" ADD CONSTRAINT "business_payment_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_preview_tokens" ADD CONSTRAINT "business_preview_tokens_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_team_members" ADD CONSTRAINT "business_team_members_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_testimonials" ADD CONSTRAINT "business_testimonials_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_faqs" ADD CONSTRAINT "business_faqs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_promotions" ADD CONSTRAINT "business_promotions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_booking_slots" ADD CONSTRAINT "business_booking_slots_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_bookings" ADD CONSTRAINT "business_bookings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_reviews" ADD CONSTRAINT "business_reviews_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_blog_posts" ADD CONSTRAINT "business_blog_posts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
