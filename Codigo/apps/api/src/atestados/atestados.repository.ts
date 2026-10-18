import { Injectable } from '@nestjs/common';
import type { AtestadoDTO } from '@montacontrol/shared';
import type {
  PeriodoAbonado,
  StatusAtestado as StatusAtestadoCompartilhado,
} from '@montacontrol/shared';
import { StatusAtestado } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  SELECAO_ATESTADO,
  SELECAO_ATESTADO_COM_FOTOS,
  paraAtestadoDTO,
} from './atestado-mapper';

export interface FotoArmazenada {
  storagePath: string;
  mimeType: string;
  tamanhoBytes: number;
}

export interface DadosNovoAtestado {
  usuarioId: number;
  idCliente: string;
  dataInicio: string;
  dataFim: string;
  observacao: string | null;
  fotos: FotoArmazenada[];
}

export interface DadosAnalise {
  status: StatusAtestado;
  analistaId: number;
  motivoRejeicao: string | null;
}

/** O detalhe do RH precisa dos caminhos do bucket; o DTO público, nunca. */
export interface AtestadoComFotos extends AtestadoDTO {
  fotos: Array<{ id: number; storagePath: string }>;
}

/** Atestado como o pull de sincronização o consome (sem fotos, sem dados de terceiros). */
export interface AtestadoParaSync {
  id: number;
  idCliente: string;
  /** Coluna `DATE`: meia-noite UTC do dia civil. */
  dataInicio: Date;
  dataFim: Date;
  observacao: string | null;
  status: StatusAtestadoCompartilhado;
  motivoRejeicao: string | null;
  validadoEm: Date | null;
  criadoEm: Date;
}

@Injectable()
export class AtestadosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dados: DadosNovoAtestado): Promise<AtestadoDTO> {
    const linha = await this.prisma.atestado.create({
      data: {
        usuarioId: dados.usuarioId,
        idCliente: dados.idCliente,
        dataInicio: new Date(`${dados.dataInicio}T00:00:00.000Z`),
        dataFim: new Date(`${dados.dataFim}T00:00:00.000Z`),
        observacao: dados.observacao,
        status: StatusAtestado.PENDENTE,
        fotos: { create: dados.fotos },
      },
      select: SELECAO_ATESTADO,
    });
    return paraAtestadoDTO(linha);
  }

  async buscarPorIdCliente(idCliente: string): Promise<AtestadoDTO | null> {
    const linha = await this.prisma.atestado.findUnique({
      where: { idCliente },
      select: SELECAO_ATESTADO,
    });
    return linha ? paraAtestadoDTO(linha) : null;
  }

  async buscarPorId(id: number): Promise<AtestadoComFotos | null> {
    const linha = await this.prisma.atestado.findUnique({
      where: { id },
      select: SELECAO_ATESTADO_COM_FOTOS,
    });
    return linha ? { ...paraAtestadoDTO(linha), fotos: linha.fotos } : null;
  }

  async listarPorStatus(status: StatusAtestado): Promise<AtestadoDTO[]> {
    const linhas = await this.prisma.atestado.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      select: SELECAO_ATESTADO,
    });
    return linhas.map(paraAtestadoDTO);
  }

  /** Histórico do RH: tudo que já saiu de PENDENTE, mais recente analisado primeiro. */
  async listarAnalisados(): Promise<AtestadoDTO[]> {
    const linhas = await this.prisma.atestado.findMany({
      where: { status: { in: [StatusAtestado.VALIDADO, StatusAtestado.REJEITADO] } },
      orderBy: { validadoAt: 'desc' },
      select: SELECAO_ATESTADO,
    });
    return linhas.map(paraAtestadoDTO);
  }

  async listarPorUsuario(usuarioId: number): Promise<AtestadoDTO[]> {
    const linhas = await this.prisma.atestado.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      select: SELECAO_ATESTADO,
    });
    return linhas.map(paraAtestadoDTO);
  }

  /** Insumo do abono no banco de horas: só os validados que cruzam o período. */
  async listarValidadosNoPeriodo(
    usuarioId: number,
    inicio: string,
    fim: string,
  ): Promise<PeriodoAbonado[]> {
    const linhas = await this.prisma.atestado.findMany({
      where: {
        usuarioId,
        status: StatusAtestado.VALIDADO,
        dataInicio: { lte: new Date(`${fim}T00:00:00.000Z`) },
        dataFim: { gte: new Date(`${inicio}T00:00:00.000Z`) },
      },
      select: { dataInicio: true, dataFim: true },
    });
    return linhas.map((linha) => ({
      dataInicio: linha.dataInicio.toISOString().slice(0, 10),
      dataFim: linha.dataFim.toISOString().slice(0, 10),
    }));
  }

  async analisar(id: number, dados: DadosAnalise): Promise<AtestadoDTO> {
    const linha = await this.prisma.atestado.update({
      where: { id },
      data: {
        status: dados.status,
        validadoPor: dados.analistaId,
        validadoAt: new Date(),
        motivoRejeicao: dados.motivoRejeicao,
      },
      select: SELECAO_ATESTADO,
    });
    return paraAtestadoDTO(linha);
  }

  /**
   * Linhas do pull de sincronização: atestados do usuário criados a partir de
   * `janelaDesde` e, no pull incremental, alterados depois de `alteradosDesde`
   * (a validação/rejeição do RH muda `updated_at`).
   */
  async listarParaSync(
    usuarioId: number,
    janelaDesde: Date,
    alteradosDesde?: Date,
  ): Promise<AtestadoParaSync[]> {
    const linhas = await this.prisma.atestado.findMany({
      where: {
        usuarioId,
        createdAt: { gte: janelaDesde },
        updatedAt: alteradosDesde ? { gt: alteradosDesde } : undefined,
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        idCliente: true,
        dataInicio: true,
        dataFim: true,
        observacao: true,
        status: true,
        motivoRejeicao: true,
        validadoAt: true,
        createdAt: true,
      },
    });
    return linhas.map((linha) => ({
      id: linha.id,
      idCliente: linha.idCliente,
      dataInicio: linha.dataInicio,
      dataFim: linha.dataFim,
      observacao: linha.observacao,
      status: linha.status as unknown as StatusAtestadoCompartilhado,
      motivoRejeicao: linha.motivoRejeicao,
      validadoEm: linha.validadoAt,
      criadoEm: linha.createdAt,
    }));
  }
}
