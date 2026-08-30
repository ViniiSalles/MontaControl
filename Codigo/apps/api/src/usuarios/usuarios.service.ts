import { Injectable } from '@nestjs/common';
import { EmailJaCadastradoException } from '../common/exceptions/email-ja-cadastrado.exception';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { Perfil } from '../../generated/prisma';
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
}
