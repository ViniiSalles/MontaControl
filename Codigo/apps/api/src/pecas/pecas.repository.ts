import { Injectable } from '@nestjs/common';
import type { PecaDTO, StatusPeca as StatusPecaCompartilhado } from '@montacontrol/shared';
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

/** Peça de um pedido atribuído ao montador, como o pull de sincronização a consome. */
export interface PecaParaSync {
  id: number;
  ambienteId: number;
  codigoBarras: string | null;
  descricao: string;
  quantidade: number;
  status: StatusPecaCompartilhado;
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

  async buscarPorId(
    id: number,
  ): Promise<{ id: number; status: StatusPeca; pedidoId: number } | null> {
    const linha = await this.prisma.peca.findUnique({
      where: { id },
      select: { id: true, status: true, ambiente: { select: { pedidoId: true } } },
    });
    return linha ? { id: linha.id, status: linha.status, pedidoId: linha.ambiente.pedidoId } : null;
  }

  /**
   * Dá código de barras a uma peça ainda PENDENTE e a marca TRIADA. `null` se
   * a peça deixou de estar PENDENTE (corrida) ou o código já pertence a outra (N7T2).
   */
  async associarCodigoBarras(
    id: number,
    codigoBarras: string,
    triadaPor: number,
  ): Promise<PecaDTO | null> {
    try {
      const { count } = await this.prisma.peca.updateMany({
        where: { id, status: StatusPeca.PENDENTE },
        data: { codigoBarras, status: StatusPeca.TRIADA, triadaPor },
      });
      if (count === 0) return null;
      const linha = await this.prisma.peca.findUniqueOrThrow({
        where: { id },
        select: SELECAO_PECA,
      });
      return paraPecaDTO(linha);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) return null;
      throw erro;
    }
  }

  /** Peça triada com esse código e o pedido a que pertence — base da conferência do montador. */
  async buscarParaConferencia(
    codigoBarras: string,
  ): Promise<{ id: number; status: StatusPeca; pedidoId: number } | null> {
    const linha = await this.prisma.peca.findUnique({
      where: { codigoBarras },
      select: { id: true, status: true, ambiente: { select: { pedidoId: true } } },
    });
    return linha ? { id: linha.id, status: linha.status, pedidoId: linha.ambiente.pedidoId } : null;
  }

  /**
   * Muda o status só se a peça ainda estiver num dos `de` — a condição no
   * `where` torna a transição segura contra leituras simultâneas. Devolve se
   * mudou. `conferidaPor` só acompanha a conferência que deu certo.
   */
  async registrarConferencia(
    id: number,
    de: readonly StatusPeca[],
    para: typeof StatusPeca.DESCARREGADA | typeof StatusPeca.INCONSISTENTE,
    usuarioId: number,
  ): Promise<boolean> {
    const { count } = await this.prisma.peca.updateMany({
      where: { id, status: { in: [...de] } },
      data:
        para === StatusPeca.DESCARREGADA
          ? { status: para, conferidaPor: usuarioId, conferidaAt: new Date() }
          : { status: para },
    });
    return count > 0;
  }

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

  /**
   * Linhas do pull de sincronização: peças dos pedidos atribuídos ao montador.
   * No pull incremental, as alteradas depois de `alteradosDesde` e todas as
   * dos pedidos em que ele foi atribuído depois disso.
   */
  async listarParaSync(usuarioId: number, alteradosDesde?: Date): Promise<PecaParaSync[]> {
    const linhas = await this.prisma.peca.findMany({
      where: {
        ambiente: { pedido: { montadores: { some: { usuarioId } } } },
        ...(alteradosDesde
          ? {
              OR: [
                { updatedAt: { gt: alteradosDesde } },
                {
                  ambiente: {
                    pedido: {
                      montadores: { some: { usuarioId, createdAt: { gt: alteradosDesde } } },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        ambienteId: true,
        codigoBarras: true,
        descricao: true,
        quantidade: true,
        status: true,
      },
    });
    return linhas.map((linha) => ({
      ...linha,
      status: linha.status as unknown as StatusPecaCompartilhado,
    }));
  }
}
