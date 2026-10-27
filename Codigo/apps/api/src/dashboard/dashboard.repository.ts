import { Injectable } from '@nestjs/common';
import type { StatusPedido as StatusPedidoCompartilhado } from '@montacontrol/shared';
import { StatusAvaria, StatusJornada, StatusPeca } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export interface PecaParaAcompanhamento {
  status: StatusPeca;
  triadaAt: Date | null;
  conferidaAt: Date | null;
  avariasAbertas: number;
}

export interface PedidoParaAcompanhamento {
  id: number;
  numeroPedido: string;
  status: StatusPedidoCompartilhado;
  cliente: { nome: string; cidade: string; estado: string };
  montadores: string[];
  pecas: PecaParaAcompanhamento[];
}

export interface EventoDeJornada {
  jornadaId: number;
  montador: string;
  numeroPedido: string | null;
  em: Date;
}

export interface EventoDeAvaria {
  avariaId: number;
  montador: string;
  pecaDescricao: string;
  tipo: string;
  numeroPedido: string;
  em: Date;
}

/** Uma peça bipada (triagem ou descarregamento); o service agrupa por pedido. */
export interface EventoDeBipagem {
  pedidoId: number;
  numeroPedido: string;
  responsavel: string | null;
  em: Date;
}

export interface EventoDeInconsistencia {
  pecaId: number;
  pecaDescricao: string;
  codigoBarras: string | null;
  numeroPedido: string;
  em: Date;
}

export interface EventosRecentes {
  checkins: EventoDeJornada[];
  checkouts: EventoDeJornada[];
  avarias: EventoDeAvaria[];
  triagens: EventoDeBipagem[];
  descarregamentos: EventoDeBipagem[];
  inconsistencias: EventoDeInconsistencia[];
}

export interface PecaRastreada {
  id: number;
  descricao: string;
  codigoBarras: string | null;
  ambiente: string;
  quantidade: number;
  status: StatusPeca;
  triadaPor: string | null;
  triadaAt: Date | null;
  conferidaPor: string | null;
  conferidaAt: Date | null;
}

const NO_CLIENTE = [StatusPeca.DESCARREGADA, StatusPeca.ENTREGUE];

