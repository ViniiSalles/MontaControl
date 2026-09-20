import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
