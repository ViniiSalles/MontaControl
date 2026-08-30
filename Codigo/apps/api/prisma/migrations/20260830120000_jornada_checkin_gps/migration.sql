-- AlterTable
ALTER TABLE "jornada" ADD COLUMN     "checkin_id_cliente" UUID,
ADD COLUMN     "checkin_endereco" TEXT,
ADD COLUMN     "checkout_id_cliente" UUID,
ADD COLUMN     "checkout_endereco" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- `updated_at` entra com default só para as linhas que já existem; o Prisma
-- gerencia o valor pelo `@updatedAt`, então o default sai em seguida para o
-- schema do banco não divergir do datamodel.
ALTER TABLE "jornada" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "jornada_checkin_id_cliente_key" ON "jornada"("checkin_id_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "jornada_checkout_id_cliente_key" ON "jornada"("checkout_id_cliente");

-- CreateIndex
CREATE INDEX "jornada_usuario_id_checkin_at_idx" ON "jornada"("usuario_id", "checkin_at");