/**
 * Leituras agregadas do dashboard do gestor. Só leitura: nada aqui altera
 * estado — o dashboard é uma visão sobre pedidos, peças, jornadas e avarias.
 */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPedidosParaAcompanhamento(): Promise<PedidoParaAcompanhamento[]> {
    const pedidos = await this.prisma.pedido.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        numeroPedido: true,
        status: true,
        cliente: { select: { nome: true, cidade: true, estado: true } },
        montadores: { select: { usuario: { select: { nome: true } } }, orderBy: { id: 'asc' } },
        ambientes: {
          select: {
            pecas: {
              select: {
                status: true,
                triadaAt: true,
                conferidaAt: true,
                _count: {
                  select: { avarias: { where: { status: { not: StatusAvaria.RESOLVIDA } } } },
                },
              },
            },
          },
        },
      },
    });

    return pedidos.map((pedido) => ({
      id: pedido.id,
      numeroPedido: pedido.numeroPedido,
      status: pedido.status as unknown as StatusPedidoCompartilhado,
      cliente: pedido.cliente,
      montadores: pedido.montadores.map((vinculo) => vinculo.usuario.nome),
      pecas: pedido.ambientes.flatMap((ambiente) =>
        ambiente.pecas.map((peca) => ({
          status: peca.status,
          triadaAt: peca.triadaAt,
          conferidaAt: peca.conferidaAt,
          avariasAbertas: peca._count.avarias,
        })),
      ),
    }));
  }

  /** Peças do pedido com quem as bipou — `null` quando o pedido não existe. */
  async listarPecasRastreadas(pedidoId: number): Promise<PecaRastreada[] | null> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        ambientes: {
          orderBy: { nome: 'asc' },
          select: {
            nome: true,
            pecas: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                descricao: true,
                codigoBarras: true,
                quantidade: true,
                status: true,
                triadaAt: true,
                conferidaAt: true,
                triador: { select: { nome: true } },
                conferente: { select: { nome: true } },
              },
            },
          },
        },
      },
    });
    if (!pedido) return null;

    return pedido.ambientes.flatMap((ambiente) =>
      ambiente.pecas.map((peca) => ({
        id: peca.id,
        descricao: peca.descricao,
        codigoBarras: peca.codigoBarras,
        ambiente: ambiente.nome,
        quantidade: peca.quantidade,
        status: peca.status,
        triadaPor: peca.triador?.nome ?? null,
        triadaAt: peca.triadaAt,
        conferidaPor: peca.conferente?.nome ?? null,
        conferidaAt: peca.conferidaAt,
      })),
    );
  }

  /** Montadores distintos com jornada aberta e check-in a partir de `desde`. */
  async contarMontadoresEmCampo(desde: Date): Promise<number> {
    const linhas = await this.prisma.jornada.findMany({
      where: { status: StatusJornada.EM_ANDAMENTO, checkinAt: { gte: desde } },
      distinct: ['usuarioId'],
      select: { usuarioId: true },
    });
    return linhas.length;
  }

  async contarAvariasDesde(desde: Date): Promise<number> {
    return this.prisma.avaria.count({ where: { createdAt: { gte: desde } } });
  }

  async contarAvariasAbertas(): Promise<number> {
    return this.prisma.avaria.count({ where: { status: { not: StatusAvaria.RESOLVIDA } } });
  }

  async contarPecasInconsistentes(): Promise<number> {
    return this.prisma.peca.count({ where: { status: StatusPeca.INCONSISTENTE } });
  }

  /** EPIs ativos com validade até `limite` (inclui os já vencidos). */
  async contarEpisVencendoAte(limite: Date): Promise<number> {
    return this.prisma.epi.count({ where: { ativo: true, dataValidade: { lte: limite } } });
  }

  async listarInstantesDeTriagemDesde(desde: Date): Promise<Date[]> {
    const linhas = await this.prisma.peca.findMany({
      where: { triadaAt: { gte: desde } },
      select: { triadaAt: true },
    });
    return linhas.flatMap((linha) => (linha.triadaAt ? [linha.triadaAt] : []));
  }

  async listarInstantesDeDescarregamentoDesde(desde: Date): Promise<Date[]> {
    const linhas = await this.prisma.peca.findMany({
      where: { status: { in: NO_CLIENTE }, conferidaAt: { gte: desde } },
      select: { conferidaAt: true },
    });
    return linhas.flatMap((linha) => (linha.conferidaAt ? [linha.conferidaAt] : []));
  }

  /**
   * Os `limite` eventos mais recentes de cada tipo, sem recorte de tempo — com
   * operação parada, o feed ainda mostra o que aconteceu por último. Bipagens
   * viram um alerta por leva, então delas vêm até `limiteDeBipagens` leituras.
   */
  async listarEventosRecentes(limite: number, limiteDeBipagens: number): Promise<EventosRecentes> {
    const [checkins, checkouts, avarias, triagens, descarregamentos, inconsistencias] =
      await Promise.all([
        this.prisma.jornada.findMany({
          where: { checkinAt: { not: null } },
          orderBy: { checkinAt: 'desc' },
          take: limite,
          select: {
            id: true,
            checkinAt: true,
            usuario: { select: { nome: true } },
            pedido: { select: { numeroPedido: true } },
          },
        }),
        this.prisma.jornada.findMany({
          where: { checkoutAt: { not: null } },
          orderBy: { checkoutAt: 'desc' },
          take: limite,
          select: {
            id: true,
            checkoutAt: true,
            usuario: { select: { nome: true } },
            pedido: { select: { numeroPedido: true } },
          },
        }),
        this.prisma.avaria.findMany({
          orderBy: { createdAt: 'desc' },
          take: limite,
          select: {
            id: true,
            createdAt: true,
            registrador: { select: { nome: true } },
            tipoAvaria: { select: { nome: true } },
            peca: {
              select: {
                descricao: true,
                ambiente: { select: { pedido: { select: { numeroPedido: true } } } },
              },
            },
          },
        }),
        this.prisma.peca.findMany({
          where: { triadaAt: { not: null } },
          orderBy: { triadaAt: 'desc' },
          take: limiteDeBipagens,
          select: {
            triadaAt: true,
            triador: { select: { nome: true } },
            ambiente: { select: { pedido: { select: { id: true, numeroPedido: true } } } },
          },
        }),
        this.prisma.peca.findMany({
          where: { status: { in: NO_CLIENTE }, conferidaAt: { not: null } },
          orderBy: { conferidaAt: 'desc' },
          take: limiteDeBipagens,
          select: {
            conferidaAt: true,
            conferente: { select: { nome: true } },
            ambiente: { select: { pedido: { select: { id: true, numeroPedido: true } } } },
          },
        }),
        this.prisma.peca.findMany({
          where: { status: StatusPeca.INCONSISTENTE },
          orderBy: { updatedAt: 'desc' },
          take: limite,
          select: {
            id: true,
            descricao: true,
            codigoBarras: true,
            updatedAt: true,
            ambiente: { select: { pedido: { select: { numeroPedido: true } } } },
          },
        }),
      ]);

    return {
      checkins: checkins.flatMap((jornada) =>
        jornada.checkinAt
          ? [
              {
                jornadaId: jornada.id,
                montador: jornada.usuario.nome,
                numeroPedido: jornada.pedido?.numeroPedido ?? null,
                em: jornada.checkinAt,
              },
            ]
          : [],
      ),
      checkouts: checkouts.flatMap((jornada) =>
        jornada.checkoutAt
          ? [
              {
                jornadaId: jornada.id,
                montador: jornada.usuario.nome,
                numeroPedido: jornada.pedido?.numeroPedido ?? null,
                em: jornada.checkoutAt,
              },
            ]
          : [],
      ),
      avarias: avarias.map((avaria) => ({
        avariaId: avaria.id,
        montador: avaria.registrador.nome,
        pecaDescricao: avaria.peca.descricao,
        tipo: avaria.tipoAvaria.nome,
        numeroPedido: avaria.peca.ambiente.pedido.numeroPedido,
        em: avaria.createdAt,
      })),
      triagens: triagens.flatMap((peca) =>
        peca.triadaAt
          ? [
              {
                pedidoId: peca.ambiente.pedido.id,
                numeroPedido: peca.ambiente.pedido.numeroPedido,
                responsavel: peca.triador?.nome ?? null,
                em: peca.triadaAt,
              },
            ]
          : [],
      ),
      descarregamentos: descarregamentos.flatMap((peca) =>
        peca.conferidaAt
          ? [
              {
                pedidoId: peca.ambiente.pedido.id,
                numeroPedido: peca.ambiente.pedido.numeroPedido,
                responsavel: peca.conferente?.nome ?? null,
                em: peca.conferidaAt,
              },
            ]
          : [],
      ),
      inconsistencias: inconsistencias.map((peca) => ({
        pecaId: peca.id,
        pecaDescricao: peca.descricao,
        codigoBarras: peca.codigoBarras,
        numeroPedido: peca.ambiente.pedido.numeroPedido,
        em: peca.updatedAt,
      })),
    };
  }
}
