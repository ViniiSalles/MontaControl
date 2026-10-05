import { StatusPedido } from '@montacontrol/shared';
import { StatusAmbiente } from '../../generated/prisma';
import { ClientesRepository } from '../clientes/clientes.repository';
import { ClienteNaoEncontradoException } from '../clientes/exceptions/cliente-nao-encontrado.exception';
import { PedidoNaoEncontradoException } from './exceptions/pedido-nao-encontrado.exception';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';
import { MontadoresInvalidosException } from '../usuarios/exceptions/montadores-invalidos.exception';
import { UsuariosRepository } from '../usuarios/usuarios.repository';

const dadosPedido = {
  clienteId: 1,
  ambientes: [{ nome: 'Cozinha', itens: [{ descricao: 'Porta 90cm', quantidade: 3 }] }],
};

const pedidoComAmbientes = {
  id: 3,
  numeroPedido: 'PED-001',
  status: StatusPedido.EM_TRIAGEM,
  clienteId: 1,
  ambientes: [{ id: 4, nome: 'Cozinha', status: StatusAmbiente.PENDENTE, pecas: [] }],
};

describe('PedidosService', () => {
  let pedidos: {
    criar: jest.Mock;
    listar: jest.Mock;
    buscarComAmbientes: jest.Mock;
    existe: jest.Mock;
    listarMontadores: jest.Mock;
    definirMontadores: jest.Mock;
  };
  let clientes: { existe: jest.Mock };
  let usuarios: { filtrarMontadoresAtivos: jest.Mock };
  let service: PedidosService;

  beforeEach(() => {
    pedidos = {
      criar: jest.fn(),
      listar: jest.fn(),
      buscarComAmbientes: jest.fn(),
      existe: jest.fn().mockResolvedValue(true),
      listarMontadores: jest.fn(),
      definirMontadores: jest.fn().mockResolvedValue([]),
    };
    clientes = { existe: jest.fn().mockResolvedValue(true) };
    usuarios = { filtrarMontadoresAtivos: jest.fn((ids: number[]) => Promise.resolve(ids)) };
    service = new PedidosService(
      pedidos as unknown as PedidosRepository,
      clientes as unknown as ClientesRepository,
      usuarios as unknown as UsuariosRepository,
    );
  });

  describe('atribuirMontadores', () => {
    it('remove repetidos e grava cada membro', async () => {
      await service.atribuirMontadores(3, [7, 8, 7]);

      expect(usuarios.filtrarMontadoresAtivos).toHaveBeenCalledWith([7, 8]);
      expect(pedidos.definirMontadores).toHaveBeenCalledWith(3, [7, 8]);
    });

    it('lista vazia tira todos da obra', async () => {
      await service.atribuirMontadores(3, []);

      expect(pedidos.definirMontadores).toHaveBeenCalledWith(3, []);
    });

    it('recusa quem não é montador ativo (422) sem gravar nada', async () => {
      usuarios.filtrarMontadoresAtivos.mockResolvedValue([7]);

      await expect(service.atribuirMontadores(3, [7, 99])).rejects.toThrow(
        MontadoresInvalidosException,
      );
      expect(pedidos.definirMontadores).not.toHaveBeenCalled();
    });

    it('pedido inexistente é 404', async () => {
      pedidos.existe.mockResolvedValue(false);

      await expect(service.atribuirMontadores(3, [7])).rejects.toThrow(PedidoNaoEncontradoException);
      await expect(service.listarMontadores(3)).rejects.toThrow(PedidoNaoEncontradoException);
    });
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

  describe('buscarComAmbientes', () => {
    it('devolve o pedido com as peças agrupadas por ambiente (N7T3)', async () => {
      pedidos.buscarComAmbientes.mockResolvedValue(pedidoComAmbientes);

      const resultado = await service.buscarComAmbientes('PED-001');

      expect(resultado).toEqual(pedidoComAmbientes);
    });

    it('recusa número de pedido inexistente com 404', async () => {
      pedidos.buscarComAmbientes.mockResolvedValue(null);

      await expect(service.buscarComAmbientes('PED-INEXISTENTE')).rejects.toBeInstanceOf(
        PedidoNaoEncontradoException,
      );
    });
  });
});
