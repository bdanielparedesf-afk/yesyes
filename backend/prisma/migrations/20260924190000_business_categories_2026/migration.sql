-- Categorías canónicas agregadas para el constructor de páginas de negocios.
-- Migración aditiva: conserva todos los códigos y datos existentes.
ALTER TYPE "BusinessCategoryCode" ADD VALUE IF NOT EXISTS 'CAFE';
ALTER TYPE "BusinessCategoryCode" ADD VALUE IF NOT EXISTS 'NAILS';
ALTER TYPE "BusinessCategoryCode" ADD VALUE IF NOT EXISTS 'FITNESS';
ALTER TYPE "BusinessCategoryCode" ADD VALUE IF NOT EXISTS 'AUTO';
ALTER TYPE "BusinessCategoryCode" ADD VALUE IF NOT EXISTS 'PRO';
