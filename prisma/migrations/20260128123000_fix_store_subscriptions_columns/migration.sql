-- Align store_subscriptions column names with Prisma schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'store_subscriptions'
  ) THEN
    -- Rename plan_id -> planId if needed
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'store_subscriptions'
        AND column_name = 'plan_id'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'store_subscriptions'
        AND column_name = 'planId'
    ) THEN
      ALTER TABLE "store_subscriptions" RENAME COLUMN "plan_id" TO "planId";
    END IF;

    -- Rename plan_name -> planName if needed
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'store_subscriptions'
        AND column_name = 'plan_name'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'store_subscriptions'
        AND column_name = 'planName'
    ) THEN
      ALTER TABLE "store_subscriptions" RENAME COLUMN "plan_name" TO "planName";
    END IF;
  END IF;
END $$;
