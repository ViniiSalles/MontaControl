import { Injectable } from '@nestjs/common';
import { StatusSolicitacaoPonto } from '../../generated/prisma';
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
}
