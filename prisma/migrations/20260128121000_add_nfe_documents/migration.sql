-- CreateTable
CREATE TABLE "nfe_documents" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "chave_acesso" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recibo" TEXT,
    "protocolo" TEXT,
    "mensagem_retorno" TEXT,
    "xml_assinado" TEXT NOT NULL,
    "xml_autorizado" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "nfe_documents" ADD CONSTRAINT "nfe_documents_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

