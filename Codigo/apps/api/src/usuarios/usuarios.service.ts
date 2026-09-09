import { Injectable } from '@nestjs/common';
import { EmailJaCadastradoException } from '../common/exceptions/email-ja-cadastrado.exception';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { Perfil } from '../../generated/prisma';
import { InativacaoDoProprioUsuarioException } from './exceptions/inativacao-do-proprio-usuario.exception';
import { UsuarioNaoEncontradoException } from './exceptions/usuario-nao-encontrado.exception';
import { UsuariosRepository } from './usuarios.repository';
import { UsuarioListado } from './usuario-listado';

export interface DadosCadastroUsuario {
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly supabase: SupabaseAuthGateway,
  ) {}

  async listar(): Promise<UsuarioListado[]> {
    return this.usuarios.listar();
  }

  /**
   * Cria o usuário primeiro no Supabase Auth (fonte da unicidade de e-mail)
   * e só então a linha em `usuario`. Se o Postgres rejeitar depois do
   * GoTrue já ter criado a conta, desfaz o GoTrue para não deixar órfão.
   */
  async cadastrar(dados: DadosCadastroUsuario): Promise<UsuarioListado> {
    const authUserId = await this.supabase.criarUsuario(dados.email, dados.senha);
    if (!authUserId) throw new EmailJaCadastradoException();

    const usuario = await this.usuarios.criar({
      nome: dados.nome,
      email: dados.email,
      perfil: dados.perfil,
      authUserId,
    });
    if (!usuario) {
      await this.supabase.excluirUsuario(authUserId);
      throw new EmailJaCadastradoException();
    }
    return usuario;
  }

  /**
   * Inativação é o "desligamento" do montador: a linha fica, o histórico de
   * ponto fica, e o `SupabaseJwtGuard` passa a recusar o token na primeira
   * requisição seguinte. Reativar é o mesmo caminho com `ativo: true`.
   */
  async alterarAtivo(id: number, ativo: boolean, solicitanteId: number): Promise<UsuarioListado> {
    if (!ativo && id === solicitanteId) throw new InativacaoDoProprioUsuarioException();

    const usuario = await this.usuarios.alterarAtivo(id, ativo);
    if (!usuario) throw new UsuarioNaoEncontradoException();
    return usuario;
  }
}
