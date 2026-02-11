-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NON_FISCAL', 'NFC_E', 'SAT');

-- AlterTable
ALTER TABLE "stores"
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "certificado_configurado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "last_non_fiscal_number" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders"
ADD COLUMN "document_type" "DocumentType" NOT NULL DEFAULT 'NON_FISCAL',
ADD COLUMN "document_number" TEXT,
ADD COLUMN "document_issued_at" TIMESTAMP(3),
ADD COLUMN "is_fiscal" BOOLEAN NOT NULL DEFAULT false;
