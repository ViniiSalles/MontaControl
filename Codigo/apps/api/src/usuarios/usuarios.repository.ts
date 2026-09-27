import { Injectable } from '@nestjs/common';
import { Perfil } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { UsuarioListado } from './usuario-listado';

const CODIGO_PRISMA_VIOLACAO_UNICIDADE = 'P2002';
const CODIGO_PRISMA_REGISTRO_NAO_ENCONTRADO = 'P2025';

export interface DadosNovoUsuario {
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  perfil: Perfil;
  authUserId: string;
}

/**
 * Checagem por forma (não `instanceof`): o cliente Prisma gerado no build
 * pode divergir, por identidade de módulo, da classe importada aqui.
 */
function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: unknown }).code === CODIGO_PRISMA_VIOLACAO_UNICIDADE
  );
}

function alvoDaViolacao(erro: unknown): string {
  const meta = (erro as { meta?: { target?: unknown } }).meta;
  return Array.isArray(meta?.target) ? meta.target.join(',') : String(meta?.target ?? '');
}

function ehRegistroNaoEncontrado(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: unknown }).code === CODIGO_PRISMA_REGISTRO_NAO_ENCONTRADO
  );
}

const SELECAO_USUARIO_AUTENTICADO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  authUserId: true,
} as const;

const SELECAO_USUARIO_LISTADO = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  perfil: true,
  ativo: true,
  cpf: true,
  createdAt: true,
} as const;

@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorAuthUserId(authUserId: string): Promise<UsuarioAutenticado | null> {
    return this.prisma.usuario.findUnique({
      where: { authUserId },
      select: SELECAO_USUARIO_AUTENTICADO,
    });
  }

  async buscarPorId(id: number): Promise<UsuarioListado | null> {
    return this.prisma.usuario.findUnique({
      where: { id },
      select: SELECAO_USUARIO_LISTADO,
    });
  }

  async listar(): Promise<UsuarioListado[]> {
    return this.prisma.usuario.findMany({
      select: SELECAO_USUARIO_LISTADO,
      orderBy: { nome: 'asc' },
    });
  }

  /** `null` = e-mail ou authUserId já existentes; `'CPF_DUPLICADO'` = CPF já usado por outro usuário. */
  async criar(dados: DadosNovoUsuario): Promise<UsuarioListado | 'CPF_DUPLICADO' | null> {
    try {
      return await this.prisma.usuario.create({
        data: dados,
        select: SELECAO_USUARIO_LISTADO,
      });
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) return alvoDaViolacao(erro).includes('cpf') ? 'CPF_DUPLICADO' : null;
      throw erro;
    }
  }

  /** `null` = usuário inexistente; `'CPF_DUPLICADO'` = outro usuário já tem esse CPF. */
  async definirCpf(id: number, cpf: string): Promise<UsuarioListado | 'CPF_DUPLICADO' | null> {
    try {
      return await this.prisma.usuario.update({ where: { id }, data: { cpf }, select: SELECAO_USUARIO_LISTADO });
    } catch (erro) {
      if (ehRegistroNaoEncontrado(erro)) return null;
      if (ehViolacaoDeUnicidade(erro)) return 'CPF_DUPLICADO';
      throw erro;
    }
  }

  /** Retorna `null` quando não existe usuário com esse id. */
  async alterarAtivo(id: number, ativo: boolean): Promise<UsuarioListado | null> {
    try {
      return await this.prisma.usuario.update({
        where: { id },
        data: { ativo },
        select: SELECAO_USUARIO_LISTADO,
      });
    } catch (erro) {
      if (ehRegistroNaoEncontrado(erro)) return null;
      throw erro;
    }
  }
}
