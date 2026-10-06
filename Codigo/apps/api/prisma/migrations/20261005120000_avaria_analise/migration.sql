-- Avaria passa a cobrir qualquer problema com a peça (dano, falta, defeito),
-- reportado pelo operador ou pelo montador e analisado pelo gestor.
ALTER TABLE "avaria" ADD COLUMN "id_cliente" UUID;
ALTER TABLE "avaria" ADD COLUMN "analisada_por" INTEGER;
ALTER TABLE "avaria" ADD COLUMN "analisada_at" TIMESTAMP(3);
ALTER TABLE "avaria" ADD COLUMN "parecer" TEXT;

CREATE UNIQUE INDEX "avaria_id_cliente_key" ON "avaria"("id_cliente");
CREATE INDEX "avaria_status_idx" ON "avaria"("status");

ALTER TABLE "avaria" ADD CONSTRAINT "avaria_analisada_por_fkey"
  FOREIGN KEY ("analisada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Peça faltando também é avaria. O seed só popula tabela vazia, então bancos
-- já semeados recebem o tipo por aqui.
INSERT INTO "tipo_avaria" ("nome", "descricao")
SELECT 'Faltante', 'Peça não veio no carregamento ou não foi encontrada'
WHERE NOT EXISTS (SELECT 1 FROM "tipo_avaria" WHERE "nome" = 'Faltante');
