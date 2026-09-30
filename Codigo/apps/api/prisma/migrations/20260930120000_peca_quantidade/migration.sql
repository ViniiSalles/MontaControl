-- Peça passa a ser um "slot" com quantidade: o operador bipa uma vez por item,
-- não uma vez por unidade.
ALTER TABLE "peca" ADD COLUMN "quantidade" INTEGER NOT NULL DEFAULT 1;

-- Itens já cadastrados com uma linha por unidade (ainda PENDENTES) são
-- colapsados na primeira linha do grupo, que passa a carregar a quantidade.
UPDATE "peca" AS cabeca
SET "quantidade" = grupo.total
FROM (
  SELECT MIN("id") AS cabeca_id, COUNT(*) AS total
  FROM "peca"
  WHERE "status" = 'PENDENTE'
  GROUP BY "ambiente_id", "item_id"
) AS grupo
WHERE cabeca."id" = grupo.cabeca_id;

DELETE FROM "peca" AS p
WHERE p."status" = 'PENDENTE'
  AND p."id" <> (
    SELECT MIN(q."id") FROM "peca" q
    WHERE q."status" = 'PENDENTE' AND q."ambiente_id" = p."ambiente_id" AND q."item_id" = p."item_id"
  );
