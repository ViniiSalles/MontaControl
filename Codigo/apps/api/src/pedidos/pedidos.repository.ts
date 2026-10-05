import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type {
  PedidoComAmbientesDTO,
  PedidoDTO,
  PedidoResumoDTO,
  StatusPedido,
} from '@montacontrol/shared';
import {
  StatusPeca as StatusPecaPrisma,
  StatusPedido as StatusPedidoPrisma,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraPedidoComAmbientesDTO,
  paraPedidoDTO,
  SELECAO_PEDIDO,
  SELECAO_PEDIDO_COM_AMBIENTES,
} from './pedido-mapper';

export interface CoordenadasCliente {
  latitude: number;
  longitude: number;
}

export interface DadosItemNovo {
  descricao: string;
  quantidade: number;
}

export interface DadosAmbienteNovo {
  nome: string;
  itens: DadosItemNovo[];
}

/** Cliente do Prisma dentro de uma `$transaction` interativa. */
export type PrismaTransacao = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/** `PED-000042` — legível para o gestor, derivado do id da linha. */
function numeroDoPedido(id: number): string {
  return `PED-${String(id).padStart(6, '0')}`;
}

/** Atribuído ao montador (`pedido_montador`) ou com jornada dele vinculada ao pedido. */
function vinculoDoMontador(usuarioId: number) {
  return {
    OR: [{ montadores: { some: { usuarioId } } }, { jornadas: { some: { usuarioId } } }],
  };
}

@Injectable()
export class PedidosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Coordenadas do cliente do pedido, ou `null` se o pedido não existe. */
  async buscarCoordenadasCliente(pedidoId: number): Promise<CoordenadasCliente | null> {
    const linha = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { cliente: { select: { latitude: true, longitude: true } } },
    });
    if (!linha) return null;

    return {
      latitude: linha.cliente.latitude.toNumber(),
      longitude: linha.cliente.longitude.toNumber(),
    };
  }

  /**
   * Cria pedido + ambientes + um slot de `Peca` PENDENTE por item
   * planejado, tudo numa transação. `numeroPedido` só pode ser calculado
   * depois do insert (depende do id gerado), então nasce com um valor
   * temporário único e é corrigido em seguida, na mesma transação.
   */
  async criar(
    clienteId: number,
    ambientes: DadosAmbienteNovo[],
  ): Promise<{ id: number; numeroPedido: string }> {
    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.pedido.create({
        data: { clienteId, numeroPedido: `TEMP-${randomUUID()}` },
        select: { id: true },
      });
      const pedido = await tx.pedido.update({
        where: { id: criado.id },
        data: { numeroPedido: numeroDoPedido(criado.id) },
        select: { id: true, numeroPedido: true },
      });

      for (const ambiente of ambientes) {
        const ambienteCriado = await tx.ambiente.create({
          data: { pedidoId: pedido.id, nome: ambiente.nome },
          select: { id: true },
        });
        for (const item of ambiente.itens) {
          await this.criarItem(ambienteCriado.id, item.descricao, item.quantidade, tx);
        }
      }

      return pedido;
    });
  }

  /**
   * Um item do pedido = um slot: uma única linha de `Peca` PENDENTE que carrega
   * a `quantidade` planejada (150 pregos = 1 linha, bipada uma vez). `itemId`
   * recebe o próprio id da linha. Cada chamada cria um item novo, mesmo que já
   * exista outro com a mesma descrição no ambiente.
   */
  async criarItem(
    ambienteId: number,
    descricao: string,
    quantidade: number,
    tx?: PrismaTransacao,
  ): Promise<number> {
    const executar = async (cliente: PrismaTransacao): Promise<number> => {
      const slot = await cliente.peca.create({
        data: { ambienteId, descricao, quantidade, itemId: 0 },
        select: { id: true },
      });
      await cliente.peca.update({ where: { id: slot.id }, data: { itemId: slot.id } });
      return slot.id;
    };

    if (tx) return executar(tx);
    return this.prisma.$transaction(executar);
  }

  async listar(status?: StatusPedido): Promise<PedidoResumoDTO[]> {
    const linhas = await this.prisma.pedido.findMany({
      where: status ? { status: status as unknown as StatusPedidoPrisma } : undefined,
      select: {
        id: true,
        numeroPedido: true,
        status: true,
        clienteId: true,
        cliente: { select: { nome: true } },
        ambientes: { select: { pecas: { select: { status: true } } } },
      },
      orderBy: { id: 'desc' },
    });

    return linhas.map((linha) => {
      const pecas = linha.ambientes.flatMap((ambiente) => ambiente.pecas);
      return {
        id: linha.id,
        numeroPedido: linha.numeroPedido,
        status: linha.status as unknown as StatusPedido,
        clienteId: linha.clienteId,
        clienteNome: linha.cliente.nome,
        quantidadeTotal: pecas.length,
        quantidadeTriada: pecas.filter((peca) => peca.status !== StatusPecaPrisma.PENDENTE).length,
      };
    });
  }

  async buscarPorNumero(numeroPedido: string): Promise<PedidoDTO | null> {
    const linha = await this.prisma.pedido.findUnique({
      where: { numeroPedido },
      select: SELECAO_PEDIDO,
    });
    return linha ? paraPedidoDTO(linha) : null;
  }

  /** Peças agrupadas por ambiente (N7T3) — conferência visual antes do despacho. */
  async buscarComAmbientes(numeroPedido: string): Promise<PedidoComAmbientesDTO | null> {
    const linha = await this.prisma.pedido.findUnique({
      where: { numeroPedido },
      select: SELECAO_PEDIDO_COM_AMBIENTES,
    });
    return linha ? paraPedidoComAmbientesDTO(linha) : null;
  }

  /**
   * Montador está trabalhando no pedido: atribuído a ele (`pedido_montador`)
   * ou com jornada vinculada a ele. Qualquer jornada, não só a aberta — o
   * reporte pode sincronizar da outbox depois do check-out.
   */
  async montadorVinculado(pedidoId: number, usuarioId: number): Promise<boolean> {
    const total = await this.prisma.pedido.count({
      where: { id: pedidoId, ...vinculoDoMontador(usuarioId) },
    });
    return total > 0;
  }

  /** Pedidos em que o montador está trabalhando, com as peças — base do reporte de avaria no app. */
  async listarDoMontador(usuarioId: number): Promise<PedidoComAmbientesDTO[]> {
    const linhas = await this.prisma.pedido.findMany({
      where: vinculoDoMontador(usuarioId),
      orderBy: { id: 'desc' },
      select: SELECAO_PEDIDO_COM_AMBIENTES,
    });
    return linhas.map(paraPedidoComAmbientesDTO);
  }

  /** Primeira triagem do pedido: sai de AGUARDANDO para EM_TRIAGEM. Não-AGUARDANDO fica como está. */
  async marcarEmTriagem(id: number): Promise<void> {
    await this.prisma.pedido.updateMany({
      where: { id, status: StatusPedidoPrisma.AGUARDANDO },
      data: { status: StatusPedidoPrisma.EM_TRIAGEM },
    });
  }
}
