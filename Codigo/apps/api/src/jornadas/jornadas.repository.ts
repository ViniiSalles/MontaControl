import { Injectable } from '@nestjs/common';
import { StatusJornada } from '../../generated/prisma';
import { LIMITE_JORNADA_MS } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SELECAO_JORNADA, paraJornadaDTO } from './jornada-mapper';

export interface DadosCheckin {
  usuarioId: number;
  idCliente: string;
  latitude: number;
  longitude: number;
  endereco: string | null;
  checkinAt: Date;
  pedidoId: number | null;
}

export interface DadosCheckout {
  idCliente: string;
  latitude: number;
  longitude: number;
  endereco: string | null;
  checkoutAt: Date;
  pedidoId: number | null;
}

/** Status que caracterizam jornada aberta — a que impede um segundo check-in. */
const STATUS_ABERTOS = [StatusJornada.EM_ANDAMENTO, StatusJornada.PAUSADA];

@Injectable()
export class JornadasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorCheckinIdCliente(usuarioId: number, idCliente: string): Promise<JornadaDTO | null> {
    const linha = await this.prisma.jornada.findFirst({
      where: { usuarioId, checkinIdCliente: idCliente },
      select: SELECAO_JORNADA,
    });
    return linha ? paraJornadaDTO(linha) : null;
  }

  async buscarPorCheckoutIdCliente(usuarioId: number, idCliente: string): Promise<JornadaDTO | null> {
    const linha = await this.prisma.jornada.findFirst({
      where: { usuarioId, checkoutIdCliente: idCliente },
      select: SELECAO_JORNADA,
    });
    return linha ? paraJornadaDTO(linha) : null;
  }

  async buscarAbertaDoUsuario(usuarioId: number): Promise<JornadaDTO | null> {
    const linha = await this.prisma.jornada.findFirst({
      where: { usuarioId, status: { in: STATUS_ABERTOS } },
      orderBy: { checkinAt: 'desc' },
      select: SELECAO_JORNADA,
    });
    return linha ? paraJornadaDTO(linha) : null;
  }

  async criarCheckin(dados: DadosCheckin): Promise<JornadaDTO> {
    const linha = await this.prisma.jornada.create({
      data: {
        usuarioId: dados.usuarioId,
        pedidoId: dados.pedidoId,
        checkinIdCliente: dados.idCliente,
        checkinLatitude: dados.latitude,
        checkinLongitude: dados.longitude,
        checkinEndereco: dados.endereco,
        checkinAt: dados.checkinAt,
        status: StatusJornada.EM_ANDAMENTO,
      },
      select: SELECAO_JORNADA,
    });
    return paraJornadaDTO(linha);
  }

  async registrarCheckout(jornadaId: number, dados: DadosCheckout): Promise<JornadaDTO> {
    const linha = await this.prisma.jornada.update({
      where: { id: jornadaId },
      data: {
        // `undefined` (não `null`) quando ausente: um `update` do Prisma
        // apaga a coluna com `null`, e o pedido já gravado no check-in não
        // pode ser perdido só porque o check-out não informou um.
        pedidoId: dados.pedidoId ?? undefined,
        checkoutIdCliente: dados.idCliente,
        checkoutLatitude: dados.latitude,
        checkoutLongitude: dados.longitude,
        checkoutEndereco: dados.endereco,
        checkoutAt: dados.checkoutAt,
        status: StatusJornada.FINALIZADA,
      },
      select: SELECAO_JORNADA,
    });
    return paraJornadaDTO(linha);
  }

  async listarNoPeriodo(usuarioId: number, inicioIso: string, fimIso: string): Promise<JornadaDTO[]> {
    const linhas = await this.prisma.jornada.findMany({
      where: { usuarioId, checkinAt: { gte: new Date(inicioIso), lte: new Date(fimIso) } },
      orderBy: { checkinAt: 'desc' },
      select: SELECAO_JORNADA,
    });
    return linhas.map(paraJornadaDTO);
  }

  /**
   * Justificativa da solicitação de ponto por trás de cada jornada lançada em
   * atraso no período — o espelho mostra o mesmo texto da fila de
   * compensações, em vez de um rótulo genérico.
   */
  async mapaJustificativasLancadasNoPeriodo(
    usuarioId: number,
    inicioIso: string,
    fimIso: string,
  ): Promise<Map<number, string>> {
    const linhas = await this.prisma.jornada.findMany({
      where: {
        usuarioId,
        checkinAt: { gte: new Date(inicioIso), lte: new Date(fimIso) },
        solicitacaoPonto: { isNot: null },
      },
      select: { id: true, solicitacaoPonto: { select: { justificativa: true } } },
    });
    return new Map(
      linhas
        .filter(
          (linha): linha is typeof linha & { solicitacaoPonto: { justificativa: string } } =>
            linha.solicitacaoPonto !== null,
        )
        .map((linha) => [linha.id, linha.solicitacaoPonto.justificativa]),
    );
  }

  /** Cursor do pull do WatermelonDB: tudo que mudou depois de `desdeMs`. */
  async listarAlteradasDesde(usuarioId: number, desdeMs: number): Promise<JornadaDTO[]> {
    const linhas = await this.prisma.jornada.findMany({
      where: { usuarioId, updatedAt: { gt: new Date(desdeMs) } },
      select: SELECAO_JORNADA,
    });
    return linhas.map(paraJornadaDTO);
  }

  /**
   * Existe jornada do usuário cujo intervalo cruza `[inicio, fim]`?
   * Aprovar um ponto em atraso sobre uma jornada existente pagaria a mesma
   * hora duas vezes.
   *
   * Jornada aberta ocupa `[check-in, check-in + limite]`, e não daqui até o
   * infinito: um check-out esquecido em maio não pode barrar o lançamento
   * de um ponto em atraso de agosto.
   */
  async existeSobreposicao(
    usuarioId: number,
    inicioIso: string,
    fimIso: string,
    ignorarJornadaId?: number,
  ): Promise<boolean> {
    const inicio = new Date(inicioIso);
    const total = await this.prisma.jornada.count({
      where: {
        usuarioId,
        id: ignorarJornadaId ? { not: ignorarJornadaId } : undefined,
        checkinAt: { lte: new Date(fimIso) },
        OR: [
          { checkoutAt: { gte: inicio } },
          {
            AND: [
              { checkoutAt: null },
              { checkinAt: { gte: new Date(inicio.getTime() - LIMITE_JORNADA_MS) } },
            ],
          },
        ],
      },
    });
    return total > 0;
  }
}
