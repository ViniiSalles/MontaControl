import { Injectable } from '@nestjs/common';
import type { AtestadoDTO } from '@montacontrol/shared';
import type { PeriodoAbonado } from '@montacontrol/shared';
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
}
