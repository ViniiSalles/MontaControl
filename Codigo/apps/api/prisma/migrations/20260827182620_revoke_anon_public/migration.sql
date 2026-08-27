-- Endurecimento: o Prisma cria tabelas em `public` via SQL cru, e o Supabase
-- não habilita RLS nelas (RLS-by-default só vale para tabelas criadas pelo
-- dashboard). Todo acesso passa pela API numa conexão privilegiada e nenhuma
-- anon/authenticated key toca `public` — mas revogar os grants default do
-- Postgres silencia o advisor `rls_disabled_in_public` e fecha a superfície.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
    REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
