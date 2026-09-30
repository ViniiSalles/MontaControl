-- Novo estado inicial da peça: cadastrada pelo gestor, ainda sem código de barras.
-- Em migração separada da que usa o valor como DEFAULT: no Postgres um valor de
-- enum recém-criado não pode ser usado na mesma transação em que foi adicionado.
ALTER TYPE "StatusPeca" ADD VALUE IF NOT EXISTS 'PENDENTE' BEFORE 'TRIADA';
