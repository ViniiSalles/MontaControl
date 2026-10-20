-- Conferência no descarregamento (US02): a peça bipada pelo montador no pedido
-- certo vira DESCARREGADA; bipada no descarregamento de outro pedido, INCONSISTENTE.
ALTER TYPE "StatusPeca" ADD VALUE IF NOT EXISTS 'DESCARREGADA' BEFORE 'ENTREGUE';
ALTER TYPE "StatusPeca" ADD VALUE IF NOT EXISTS 'INCONSISTENTE' BEFORE 'ENTREGUE';
