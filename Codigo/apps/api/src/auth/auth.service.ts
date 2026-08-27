import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredenciaisInvalidasException } from '../common/exceptions/credenciais-invalidas.exception';
import { TokenInvalidoException } from '../common/exceptions/token-invalido.exception';
import { SessaoSupabase } from '../supabase/sessao-supabase';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { UsuarioAutenticado } from './usuario-autenticado';

const MENSAGEM_TOKEN_RECUPERACAO_INVALIDO = 'Token inválido ou expirado';

export interface ResultadoLogin {
  sessao: SessaoSupabase;
  usuario: UsuarioAutenticado;
}

@Injectable()
export class AuthService {
  private readonly redirectRecuperacaoSenha: string;

  constructor(
    private readonly supabase: SupabaseAuthGateway,
    private readonly usuarios: UsuariosRepository,
    config: ConfigService,
  ) {
    this.redirectRecuperacaoSenha = config.getOrThrow<string>('PASSWORD_RESET_REDIRECT_URL');
  }

  /**
   * N1T1/N1T2: senha errada, usuário sem linha em `usuario` e usuário
   * inativo retornam exatamente o mesmo 401 — nunca 400, nunca uma
   * mensagem que revele qual etapa falhou.
   */
  async login(email: string, senha: string): Promise<ResultadoLogin> {
    const sessao = await this.supabase.entrarComSenha(email, senha);
    if (!sessao) throw new CredenciaisInvalidasException();

    const usuario = await this.buscarUsuarioAtivo(sessao.authUserId, () => new CredenciaisInvalidasException());
    return { sessao, usuario };
  }

  /** TI02, lado do refresh: token revogado/expirado nunca gera sessão nova. */
  async refresh(refreshToken: string): Promise<ResultadoLogin> {
    const sessao = await this.supabase.renovarSessao(refreshToken);
    if (!sessao) throw new TokenInvalidoException();

    const usuario = await this.buscarUsuarioAtivo(sessao.authUserId, () => new TokenInvalidoException());
    return { sessao, usuario };
  }

  /** Sempre silencioso na borda (controller responde 202 fixo) — sem enumeração de e-mail. */
  async solicitarRecuperacaoSenha(email: string): Promise<void> {
    await this.supabase.solicitarRecuperacaoSenha(email, this.redirectRecuperacaoSenha);
  }

  async redefinirSenha(email: string, token: string, novaSenha: string): Promise<void> {
    const authUserId = await this.supabase.verificarTokenRecuperacao(email, token);
    if (!authUserId) throw new BadRequestException(MENSAGEM_TOKEN_RECUPERACAO_INVALIDO);

    const sucesso = await this.supabase.atualizarSenha(authUserId, novaSenha);
    if (!sucesso) throw new BadRequestException(MENSAGEM_TOKEN_RECUPERACAO_INVALIDO);
  }

  async sair(accessToken: string): Promise<void> {
    await this.supabase.encerrarSessao(accessToken);
  }

  private async buscarUsuarioAtivo(
    authUserId: string,
    criarExcecao: () => UnauthorizedException,
  ): Promise<UsuarioAutenticado> {
    const usuario = await this.usuarios.buscarPorAuthUserId(authUserId);
    if (!usuario || !usuario.ativo) throw criarExcecao();
    return usuario;
  }
}
