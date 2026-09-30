-- Peça nasce PENDENTE e sem código; o código chega na bipagem do depósito.
ALTER TABLE "peca" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
ALTER TABLE "peca" ALTER COLUMN "codigo_barras" DROP NOT NULL;

-- Agrupamento das peças de um mesmo item do pedido: cada grupo é identificado
-- pelo id da sua primeira peça. Linhas que já existem viram um grupo de uma só.
ALTER TABLE "peca" ADD COLUMN "item_id" INTEGER;
UPDATE "peca" SET "item_id" = "id" WHERE "item_id" IS NULL;
ALTER TABLE "peca" ALTER COLUMN "item_id" SET NOT NULL;
CREATE INDEX "peca_item_id_idx" ON "peca"("item_id");
