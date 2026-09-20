-- AlterTable
ALTER TABLE "atestado" ADD COLUMN "id_cliente" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "atestado_id_cliente_key" ON "atestado"("id_cliente");
