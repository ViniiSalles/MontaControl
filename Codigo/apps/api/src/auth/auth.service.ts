import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SessaoSupabase } from '../supabase/sessao-supabase';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { UsuarioAutenticado } from './usuario-autenticado';

/** Mensagem única para toda falha de login — nunca diferencia a etapa que falhou. */
const MENSAGEM_CREDENCIAIS_INVALIDAS = 'Credenciais inválidas';

export interface ResultadoLogin {
  sessao: SessaoSupabase;
  usuario: UsuarioAutenticado;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseAuthGateway,
    private readonly usuarios: UsuariosRepository,
  ) {}

  /**
   * N1T1/N1T2: senha errada, usuário sem linha em `usuario` e usuário
   * inativo retornam exatamente o mesmo 401 — nunca 400, nunca uma
   * mensagem que revele qual etapa falhou.
   */
  async login(email: string, senha: string): Promise<ResultadoLogin> {
    const sessao = await this.supabase.entrarComSenha(email, senha);
    if (!sessao) throw new UnauthorizedException(MENSAGEM_CREDENCIAIS_INVALIDAS);

    const usuario = await this.usuarios.buscarPorAuthUserId(sessao.authUserId);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException(MENSAGEM_CREDENCIAIS_INVALIDAS);
    }

    return { sessao, usuario };
  }
}
