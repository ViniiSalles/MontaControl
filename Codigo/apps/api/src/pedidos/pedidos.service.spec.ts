import { StatusPedido } from '@montacontrol/shared';
import { ClientesRepository } from '../clientes/clientes.repository';
import { ClienteNaoEncontradoException } from './exceptions/cliente-nao-encontrado.exception';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

const dadosPedido = {
  clienteId: 1,
  ambientes: [{ nome: 'Cozinha', itens: [{ descricao: 'Porta 90cm', quantidade: 3 }] }],
};

describe('PedidosService', () => {
  let pedidos: { criar: jest.Mock; listar: jest.Mock };
  let clientes: { existe: jest.Mock };
  let service: PedidosService;

  beforeEach(() => {
    pedidos = { criar: jest.fn(), listar: jest.fn() };
    clientes = { existe: jest.fn().mockResolvedValue(true) };
    service = new PedidosService(
      pedidos as unknown as PedidosRepository,
      clientes as unknown as ClientesRepository,
    );
  });

  describe('criar', () => {
    it('cria o pedido e devolve o DTO com status inicial AGUARDANDO', async () => {
      pedidos.criar.mockResolvedValue({ id: 42, numeroPedido: 'PED-000042' });

      const pedido = await service.criar(dadosPedido);

      expect(pedido).toEqual({
        id: 42,
        numeroPedido: 'PED-000042',
        status: StatusPedido.AGUARDANDO,
        clienteId: 1,
      });
      expect(pedidos.criar).toHaveBeenCalledWith(1, dadosPedido.ambientes);
    });

    it('cliente inexistente → 404 antes de tocar o repositório de pedidos', async () => {
      clientes.existe.mockResolvedValue(false);

      await expect(service.criar(dadosPedido)).rejects.toBeInstanceOf(ClienteNaoEncontradoException);
      expect(pedidos.criar).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('repassa o filtro de status ao repositório', async () => {
      pedidos.listar.mockResolvedValue([]);

      await service.listar(StatusPedido.AGUARDANDO);

      expect(pedidos.listar).toHaveBeenCalledWith(StatusPedido.AGUARDANDO);
    });
  });
});
