import { Injectable } from '@nestjs/common';
import type { AvariaDTO, StatusAvaria as StatusAvariaCompartilhado } from '@montacontrol/shared';
import { Perfil, StatusAvaria } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { paraAvariaDTO, SELECAO_AVARIA, SELECAO_AVARIA_DETALHADA } from './avaria-mapper';

export interface FotoArmazenada {
  storagePath: string;
  mimeType: string;
  tamanhoBytes: number;
}

export interface DadosNovaAvaria {
  pecaId: number;
  tipoAvariaId: number;
  registradaPor: number;
  idCliente: string;
  descricao: string;
  fotos: FotoArmazenada[];
}

export interface FiltroListagemAvarias {
  status?: StatusAvaria;
  origem?: Perfil;
  tipoAvariaId?: number;
  pedidoId?: number;
}

export interface DadosAnaliseAvaria {
  de: StatusAvaria;
  para: StatusAvaria;
  analistaId: number;
  parecer: string | null;
}

/** O detalhe do gestor precisa dos caminhos do bucket; o DTO público, nunca. */
export interface AvariaComFotos extends AvariaDTO {
  analisadaPorNome: string | null;
  fotos: Array<{ id: number; storagePath: string }>;
}

/**
 * Avaria do próprio registrador como o pull de sincronização a consome. Os
 * rótulos da peça, do ambiente e do pedido são cópia (snapshot): a avaria
 * continua na réplica depois que o montador perde o acesso ao pedido.
 */
export interface AvariaParaSync {
  id: number;
  idCliente: string | null;
  pecaId: number;
  pecaDescricao: string;
  ambienteNome: string;
  numeroPedido: string;
  tipoAvariaId: number;
  descricao: string;
  status: StatusAvariaCompartilhado;
  analisadaEm: Date | null;
  parecer: string | null;
  criadoEm: Date;
}

@Injectable()
export class AvariasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dados: DadosNovaAvaria): Promise<AvariaDTO> {
    const linha = await this.prisma.avaria.create({
      data: {
        pecaId: dados.pecaId,
        tipoAvariaId: dados.tipoAvariaId,
        registradaPor: dados.registradaPor,
        idCliente: dados.idCliente,
        descricao: dados.descricao,
        status: StatusAvaria.REPORTADA,
        fotos: { create: dados.fotos },
      },
      select: SELECAO_AVARIA,
    });
    return paraAvariaDTO(linha);
  }

  async buscarPorIdCliente(idCliente: string): Promise<AvariaDTO | null> {
    const linha = await this.prisma.avaria.findUnique({
      where: { idCliente },
      select: SELECAO_AVARIA,
    });
    return linha ? paraAvariaDTO(linha) : null;
  }

  async buscarPorId(id: number): Promise<AvariaComFotos | null> {
    const linha = await this.prisma.avaria.findUnique({
      where: { id },
      select: SELECAO_AVARIA_DETALHADA,
    });
    if (!linha) return null;
    return {
      ...paraAvariaDTO(linha),
      analisadaPorNome: linha.analista?.nome ?? null,
      fotos: linha.fotos,
    };
  }

  /** Fila do gestor: mais recente primeiro. */
  async listar(filtro: FiltroListagemAvarias): Promise<AvariaDTO[]> {
    const linhas = await this.prisma.avaria.findMany({
      where: {
        status: filtro.status,
        tipoAvariaId: filtro.tipoAvariaId,
        registrador: filtro.origem ? { perfil: filtro.origem } : undefined,
        peca: filtro.pedidoId ? { ambiente: { pedidoId: filtro.pedidoId } } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      select: SELECAO_AVARIA,
    });
    return linhas.map(paraAvariaDTO);
  }

  async listarPorRegistrador(usuarioId: number): Promise<AvariaDTO[]> {
    const linhas = await this.prisma.avaria.findMany({
      where: { registradaPor: usuarioId },
      orderBy: { createdAt: 'desc' },
      select: SELECAO_AVARIA,
    });
    return linhas.map(paraAvariaDTO);
  }

  /**
   * Avança o status só se ele ainda for `de` — dois gestores decidindo ao
   * mesmo tempo não sobrescrevem um ao outro. `null` quando perdeu a corrida.
   */
  async analisar(id: number, dados: DadosAnaliseAvaria): Promise<AvariaDTO | null> {
    const { count } = await this.prisma.avaria.updateMany({
      where: { id, status: dados.de },
      data: {
        status: dados.para,
        analisadaPor: dados.analistaId,
        analisadaAt: new Date(),
        parecer: dados.parecer,
      },
    });
    if (count === 0) return null;
    const linha = await this.prisma.avaria.findUniqueOrThrow({
      where: { id },
      select: SELECAO_AVARIA,
    });
    return paraAvariaDTO(linha);
  }

  /**
   * Linhas do pull de sincronização: avarias registradas por `usuarioId`
   * (nunca as de outros). No primeiro pull, criadas a partir de `janelaDesde`;
   * no incremental, sem janela, só as alteradas depois de `alteradosDesde`.
   * Sem fotos.
   */
  async listarParaSync(
    usuarioId: number,
    janelaDesde: Date | undefined,
    alteradosDesde?: Date,
  ): Promise<AvariaParaSync[]> {
    const linhas = await this.prisma.avaria.findMany({
      where: {
        registradaPor: usuarioId,
        createdAt: janelaDesde ? { gte: janelaDesde } : undefined,
        updatedAt: alteradosDesde ? { gt: alteradosDesde } : undefined,
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        idCliente: true,
        pecaId: true,
        tipoAvariaId: true,
        descricao: true,
        status: true,
        analisadaAt: true,
        parecer: true,
        createdAt: true,
        peca: {
          select: {
            descricao: true,
            ambiente: { select: { nome: true, pedido: { select: { numeroPedido: true } } } },
          },
        },
      },
    });
    return linhas.map((linha) => ({
      id: linha.id,
      idCliente: linha.idCliente,
      pecaId: linha.pecaId,
      pecaDescricao: linha.peca.descricao,
      ambienteNome: linha.peca.ambiente.nome,
      numeroPedido: linha.peca.ambiente.pedido.numeroPedido,
      tipoAvariaId: linha.tipoAvariaId,
      descricao: linha.descricao,
      status: linha.status as unknown as StatusAvariaCompartilhado,
      analisadaEm: linha.analisadaAt,
      parecer: linha.parecer,
      criadoEm: linha.createdAt,
    }));
  }
}
