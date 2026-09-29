import { Injectable } from '@nestjs/common';
import { Prisma, StatusJornada, TipoMarcacao } from '../../generated/prisma';
import { LIMITE_JORNADA_MS } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CHAVE_LOCK_NSR } from '../common/marcacao-ponto-lock';
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

/** Marcação é "offline" quando a gravação chegou mais de 2 min depois de acontecer no aparelho. */
const LIMITE_OFFLINE_MS = 2 * 60_000;
const COLETOR_APLICATIVO_MOBILE = '01';

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
    return this.prisma.$transaction(async (tx) => {
      const linha = await tx.jornada.create({
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
      await this.registrarMarcacao(tx, {
        usuarioId: dados.usuarioId,
        jornadaId: linha.id,
        tipo: TipoMarcacao.ENTRADA,
        marcadoEm: dados.checkinAt,
      });
      return paraJornadaDTO(linha);
    });
  }

  async registrarCheckout(jornadaId: number, dados: DadosCheckout): Promise<JornadaDTO> {
    return this.prisma.$transaction(async (tx) => {
      const linha = await tx.jornada.update({
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
      await this.registrarMarcacao(tx, {
        usuarioId: linha.usuarioId,
        jornadaId,
        tipo: TipoMarcacao.SAIDA,
        marcadoEm: dados.checkoutAt,
      });
      return paraJornadaDTO(linha);
    });
  }

  /**
   * Grava a marcação de ponto (NSR) na mesma transação do check-in/check-out.
   * NSR sem buracos: `pg_advisory_xact_lock` + `MAX(nsr)+1` dentro da
   * transação — nunca uma sequence, que deixaria buracos em rollback.
   *
   * `pg_advisory_xact_lock` retorna `void`, e o driver adapter `@prisma/adapter-pg`
   * não sabe deserializar essa coluna (`UnsupportedNativeDataType`) — por isso o
   * `IS NULL` no final, só para dar ao resultado um tipo (`boolean`) que o
   * adapter consegue ler; o valor em si é descartado.
   *
   * Correção do `MAX(nsr)+1` depende do nível de isolamento padrão (READ
   * COMMITTED): o `aggregate` abaixo enxerga um snapshot novo, tirado depois
   * de adquirir o lock. Se algum dia alguém passar um `isolationLevel`
   * explícito para este `$transaction`, essa suposição precisa ser
   * reconferida.
   */
  private async registrarMarcacao(
    tx: Prisma.TransactionClient,
    dados: { usuarioId: number; jornadaId: number; tipo: TipoMarcacao; marcadoEm: Date },
  ): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CHAVE_LOCK_NSR}::bigint) IS NULL`;
    const agregado = await tx.marcacaoPonto.aggregate({ _max: { nsr: true } });
    const proximoNsr = (agregado._max.nsr ?? 0) + 1;
    const gravadoEm = new Date();
    await tx.marcacaoPonto.create({
      data: {
        nsr: proximoNsr,
        usuarioId: dados.usuarioId,
        jornadaId: dados.jornadaId,
        tipo: dados.tipo,
        marcadoEm: dados.marcadoEm,
        gravadoEm,
        coletor: COLETOR_APLICATIVO_MOBILE,
        offline: gravadoEm.getTime() - dados.marcadoEm.getTime() > LIMITE_OFFLINE_MS,
      },
    });
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
