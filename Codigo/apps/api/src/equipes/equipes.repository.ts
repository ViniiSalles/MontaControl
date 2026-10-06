import { Injectable } from '@nestjs/common';
import type { EquipeDTO } from '@montacontrol/shared';
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
    select: { usuario: { select: { id: true, nome: true, ativo: true } } },
    orderBy: { usuario: { nome: 'asc' as const } },
  },
} as const;

interface LinhaEquipe {
  id: number;
  nome: string;
  membros: Array<{ usuario: { id: number; nome: string; ativo: boolean } }>;
}

function paraEquipeDTO(linha: LinhaEquipe): EquipeDTO {
  return { id: linha.id, nome: linha.nome, membros: linha.membros.map((membro) => membro.usuario) };
}

export type FalhaEquipe = 'NOME_DUPLICADO' | 'NAO_ENCONTRADA';

@Injectable()
export class EquipesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<EquipeDTO[]> {
    const linhas = await this.prisma.equipe.findMany({
      orderBy: { nome: 'asc' },
      select: SELECAO_EQUIPE,
    });
    return linhas.map(paraEquipeDTO);
  }

  async criar(nome: string, membrosIds: number[]): Promise<EquipeDTO | FalhaEquipe> {
    try {
      const linha = await this.prisma.equipe.create({
        data: { nome, membros: { create: membrosIds.map((usuarioId) => ({ usuarioId })) } },
        select: SELECAO_EQUIPE,
      });
      return paraEquipeDTO(linha);
    } catch (erro) {
      if (codigoPrisma(erro) === CODIGO_PRISMA_VIOLACAO_UNICIDADE) return 'NOME_DUPLICADO';
      throw erro;
    }
  }

  /** Renomeia e troca os membros de uma vez — a lista enviada é a equipe inteira. */
  async atualizar(id: number, nome: string, membrosIds: number[]): Promise<EquipeDTO | FalhaEquipe> {
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
      return paraEquipeDTO(linha);
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
