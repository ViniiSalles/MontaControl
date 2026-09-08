import { PrismaService } from '../prisma/prisma.service';
import { PedidosRepository } from './pedidos.repository';

describe('PedidosRepository', () => {
  let prisma: { pedido: { findUnique: jest.Mock } };
  let repository: PedidosRepository;

  beforeEach(() => {
    prisma = {
      pedido: { findUnique: jest.fn() },
    };
    repository = new PedidosRepository(prisma as unknown as PrismaService);
  });

  describe('buscarCoordenadasCliente', () => {
    it('retorna as coordenadas do cliente do pedido', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        cliente: { latitude: { toNumber: () => -19.9325 }, longitude: { toNumber: () => -43.9382 } },
      });

      const coordenadas = await repository.buscarCoordenadasCliente(10);

      expect(coordenadas).toEqual({ latitude: -19.9325, longitude: -43.9382 });
      expect(prisma.pedido.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { cliente: { select: { latitude: true, longitude: true } } },
      });
    });

    it('retorna null quando o pedido não existe', async () => {
      prisma.pedido.findUnique.mockResolvedValue(null);

      const coordenadas = await repository.buscarCoordenadasCliente(999);

      expect(coordenadas).toBeNull();
    });
  });
});
