-- Momento em que a peça chegou ao estoque (triagem), para o dashboard do gestor.
ALTER TABLE "peca" ADD COLUMN "triada_at" TIMESTAMP(3);

-- Peças triadas antes desta coluna: a melhor aproximação disponível é a
-- última alteração da linha.
UPDATE "peca" SET "triada_at" = "updated_at" WHERE "triada_por" IS NOT NULL AND "triada_at" IS NULL;
