-- AlterTable: Remover colunas de trial da tabela store_subscriptions
ALTER TABLE "store_subscriptions" DROP COLUMN IF EXISTS "trial_start_at";
ALTER TABLE "store_subscriptions" DROP COLUMN IF EXISTS "trial_end_at";
