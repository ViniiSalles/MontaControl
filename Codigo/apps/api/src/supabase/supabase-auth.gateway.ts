import { Inject, Injectable } from '@nestjs/common';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { SessaoSupabase } from './sessao-supabase';
import { SUPABASE_CLIENT, SUPABASE_SESSION_CLIENT } from './supabase-client.token';

/**
 * Única classe que conhece `@supabase/supabase-js`. Encapsula toda a
 * superfície do GoTrue usada pelo módulo de autenticação, para que o resto
 * da API trabalhe só com tipos de domínio.
 *
 * Duas instâncias de cliente: chamadas que estabelecem sessão
 * (`signInWithPassword`, `refreshSession`, `verifyOtp`) vão sempre pelo
 * `SUPABASE_SESSION_CLIENT`, nunca pelo `cliente` (service role) usado nas
 * chamadas admin — o `supabase-js` sincroniza o header `Authorization` de
 * Storage/PostgREST com a sessão ativa da instância, e o `cliente` também é
 * injetado no `SupabaseStorageGateway`.
 */
@Injectable()
export class SupabaseAuthGateway {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly cliente: SupabaseClient,
    @Inject(SUPABASE_SESSION_CLIENT) private readonly clienteSessao: SupabaseClient,
  ) {}

  async entrarComSenha(email: string, senha: string): Promise<SessaoSupabase | null> {
    const { data, error } = await this.clienteSessao.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error || !data.session || !data.user) return null;
    return this.mapearSessao(data.session, data.user);
  }

  async renovarSessao(refreshToken: string): Promise<SessaoSupabase | null> {
    const { data, error } = await this.clienteSessao.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session || !data.user) return null;
    return this.mapearSessao(data.session, data.user);
  }

  /** Sempre silenciosa: nunca propaga erro do GoTrue, para não permitir enumeração de e-mail. */
  async solicitarRecuperacaoSenha(email: string, redirectTo: string): Promise<void> {
    await this.cliente.auth.resetPasswordForEmail(email, { redirectTo });
  }

  async verificarTokenRecuperacao(email: string, token: string): Promise<string | null> {
    const { data, error } = await this.clienteSessao.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });
    if (error || !data.user) return null;
    return data.user.id;
  }

  async atualizarSenha(authUserId: string, novaSenha: string): Promise<boolean> {
    const { error } = await this.cliente.auth.admin.updateUserById(authUserId, {
      password: novaSenha,
    });
    return !error;
  }

  async encerrarSessao(accessToken: string): Promise<void> {
    await this.cliente.auth.admin.signOut(accessToken);
  }

  async criarUsuario(email: string, senha: string): Promise<string | null> {
    const { data, error } = await this.cliente.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (error || !data.user) return null;
    return data.user.id;
  }

  /** Compensação: usada quando o cadastro no Postgres falha após o GoTrue já ter criado o usuário. */
  async excluirUsuario(authUserId: string): Promise<void> {
    await this.cliente.auth.admin.deleteUser(authUserId);
  }

  private mapearSessao(session: Session, user: User): SessaoSupabase {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 0,
      authUserId: user.id,
      email: user.email ?? '',
    };
  }
}
