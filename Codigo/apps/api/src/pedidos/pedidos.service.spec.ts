import { NotFoundException } from '@nestjs/common';
import { StatusAmbiente, StatusPedido } from '../../generated/prisma';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

const pedidoComAmbientes = {
  id: 3,
  numeroPedido: 'PED-001',
  status: StatusPedido.EM_TRIAGEM,
  clienteId: 1,
  ambientes: [{ id: 4, nome: 'Cozinha', status: StatusAmbiente.PENDENTE, pecas: [] }],
};

describe('PedidosService', () => {
  let pedidos: { buscarComAmbientes: jest.Mock };
  let service: PedidosService;

  beforeEach(() => {
    pedidos = { buscarComAmbientes: jest.fn() };
    service = new PedidosService(pedidos as unknown as PedidosRepository);
  });

  describe('buscarComAmbientes', () => {
    it('devolve o pedido com as peças agrupadas por ambiente (N7T3)', async () => {
      pedidos.buscarComAmbientes.mockResolvedValue(pedidoComAmbientes);

      const resultado = await service.buscarComAmbientes('PED-001');

      expect(resultado).toEqual(pedidoComAmbientes);
    });

    it('recusa número de pedido inexistente com 404', async () => {
      pedidos.buscarComAmbientes.mockResolvedValue(null);

      await expect(service.buscarComAmbientes('PED-INEXISTENTE')).rejects.toThrow(NotFoundException);
    });
  });
});
