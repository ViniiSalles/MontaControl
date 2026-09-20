import { StatusAmbiente, StatusPedido } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { PedidosRepository } from './pedidos.repository';

describe('PedidosRepository', () => {
  let prisma: { pedido: { findUnique: jest.Mock; updateMany: jest.Mock } };
  let repository: PedidosRepository;

  beforeEach(() => {
    prisma = {
      pedido: { findUnique: jest.fn(), updateMany: jest.fn() },
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

  describe('buscarPorNumero', () => {
    it('mapeia o pedido encontrado', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 3,
        numeroPedido: 'PED-001',
        status: StatusPedido.AGUARDANDO,
        clienteId: 1,
      });

      const pedido = await repository.buscarPorNumero('PED-001');

      expect(pedido).toEqual({ id: 3, numeroPedido: 'PED-001', status: StatusPedido.AGUARDANDO, clienteId: 1 });
    });

    it('retorna null quando o número do pedido não existe', async () => {
      prisma.pedido.findUnique.mockResolvedValue(null);

      const pedido = await repository.buscarPorNumero('PED-INEXISTENTE');

      expect(pedido).toBeNull();
    });
  });

  describe('buscarComAmbientes', () => {
    it('mapeia o pedido com os ambientes e as peças agrupadas', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 3,
        numeroPedido: 'PED-001',
        status: StatusPedido.EM_TRIAGEM,
        clienteId: 1,
        ambientes: [
          {
            id: 4,
            nome: 'Cozinha',
            status: StatusAmbiente.PENDENTE,
            pecas: [
              { id: 9, codigoBarras: 'COD-123', descricao: 'Porta', status: 'TRIADA', ambienteId: 4 },
            ],
          },
        ],
      });

      const pedido = await repository.buscarComAmbientes('PED-001');

      expect(pedido).toEqual({
        id: 3,
        numeroPedido: 'PED-001',
        status: StatusPedido.EM_TRIAGEM,
        clienteId: 1,
        ambientes: [
          {
            id: 4,
            nome: 'Cozinha',
            status: StatusAmbiente.PENDENTE,
            pecas: [{ id: 9, codigoBarras: 'COD-123', descricao: 'Porta', status: 'TRIADA', ambienteId: 4 }],
          },
        ],
      });
    });

    it('retorna null quando o pedido não existe', async () => {
      prisma.pedido.findUnique.mockResolvedValue(null);

      const pedido = await repository.buscarComAmbientes('PED-INEXISTENTE');

      expect(pedido).toBeNull();
    });
  });

  describe('marcarEmTriagem', () => {
    it('atualiza só pedidos AGUARDANDO para EM_TRIAGEM', async () => {
      prisma.pedido.updateMany.mockResolvedValue({ count: 1 });

      await repository.marcarEmTriagem(3);

      expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
        where: { id: 3, status: StatusPedido.AGUARDANDO },
        data: { status: StatusPedido.EM_TRIAGEM },
      });
    });
  });
});
