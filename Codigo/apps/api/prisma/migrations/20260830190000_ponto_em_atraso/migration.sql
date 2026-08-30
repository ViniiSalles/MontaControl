-- CreateEnum
CREATE TYPE "StatusSolicitacaoPonto" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateTable
CREATE TABLE "solicitacao_ponto" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "id_cliente" UUID NOT NULL,
    "data" DATE NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "minutos_solicitados" INTEGER NOT NULL,
    "justificativa" TEXT NOT NULL,
    "status" "StatusSolicitacaoPonto" NOT NULL DEFAULT 'PENDENTE',
    "jornada_id" INTEGER,
    "analisado_por" INTEGER,
    "analisado_em" TIMESTAMP(3),
    "motivo_rejeicao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacao_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacao_ponto_id_cliente_key" ON "solicitacao_ponto"("id_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacao_ponto_jornada_id_key" ON "solicitacao_ponto"("jornada_id");

-- CreateIndex
CREATE INDEX "solicitacao_ponto_status_data_idx" ON "solicitacao_ponto"("status", "data");

-- CreateIndex
CREATE INDEX "solicitacao_ponto_usuario_id_data_idx" ON "solicitacao_ponto"("usuario_id", "data");

-- AddForeignKey
ALTER TABLE "solicitacao_ponto" ADD CONSTRAINT "solicitacao_ponto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_ponto" ADD CONSTRAINT "solicitacao_ponto_analisado_por_fkey" FOREIGN KEY ("analisado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_ponto" ADD CONSTRAINT "solicitacao_ponto_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
