import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { PedidoResumoDTO, StatusPedido } from '@montacontrol/shared';
import {
  StatusPeca as StatusPecaPrisma,
  type StatusPedido as StatusPedidoPrisma,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

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
   * Cria pedido + ambientes + uma linha de `Peca` PENDENTE por unidade
   * planejada, tudo numa transação. `numeroPedido` só pode ser calculado
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
   * Um item do pedido = N linhas de `Peca` com o mesmo `itemId`, que é o id da
   * primeira linha do grupo. Cada chamada cria um item novo, mesmo que já
   * exista outro com a mesma descrição no ambiente.
   */
  async criarItem(
    ambienteId: number,
    descricao: string,
    quantidade: number,
    tx?: PrismaTransacao,
  ): Promise<number> {
    const executar = async (cliente: PrismaTransacao): Promise<number> => {
      const cabeca = await cliente.peca.create({
        data: { ambienteId, descricao, itemId: 0 },
        select: { id: true },
      });
      await cliente.peca.update({ where: { id: cabeca.id }, data: { itemId: cabeca.id } });
      if (quantidade > 1) {
        await cliente.peca.createMany({
          data: Array.from({ length: quantidade - 1 }, () => ({
            ambienteId,
            descricao,
            itemId: cabeca.id,
          })),
        });
      }
      return cabeca.id;
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
}
