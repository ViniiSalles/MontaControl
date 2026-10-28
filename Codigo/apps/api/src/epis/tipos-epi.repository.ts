import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CODIGO_PRISMA_VIOLACAO_UNICIDADE = 'P2002';
const CODIGO_PRISMA_NAO_ENCONTRADO = 'P2025';

/** Checagem por forma (não `instanceof`), igual a `equipes.repository.ts`. */
function codigoPrisma(erro: unknown): unknown {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? (erro as { code?: unknown }).code
    : undefined;
}

const SELECAO_TIPO_EPI = { id: true, nome: true, descricao: true, validadeMeses: true, estoque: true } as const;

export interface TipoEpi {
  id: number;
  nome: string;
  descricao: string;
  validadeMeses: number;
  estoque: number;
}

export type DadosTipoEpi = Omit<TipoEpi, 'id'>;

export type FalhaTipoEpi = 'NOME_DUPLICADO' | 'NAO_ENCONTRADO';

@Injectable()
export class TiposEpiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<TipoEpi[]> {
    return this.prisma.tipoEpi.findMany({ orderBy: { nome: 'asc' }, select: SELECAO_TIPO_EPI });
  }

  async buscarPorId(id: number): Promise<TipoEpi | null> {
    return this.prisma.tipoEpi.findUnique({ where: { id }, select: SELECAO_TIPO_EPI });
  }

  async criar(dados: DadosTipoEpi): Promise<TipoEpi | FalhaTipoEpi> {
    try {
      return await this.prisma.tipoEpi.create({ data: dados, select: SELECAO_TIPO_EPI });
    } catch (erro) {
      if (codigoPrisma(erro) === CODIGO_PRISMA_VIOLACAO_UNICIDADE) return 'NOME_DUPLICADO';
      throw erro;
    }
  }

  async atualizar(id: number, dados: DadosTipoEpi): Promise<TipoEpi | FalhaTipoEpi> {
    try {
      return await this.prisma.tipoEpi.update({ where: { id }, data: dados, select: SELECAO_TIPO_EPI });
    } catch (erro) {
      const codigo = codigoPrisma(erro);
      if (codigo === CODIGO_PRISMA_VIOLACAO_UNICIDADE) return 'NOME_DUPLICADO';
      if (codigo === CODIGO_PRISMA_NAO_ENCONTRADO) return 'NAO_ENCONTRADO';
      throw erro;
    }
  }
}
