-- CreateEnum
CREATE TYPE "TipoMarcacao" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "marcacao_ponto" (
    "id" SERIAL NOT NULL,
    "nsr" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "jornada_id" INTEGER NOT NULL,
    "tipo" "TipoMarcacao" NOT NULL,
    "marcado_em" TIMESTAMP(3) NOT NULL,
    "gravado_em" TIMESTAMP(3) NOT NULL,
    "coletor" CHAR(2) NOT NULL,
    "offline" BOOLEAN NOT NULL,
    "hash" CHAR(64),

    CONSTRAINT "marcacao_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marcacao_ponto_nsr_key" ON "marcacao_ponto"("nsr");

-- CreateIndex
CREATE UNIQUE INDEX "marcacao_ponto_jornada_id_tipo_key" ON "marcacao_ponto"("jornada_id", "tipo");

-- CreateIndex
CREATE INDEX "marcacao_ponto_marcado_em_idx" ON "marcacao_ponto"("marcado_em");

-- AddForeignKey
ALTER TABLE "marcacao_ponto" ADD CONSTRAINT "marcacao_ponto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcacao_ponto" ADD CONSTRAINT "marcacao_ponto_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: uma marcação por check-in/check-out original já existente (nunca
-- de ponto em atraso aprovado — esses têm checkin_id_cliente/checkout_id_cliente
-- nulos), numa única sequência de NSR ordenada pela hora em que cada marcação
-- foi gravada (created_at para entrada, updated_at para saída).
INSERT INTO "marcacao_ponto" ("nsr", "usuario_id", "jornada_id", "tipo", "marcado_em", "gravado_em", "coletor", "offline", "hash")
SELECT
  ROW_NUMBER() OVER (ORDER BY gravado_em, jornada_id, tipo) AS nsr,
  usuario_id,
  jornada_id,
  tipo,
  marcado_em,
  gravado_em,
  '01',
  false,
  NULL
FROM (
  SELECT id AS jornada_id, usuario_id, 'ENTRADA'::"TipoMarcacao" AS tipo, checkin_at AS marcado_em, created_at AS gravado_em
  FROM "jornada"
  WHERE checkin_id_cliente IS NOT NULL AND checkin_at IS NOT NULL
  UNION ALL
  SELECT id AS jornada_id, usuario_id, 'SAIDA'::"TipoMarcacao" AS tipo, checkout_at AS marcado_em, updated_at AS gravado_em
  FROM "jornada"
  WHERE checkout_id_cliente IS NOT NULL AND checkout_at IS NOT NULL
) AS marcacoes_originais
ORDER BY gravado_em, jornada_id, tipo;
