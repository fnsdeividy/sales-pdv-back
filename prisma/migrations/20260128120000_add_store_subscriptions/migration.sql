-- CreateTable
CREATE TABLE "store_subscriptions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_name" TEXT,
    "trial_start_at" TIMESTAMP(3),
    "trial_end_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "next_billing_at" TIMESTAMP(3),
    "external_customer_id" TEXT,
    "external_subscription_id" TEXT,
    "external_plan_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_subscriptions_store_id_key" ON "store_subscriptions"("store_id");

-- AddForeignKey
ALTER TABLE "store_subscriptions" ADD CONSTRAINT "store_subscriptions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
