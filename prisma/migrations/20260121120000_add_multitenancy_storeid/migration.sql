-- Correção de Multitenancy: Adicionar storeId em todas as entidades multitenant
-- Esta migration adiciona o campo store_id em tabelas que não tinham isolamento por loja

-- =============================================
-- 1. CUSTOMERS - Adicionar storeId
-- =============================================

-- Adicionar coluna store_id (nullable inicialmente)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- Remover constraint unique de email (será unique por loja agora)
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_email_key";

-- =============================================
-- 2. MATERIALS - Adicionar storeId
-- =============================================

-- Adicionar coluna store_id (nullable inicialmente)
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- Remover constraint unique de sku (será unique por loja agora)
ALTER TABLE "materials" DROP CONSTRAINT IF EXISTS "materials_sku_key";

-- =============================================
-- 3. MATERIAL_BATCHES - Adicionar storeId
-- =============================================

-- Adicionar coluna store_id (nullable inicialmente)
ALTER TABLE "material_batches" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- =============================================
-- 4. PRODUCTION_ORDERS - Adicionar storeId
-- =============================================

-- Adicionar coluna store_id (nullable inicialmente)
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- =============================================
-- 5. FIXED_COSTS - Adicionar storeId
-- =============================================

-- Adicionar coluna store_id (nullable inicialmente)
ALTER TABLE "fixed_costs" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- Remover constraint unique de name (será unique por loja agora)
ALTER TABLE "fixed_costs" DROP CONSTRAINT IF EXISTS "fixed_costs_name_key";

-- =============================================
-- 6. INVOICES - Tornar storeId obrigatório
-- =============================================

-- A coluna storeId já existe, mas precisamos torná-la obrigatória
-- Remover constraint unique de invoiceNumber (será unique por loja agora)
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoiceNumber_key";

-- =============================================
-- 7. Associar registros órfãos à primeira loja (se existirem)
-- =============================================

-- Atualizar customers sem storeId
UPDATE "customers" 
SET "store_id" = (SELECT "id" FROM "stores" LIMIT 1)
WHERE "store_id" IS NULL;

-- Atualizar materials sem storeId
UPDATE "materials" 
SET "store_id" = (SELECT "id" FROM "stores" LIMIT 1)
WHERE "store_id" IS NULL;

-- Atualizar material_batches sem storeId
UPDATE "material_batches" 
SET "store_id" = (SELECT "id" FROM "stores" LIMIT 1)
WHERE "store_id" IS NULL;

-- Atualizar production_orders sem storeId
UPDATE "production_orders" 
SET "store_id" = (SELECT "id" FROM "stores" LIMIT 1)
WHERE "store_id" IS NULL;

-- Atualizar fixed_costs sem storeId
UPDATE "fixed_costs" 
SET "store_id" = (SELECT "id" FROM "stores" LIMIT 1)
WHERE "store_id" IS NULL;

-- Atualizar invoices sem storeId
UPDATE "invoices" 
SET "store_id" = (SELECT "id" FROM "stores" LIMIT 1)
WHERE "store_id" IS NULL;

-- =============================================
-- 8. Tornar storeId NOT NULL e adicionar FKs
-- =============================================

-- Customers
ALTER TABLE "customers" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Materials
ALTER TABLE "materials" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "materials" ADD CONSTRAINT "materials_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Material Batches
ALTER TABLE "material_batches" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "material_batches" ADD CONSTRAINT "material_batches_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Production Orders
ALTER TABLE "production_orders" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fixed Costs
ALTER TABLE "fixed_costs" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invoices
ALTER TABLE "invoices" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_store_id_fkey" 
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- 9. Criar novos índices únicos por loja
-- =============================================

-- Customers: email único por loja
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_store_id_key" ON "customers"("email", "store_id");

-- Materials: sku único por loja
CREATE UNIQUE INDEX IF NOT EXISTS "materials_sku_store_id_key" ON "materials"("sku", "store_id");

-- Fixed Costs: name único por loja
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_costs_name_store_id_key" ON "fixed_costs"("name", "store_id");

-- Invoices: invoiceNumber único por loja
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_store_id_key" ON "invoices"("invoiceNumber", "store_id");

-- =============================================
-- 10. Criar role admin se não existir
-- =============================================

INSERT INTO "roles" ("id", "name", "description", "is_system", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  'admin',
  'Administrador da loja',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'admin');
