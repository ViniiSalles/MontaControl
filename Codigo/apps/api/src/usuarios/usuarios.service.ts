import { Injectable } from '@nestjs/common';
import { somenteDigitos } from '@montacontrol/shared';
import { EmailJaCadastradoException } from '../common/exceptions/email-ja-cadastrado.exception';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { Perfil } from '../../generated/prisma';
import { CpfJaCadastradoException } from './exceptions/cpf-ja-cadastrado.exception';
import { CpfJaInformadoException } from './exceptions/cpf-ja-informado.exception';
import { CpfObrigatorioException } from './exceptions/cpf-obrigatorio.exception';
import { InativacaoDoProprioUsuarioException } from './exceptions/inativacao-do-proprio-usuario.exception';
import { UsuarioNaoEncontradoException } from './exceptions/usuario-nao-encontrado.exception';
import { UsuariosRepository } from './usuarios.repository';
import { UsuarioListado } from './usuario-listado';

export interface DadosCadastroUsuario {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  perfil: Perfil;
  cpf?: string;
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
    const cpf = dados.cpf ? somenteDigitos(dados.cpf) : null;
    if (dados.perfil === Perfil.MONTADOR && !cpf) throw new CpfObrigatorioException();

    const authUserId = await this.supabase.criarUsuario(dados.email, dados.senha);
    if (!authUserId) throw new EmailJaCadastradoException();

    const usuario = await this.usuarios.criar({
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone ?? null,
      perfil: dados.perfil,
      cpf,
      authUserId,
    });
    if (usuario === 'CPF_DUPLICADO') {
      await this.supabase.excluirUsuario(authUserId);
      throw new CpfJaCadastradoException();
    }
    if (!usuario) {
      await this.supabase.excluirUsuario(authUserId);
      throw new EmailJaCadastradoException();
    }
    return usuario;
  }

  /**
   * "Definir uma vez": se o usuário já tem CPF, a rota recusa com 409 antes
   * de tocar no repositório — sobrescrever um CPF já usado para selar
   * marcações de ponto deixaria o hash daquelas marcações (calculado com o
   * CPF antigo) inconsistente com o que a exportação do AFD emitiria dali
   * em diante. Casa com a UI, que só mostra "Informar CPF" quando o
   * montador ainda não tem um.
   */
  async informarCpf(id: number, cpf: string): Promise<UsuarioListado> {
    const usuarioAtual = await this.usuarios.buscarPorId(id);
    if (!usuarioAtual) throw new UsuarioNaoEncontradoException();
    if (usuarioAtual.cpf) throw new CpfJaInformadoException();

    const usuario = await this.usuarios.definirCpf(id, somenteDigitos(cpf));
    if (usuario === 'CPF_DUPLICADO') throw new CpfJaCadastradoException();
    if (!usuario) throw new UsuarioNaoEncontradoException();
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
