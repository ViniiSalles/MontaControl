-- Aluguel de EPIs do almoxarifado: o gestor registra o período reservado e a
-- devolução real. `tipo_epi.estoque` limita quantas unidades de um tipo podem
-- estar alugadas ao mesmo tempo.

-- AlterTable
ALTER TABLE "tipo_epi" ADD COLUMN     "estoque" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "aluguel_epi" (
    "id" SERIAL NOT NULL,
    "tipo_epi_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim_previsto" TIMESTAMP(3) NOT NULL,
    "devolvido_em" TIMESTAMP(3),
    "observacao" TEXT,
    "registrado_por" INTEGER NOT NULL,
    "devolucao_registrada_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aluguel_epi_pkey" PRIMARY KEY ("id")
);

-- Invariantes que o service já garante; o banco segura escrita fora da API.
ALTER TABLE "tipo_epi" ADD CONSTRAINT "tipo_epi_estoque_nao_negativo" CHECK ("estoque" >= 0);
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_quantidade_positiva" CHECK ("quantidade" > 0);
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_periodo_valido" CHECK ("fim_previsto" > "inicio");
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_devolucao_apos_inicio" CHECK ("devolvido_em" IS NULL OR "devolvido_em" >= "inicio");

-- CreateIndex
CREATE INDEX "aluguel_epi_tipo_epi_id_devolvido_em_idx" ON "aluguel_epi"("tipo_epi_id", "devolvido_em");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_epi_nome_key" ON "tipo_epi"("nome");

-- AddForeignKey
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_tipo_epi_id_fkey" FOREIGN KEY ("tipo_epi_id") REFERENCES "tipo_epi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluguel_epi" ADD CONSTRAINT "aluguel_epi_devolucao_registrada_por_fkey" FOREIGN KEY ("devolucao_registrada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
