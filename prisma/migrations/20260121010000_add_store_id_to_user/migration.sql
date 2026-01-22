-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_store_id_fkey'
  ) THEN
    ALTER TABLE "public"."users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
