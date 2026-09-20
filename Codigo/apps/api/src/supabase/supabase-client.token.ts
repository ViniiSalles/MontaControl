export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

/**
 * Cliente à parte, exclusivo para chamadas GoTrue que estabelecem sessão
 * (`signInWithPassword`, `refreshSession`, `verifyOtp`). O `supabase-js`
 * sincroniza o header `Authorization` de Storage/PostgREST com a sessão
 * ativa do cliente — se essas chamadas usassem o mesmo cliente do
 * `SUPABASE_CLIENT` (service role), o upload de foto de atestado depois de
 * um login passaria a ir autenticado como o usuário logado, não mais como
 * service role, e cairia na RLS do bucket.
 */
export const SUPABASE_SESSION_CLIENT = Symbol('SUPABASE_SESSION_CLIENT');
