import { Injectable } from '@nestjs/common';
import type { PecaDTO } from '@montacontrol/shared';
import { StatusPeca } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { paraPecaDTO, SELECAO_PECA } from './peca-mapper';

const CODIGO_PRISMA_VIOLACAO_UNICIDADE = 'P2002';

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

export interface DadosNovaPeca {
  ambienteId: number;
  codigoBarras: string;
  descricao: string;
  triadaPor: number;
}

@Injectable()
export class PecasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorCodigoBarras(codigoBarras: string): Promise<{ id: number } | null> {
    return this.prisma.peca.findUnique({
      where: { codigoBarras },
      select: { id: true },
    });
  }

  /**
   * Tria a peça lida. Se o gestor já cadastrou uma unidade PENDENTE com essa
   * descrição no ambiente, ela é "consumida" (recebe código de barras e vira
   * TRIADA); caso contrário nasce uma peça nova, já TRIADA, como item próprio.
   * `null` em violação de unicidade (N7T2) — o código de barras já foi triado por outra peça.
   */
  async criar(dados: DadosNovaPeca): Promise<PecaDTO | null> {
    try {
      const reivindicada = await this.reivindicarPendente(dados);
      if (reivindicada) return reivindicada;

      const linha = await this.prisma.peca.create({
        data: {
          ambienteId: dados.ambienteId,
          itemId: 0,
          codigoBarras: dados.codigoBarras,
          descricao: dados.descricao,
          status: StatusPeca.TRIADA,
          triadaPor: dados.triadaPor,
        },
        select: SELECAO_PECA,
      });
      const agrupada = await this.prisma.peca.update({
        where: { id: linha.id },
        data: { itemId: linha.id },
        select: SELECAO_PECA,
      });
      return paraPecaDTO(agrupada);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) return null;
      throw erro;
    }
  }

  private async reivindicarPendente(dados: DadosNovaPeca): Promise<PecaDTO | null> {
    const pendente = await this.prisma.peca.findFirst({
      where: {
        ambienteId: dados.ambienteId,
        status: StatusPeca.PENDENTE,
        descricao: { equals: dados.descricao, mode: 'insensitive' },
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!pendente) return null;

    // `status: PENDENTE` no where evita que duas leituras simultâneas
    // consumam a mesma unidade; quem perder a corrida cai no `create`.
    const { count } = await this.prisma.peca.updateMany({
      where: { id: pendente.id, status: StatusPeca.PENDENTE },
      data: {
        codigoBarras: dados.codigoBarras,
        status: StatusPeca.TRIADA,
        triadaPor: dados.triadaPor,
      },
    });
    if (count === 0) return null;

    const linha = await this.prisma.peca.findUniqueOrThrow({
      where: { id: pendente.id },
      select: SELECAO_PECA,
    });
    return paraPecaDTO(linha);
  }
}
