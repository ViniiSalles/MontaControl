import { Inject, Injectable } from '@nestjs/common';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { SessaoSupabase } from './sessao-supabase';
import { SUPABASE_CLIENT } from './supabase-client.token';

/**
 * Única classe que conhece `@supabase/supabase-js`. Encapsula toda a
 * superfície do GoTrue usada pelo módulo de autenticação, para que o resto
 * da API trabalhe só com tipos de domínio.
 */
@Injectable()
export class SupabaseAuthGateway {
  constructor(@Inject(SUPABASE_CLIENT) private readonly cliente: SupabaseClient) {}

  async entrarComSenha(email: string, senha: string): Promise<SessaoSupabase | null> {
    const { data, error } = await this.cliente.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error || !data.session || !data.user) return null;
    return this.mapearSessao(data.session, data.user);
  }

  async renovarSessao(refreshToken: string): Promise<SessaoSupabase | null> {
    const { data, error } = await this.cliente.auth.refreshSession({
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
    const { data, error } = await this.cliente.auth.verifyOtp({
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
