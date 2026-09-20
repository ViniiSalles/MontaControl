import { Injectable } from '@nestjs/common';
import { StatusJornada, StatusSolicitacaoPonto } from '../../generated/prisma';
import type { SolicitacaoPontoDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SELECAO_SOLICITACAO, paraSolicitacaoPontoDTO } from './solicitacao-ponto-mapper';

export interface DadosSolicitacao {
  usuarioId: number;
  idCliente: string;
  /** Dia civil `YYYY-MM-DD`; vira `DATE` no banco. */
  data: string;
  inicioIso: string;
  fimIso: string;
  minutosSolicitados: number;
  justificativa: string;
}

@Injectable()
export class PontosEmAtrasoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: number): Promise<SolicitacaoPontoDTO | null> {
    const linha = await this.prisma.solicitacaoPonto.findUnique({
      where: { id },
      select: SELECAO_SOLICITACAO,
    });
    return linha ? paraSolicitacaoPontoDTO(linha) : null;
  }

  /** Chave de idempotência da outbox: o mesmo envio repetido devolve a mesma solicitação. */
  async buscarPorIdCliente(idCliente: string): Promise<SolicitacaoPontoDTO | null> {
    const linha = await this.prisma.solicitacaoPonto.findUnique({
      where: { idCliente },
      select: SELECAO_SOLICITACAO,
    });
    return linha ? paraSolicitacaoPontoDTO(linha) : null;
  }

  async existePendenteNoDia(usuarioId: number, data: string): Promise<boolean> {
    const total = await this.prisma.solicitacaoPonto.count({
      where: {
        usuarioId,
        data: new Date(`${data}T00:00:00.000Z`),
        status: StatusSolicitacaoPonto.PENDENTE,
      },
    });
    return total > 0;
  }

  async criar(dados: DadosSolicitacao): Promise<SolicitacaoPontoDTO> {
    const linha = await this.prisma.solicitacaoPonto.create({
      data: {
        usuarioId: dados.usuarioId,
        idCliente: dados.idCliente,
        // Coluna `DATE`: a meia-noite UTC é o jeito canônico de escrever um
        // dia civil sem arrastar fuso junto.
        data: new Date(`${dados.data}T00:00:00.000Z`),
        inicio: new Date(dados.inicioIso),
        fim: new Date(dados.fimIso),
        minutosSolicitados: dados.minutosSolicitados,
        justificativa: dados.justificativa,
        status: StatusSolicitacaoPonto.PENDENTE,
      },
      select: SELECAO_SOLICITACAO,
    });
    return paraSolicitacaoPontoDTO(linha);
  }

  async listarPendentes(): Promise<SolicitacaoPontoDTO[]> {
    const linhas = await this.prisma.solicitacaoPonto.findMany({
      where: { status: StatusSolicitacaoPonto.PENDENTE },
      // A fila do analista é sempre "pendentes, mais antigas primeiro" (índice [status, data]).
      orderBy: { data: 'asc' },
      select: SELECAO_SOLICITACAO,
    });
    return linhas.map(paraSolicitacaoPontoDTO);
  }

  /** Quantas compensações aguardam análise, por montador — coluna do painel do RH. */
  async contarPendentesPorUsuario(usuarioIds: number[]): Promise<Map<number, number>> {
    const grupos = await this.prisma.solicitacaoPonto.groupBy({
      by: ['usuarioId'],
      where: { usuarioId: { in: usuarioIds }, status: StatusSolicitacaoPonto.PENDENTE },
      _count: { _all: true },
    });
    return new Map(grupos.map((grupo) => [grupo.usuarioId, grupo._count._all]));
  }

  /**
   * Jornada e mudança de status na mesma transação: a hora aprovada só existe
   * como jornada, e uma metade sem a outra é hora paga em dobro ou perdida.
   * A jornada nasce FINALIZADA e sem GPS — não houve check-in em campo.
   */
  async aprovar(id: number, analistaId: number): Promise<SolicitacaoPontoDTO> {
    const linha = await this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacaoPonto.findUniqueOrThrow({
        where: { id },
        select: { usuarioId: true, inicio: true, fim: true },
      });

      const jornada = await tx.jornada.create({
        data: {
          usuarioId: solicitacao.usuarioId,
          checkinAt: solicitacao.inicio,
          checkoutAt: solicitacao.fim,
          status: StatusJornada.FINALIZADA,
        },
        select: { id: true },
      });

      return tx.solicitacaoPonto.update({
        where: { id },
        data: {
          status: StatusSolicitacaoPonto.APROVADA,
          jornadaId: jornada.id,
          analisadoPor: analistaId,
          analisadoEm: new Date(),
        },
        select: SELECAO_SOLICITACAO,
      });
    });
    return paraSolicitacaoPontoDTO(linha);
  }

  async rejeitar(id: number, analistaId: number, motivo: string): Promise<SolicitacaoPontoDTO> {
    const linha = await this.prisma.solicitacaoPonto.update({
      where: { id },
      data: {
        status: StatusSolicitacaoPonto.REJEITADA,
        analisadoPor: analistaId,
        analisadoEm: new Date(),
        motivoRejeicao: motivo,
      },
      select: SELECAO_SOLICITACAO,
    });
    return paraSolicitacaoPontoDTO(linha);
  }
}
