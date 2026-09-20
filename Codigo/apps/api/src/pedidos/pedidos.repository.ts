import { Injectable } from '@nestjs/common';
import type { PedidoComAmbientesDTO, PedidoDTO } from '@montacontrol/shared';
import { StatusPedido } from '../../generated/prisma';
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

  /** Primeira triagem do pedido: sai de AGUARDANDO para EM_TRIAGEM. Não-AGUARDANDO fica como está. */
  async marcarEmTriagem(id: number): Promise<void> {
    await this.prisma.pedido.updateMany({
      where: { id, status: StatusPedido.AGUARDANDO },
      data: { status: StatusPedido.EM_TRIAGEM },
    });
  }
}
