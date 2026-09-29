-- AlterTable
ALTER TABLE "usuario" ADD COLUMN "cpf" VARCHAR(11);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cpf_key" ON "usuario"("cpf");
