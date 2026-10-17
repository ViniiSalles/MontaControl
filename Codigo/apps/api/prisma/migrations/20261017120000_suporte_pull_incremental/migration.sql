-- Suporte ao pull incremental da réplica offline do mobile (épico #105).
-- Toda entidade replicada precisa de uma data de alteração confiável, e o
-- servidor precisa lembrar o que deixou de existir para cada montador.
--
-- As colunas "updated_at" são mantidas pelo Prisma (@updatedAt) e por isso não
-- têm DEFAULT no banco: entram como nulas, são preenchidas nas linhas
-- existentes e só então viram NOT NULL.

-- AlterTable
ALTER TABLE "pedido_montador" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ambiente" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tipo_avaria" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "banco_horas" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "atestado" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- Backfill das linhas existentes
-- Atribuição anterior a esta migração: a data real não foi guardada, então vale
-- a do pedido (o pull inicial devolve tudo de qualquer jeito).
UPDATE "pedido_montador" pm
SET "created_at" = p."created_at"
FROM "pedido" p
WHERE p."id" = pm."pedido_id";

-- Ambiente não tinha data de alteração: acompanha a do pedido, que é a mais
-- tardia que se pode afirmar sem perder uma mudança.
UPDATE "ambiente" a
SET "updated_at" = p."updated_at"
FROM "pedido" p
WHERE p."id" = a."pedido_id";

UPDATE "tipo_avaria" SET "updated_at" = "created_at";

UPDATE "banco_horas" SET "updated_at" = "calculado_at";

-- Validação/rejeição pelo RH é a última alteração que o atestado sofre.
UPDATE "atestado" SET "updated_at" = COALESCE("validado_at", "created_at");

ALTER TABLE "ambiente" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "tipo_avaria" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "banco_horas" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "atestado" ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateTable
CREATE TABLE "sync_exclusao" (
    "id" SERIAL NOT NULL,
    "entidade" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "excluido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_exclusao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_exclusao_usuario_id_excluido_em_idx" ON "sync_exclusao"("usuario_id", "excluido_em");

-- CreateIndex
CREATE INDEX "avaria_registrada_por_updated_at_idx" ON "avaria"("registrada_por", "updated_at");

-- CreateIndex
CREATE INDEX "jornada_usuario_id_updated_at_idx" ON "jornada"("usuario_id", "updated_at");

-- CreateIndex
CREATE INDEX "banco_horas_usuario_id_updated_at_idx" ON "banco_horas"("usuario_id", "updated_at");

-- CreateIndex
CREATE INDEX "atestado_usuario_id_updated_at_idx" ON "atestado"("usuario_id", "updated_at");
