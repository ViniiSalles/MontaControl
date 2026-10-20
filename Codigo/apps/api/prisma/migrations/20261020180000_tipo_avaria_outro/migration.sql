-- Tipo "Outro": problema fora da lista; o montador o descreve na descrição da
-- avaria. Só dados — o esquema não muda. Idempotente: não duplica se alguém
-- já cadastrou "Outro" à mão.
INSERT INTO "tipo_avaria" ("nome", "descricao", "created_at", "updated_at")
SELECT 'Outro', 'Problema não listado — detalhado na descrição', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "tipo_avaria" WHERE LOWER("nome") = 'outro');
