-- Presentacion comercial de variantes importadas (AliExpress):
--   name          -> nombre comercial limpio en espanol ("Modelo: iPad 7 - Color: Negro")
--   rawName       -> respaldo del skuAttr tecnico original ("5:1394#iPad 7...")
--   comparePrice  -> precio de comparacion para mostrar descuento (precio * 1.3)
-- Columnas nuevas, opcionales y no destructivas: no modifican datos existentes.
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "rawName" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "comparePrice" DECIMAL(65,30);
