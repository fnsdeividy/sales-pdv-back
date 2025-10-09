-- CreateEnum
CREATE TYPE "public"."FixedCostFrequency" AS ENUM ('daily', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "public"."FixedCostCategory" AS ENUM ('overhead', 'labor', 'utilities', 'rent', 'other');

-- CreateTable
CREATE TABLE "public"."fixed_costs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "public"."FixedCostFrequency" NOT NULL,
    "category" "public"."FixedCostCategory" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixed_costs_name_key" ON "public"."fixed_costs"("name");
