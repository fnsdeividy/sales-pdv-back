-- AlterTable
ALTER TABLE "products" ADD COLUMN "is_unlimited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "stock_quantity" INTEGER;

-- Backfill: produtos que têm registro em Stock recebem stock_quantity e is_unlimited = false
UPDATE "products" p
SET "is_unlimited" = false,
    "stock_quantity" = s.quantity
FROM "stock" s
WHERE s."productId" = p.id AND s."storeId" = p."storeId";

-- Produtos sem Stock (stock_quantity continua NULL) ficam ilimitados
UPDATE "products"
SET "is_unlimited" = true,
    "stock_quantity" = NULL
WHERE "stock_quantity" IS NULL;
