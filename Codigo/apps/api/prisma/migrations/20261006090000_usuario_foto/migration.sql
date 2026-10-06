-- Foto opcional do usuário (cadastro de montador). Só o caminho no bucket
-- privado; a URL é assinada sob demanda.
ALTER TABLE "usuario" ADD COLUMN "foto_path" TEXT;
