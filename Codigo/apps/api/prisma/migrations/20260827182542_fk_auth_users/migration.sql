-- Migração escrita à mão: o Prisma não modela `auth.users` sem `multiSchema`,
-- então esta FK entre schemas não pode nascer de `migrate diff`. `ON DELETE
-- RESTRICT` porque apagar um usuário do Auth não deve derrubar em silêncio um
-- montador com histórico de jornada — o DER usa soft delete via `usuario.ativo`.
ALTER TABLE "usuario"
    ADD CONSTRAINT "usuario_auth_user_id_fkey"
    FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
