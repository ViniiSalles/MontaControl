import { Test } from '@nestjs/testing';
import { StatusPedido } from '@montacontrol/shared';
import { StatusAmbiente } from '../../generated/prisma';
import { SyncExclusaoRepository } from '../sync/sync-exclusao.repository';
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
    emTransacao: jest.Mock;
    listarIdsAmbientesEPecas: jest.Mock;
  };
  let sync: { registrarVarios: jest.Mock };
  let clientes: { existe: jest.Mock };
  let usuarios: { filtrarMontadoresAtivos: jest.Mock };
  let service: PedidosService;

  /** Cliente de transação fictício: o repositório real entrega o do Prisma. */
  const tx = { id: 'transacao-fake' };

  beforeEach(async () => {
    pedidos = {
      criar: jest.fn(),
      listar: jest.fn(),
      buscarComAmbientes: jest.fn(),
      existe: jest.fn().mockResolvedValue(true),
      listarMontadores: jest.fn().mockResolvedValue([]),
      definirMontadores: jest.fn().mockResolvedValue([]),
      emTransacao: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      listarIdsAmbientesEPecas: jest.fn().mockResolvedValue({ ambienteIds: [], pecaIds: [] }),
    };
    sync = { registrarVarios: jest.fn().mockResolvedValue(undefined) };
    clientes = { existe: jest.fn().mockResolvedValue(true) };
    usuarios = { filtrarMontadoresAtivos: jest.fn((ids: number[]) => Promise.resolve(ids)) };

    const modulo = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PedidosRepository, useValue: pedidos },
        { provide: ClientesRepository, useValue: clientes },
        { provide: UsuariosRepository, useValue: usuarios },
        { provide: SyncExclusaoRepository, useValue: sync },
      ],
    }).compile();
    service = modulo.get(PedidosService);
  });

  describe('atribuirMontadores', () => {
    it('remove repetidos e grava cada membro', async () => {
      await service.atribuirMontadores(3, [7, 8, 7]);

      expect(usuarios.filtrarMontadoresAtivos).toHaveBeenCalledWith([7, 8]);
      expect(pedidos.definirMontadores).toHaveBeenCalledWith(3, [7, 8], tx);
    });

    it('lista vazia tira todos da obra', async () => {
      await service.atribuirMontadores(3, []);

      expect(pedidos.definirMontadores).toHaveBeenCalledWith(3, [], tx);
    });

    describe('registro de exclusões para o pull incremental', () => {
      beforeEach(() => {
        pedidos.listarIdsAmbientesEPecas.mockResolvedValue({ ambienteIds: [11, 12], pecaIds: [21] });
      });

      it('desalocar um montador grava pedido, ambientes e peças só para ele, na mesma transação', async () => {
        pedidos.definirMontadores.mockResolvedValue([9]);

        await service.atribuirMontadores(3, [7, 8]);

        expect(pedidos.listarIdsAmbientesEPecas).toHaveBeenCalledWith(3, tx);
        expect(sync.registrarVarios).toHaveBeenCalledTimes(1);
        expect(sync.registrarVarios).toHaveBeenCalledWith(
          [
            { entidade: 'pedidos', registroId: '3', usuarioId: 9 },
            { entidade: 'ambientes', registroId: '11', usuarioId: 9 },
            { entidade: 'ambientes', registroId: '12', usuarioId: 9 },
            { entidade: 'pecas', registroId: '21', usuarioId: 9 },
          ],
          tx,
        );
      });

      it('vários montadores removidos geram exclusões separadas por usuário', async () => {
        pedidos.definirMontadores.mockResolvedValue([9, 10]);

        await service.atribuirMontadores(3, []);

        const [exclusoes] = sync.registrarVarios.mock.calls[0] as [{ usuarioId: number }[]];
        expect(exclusoes.filter((e) => e.usuarioId === 9)).toHaveLength(4);
        expect(exclusoes.filter((e) => e.usuarioId === 10)).toHaveLength(4);
        expect(exclusoes.every((e) => [9, 10].includes(e.usuarioId))).toBe(true);
      });

      it('quem continua atribuído não ganha exclusão', async () => {
        pedidos.definirMontadores.mockResolvedValue([]);

        await service.atribuirMontadores(3, [7, 8]);

        expect(sync.registrarVarios).not.toHaveBeenCalled();
      });

      it('falha ao gravar a exclusão propaga o erro (a transação desfaz a desalocação)', async () => {
        pedidos.definirMontadores.mockResolvedValue([9]);
        sync.registrarVarios.mockRejectedValue(new Error('falha'));

        await expect(service.atribuirMontadores(3, [7])).rejects.toThrow('falha');
        expect(pedidos.listarMontadores).not.toHaveBeenCalled();
      });
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
