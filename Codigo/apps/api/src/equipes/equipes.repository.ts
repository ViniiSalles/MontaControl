import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CODIGO_PRISMA_VIOLACAO_UNICIDADE = 'P2002';
const CODIGO_PRISMA_NAO_ENCONTRADO = 'P2025';

/** Checagem por forma (não `instanceof`), igual a `pecas.repository.ts`. */
function codigoPrisma(erro: unknown): unknown {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? (erro as { code?: unknown }).code
    : undefined;
}

const SELECAO_EQUIPE = {
  id: true,
  nome: true,
  membros: {
    select: {
      usuario: {
        select: { id: true, nome: true, ativo: true, email: true, telefone: true, fotoPath: true },
      },
    },
    orderBy: { usuario: { nome: 'asc' as const } },
  },
} as const;

/** Membro com o caminho cru da foto — o service troca por URL assinada. */
export interface MembroComFoto {
  id: number;
  nome: string;
  ativo: boolean;
  email: string;
  telefone: string | null;
  fotoPath: string | null;
}

export interface EquipeComMembros {
  id: number;
  nome: string;
  membros: MembroComFoto[];
}

interface LinhaEquipe {
  id: number;
  nome: string;
  membros: Array<{ usuario: MembroComFoto }>;
}

function paraEquipe(linha: LinhaEquipe): EquipeComMembros {
  return { id: linha.id, nome: linha.nome, membros: linha.membros.map((membro) => membro.usuario) };
}

export type FalhaEquipe = 'NOME_DUPLICADO' | 'NAO_ENCONTRADA';

@Injectable()
export class EquipesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<EquipeComMembros[]> {
    const linhas = await this.prisma.equipe.findMany({
      orderBy: { nome: 'asc' },
      select: SELECAO_EQUIPE,
    });
    return linhas.map(paraEquipe);
  }

  async criar(nome: string, membrosIds: number[]): Promise<EquipeComMembros | FalhaEquipe> {
    try {
      const linha = await this.prisma.equipe.create({
        data: { nome, membros: { create: membrosIds.map((usuarioId) => ({ usuarioId })) } },
        select: SELECAO_EQUIPE,
      });
      return paraEquipe(linha);
    } catch (erro) {
      if (codigoPrisma(erro) === CODIGO_PRISMA_VIOLACAO_UNICIDADE) return 'NOME_DUPLICADO';
      throw erro;
    }
  }

  /** Renomeia e troca os membros de uma vez — a lista enviada é a equipe inteira. */
  async atualizar(id: number, nome: string, membrosIds: number[]): Promise<EquipeComMembros | FalhaEquipe> {
    try {
      const linha = await this.prisma.equipe.update({
        where: { id },
        data: {
          nome,
          membros: {
            deleteMany: {},
            create: membrosIds.map((usuarioId) => ({ usuarioId })),
          },
        },
        select: SELECAO_EQUIPE,
      });
      return paraEquipe(linha);
    } catch (erro) {
      const codigo = codigoPrisma(erro);
      if (codigo === CODIGO_PRISMA_VIOLACAO_UNICIDADE) return 'NOME_DUPLICADO';
      if (codigo === CODIGO_PRISMA_NAO_ENCONTRADO) return 'NAO_ENCONTRADA';
      throw erro;
    }
  }

  /** Membros saem junto (cascade); obras já atribuídas não mudam — a atribuição é por pessoa. */
  async remover(id: number): Promise<boolean> {
    const { count } = await this.prisma.equipe.deleteMany({ where: { id } });
    return count > 0;
  }
}
