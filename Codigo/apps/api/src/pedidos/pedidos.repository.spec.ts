import { StatusPedido } from '@montacontrol/shared';
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

  describe('criar', () => {
    it('cria pedido, numeroPedido derivado do id, ambientes e uma linha de peça por unidade', async () => {
      const tx = {
        pedido: {
          create: jest.fn().mockResolvedValue({ id: 42 }),
          update: jest.fn().mockResolvedValue({ id: 42, numeroPedido: 'PED-000042' }),
        },
        ambiente: { create: jest.fn().mockResolvedValue({ id: 7 }) },
        peca: {
          create: jest.fn().mockResolvedValue({ id: 100 }),
          update: jest.fn().mockResolvedValue({ id: 100, itemId: 100 }),
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      };
      const prismaComTransacao = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      };
      const repositorio = new PedidosRepository(prismaComTransacao as unknown as PrismaService);

      const pedido = await repositorio.criar(1, [
        { nome: 'Cozinha', itens: [{ descricao: 'Porta 90cm', quantidade: 3 }] },
      ]);

      expect(pedido).toEqual({ id: 42, numeroPedido: 'PED-000042' });
      expect(tx.pedido.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { numeroPedido: 'PED-000042' },
        select: { id: true, numeroPedido: true },
      });
      expect(tx.ambiente.create).toHaveBeenCalledWith({
        data: { pedidoId: 42, nome: 'Cozinha' },
        select: { id: true },
      });
      // 1ª unidade nasce sozinha para o id virar `itemId` do grupo…
      expect(tx.peca.create).toHaveBeenCalledWith({
        data: { ambienteId: 7, descricao: 'Porta 90cm', itemId: 0 },
        select: { id: true },
      });
      expect(tx.peca.update).toHaveBeenCalledWith({ where: { id: 100 }, data: { itemId: 100 } });
      // …e as 2 restantes entram em lote já com o itemId conhecido.
      expect(tx.peca.createMany).toHaveBeenCalledWith({
        data: [
          { ambienteId: 7, descricao: 'Porta 90cm', itemId: 100 },
          { ambienteId: 7, descricao: 'Porta 90cm', itemId: 100 },
        ],
      });
    });

    it('quantidade 1 não chama createMany', async () => {
      const tx = {
        pedido: {
          create: jest.fn().mockResolvedValue({ id: 5 }),
          update: jest.fn().mockResolvedValue({ id: 5, numeroPedido: 'PED-000005' }),
        },
        ambiente: { create: jest.fn().mockResolvedValue({ id: 8 }) },
        peca: { create: jest.fn().mockResolvedValue({ id: 200 }), update: jest.fn(), createMany: jest.fn() },
      };
      const prismaComTransacao = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      };
      const repositorio = new PedidosRepository(prismaComTransacao as unknown as PrismaService);

      await repositorio.criar(1, [{ nome: 'Sala', itens: [{ descricao: 'Prateleira', quantidade: 1 }] }]);

      expect(tx.peca.createMany).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('resume o progresso de cada pedido e filtra por status quando pedido', async () => {
      const prismaComLista = {
        pedido: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 42,
              numeroPedido: 'PED-000042',
              status: 'EM_TRIAGEM',
              clienteId: 1,
              cliente: { nome: 'Cliente Um' },
              ambientes: [{ pecas: [{ status: 'TRIADA' }, { status: 'PENDENTE' }] }],
            },
          ]),
        },
      };
      const repositorio = new PedidosRepository(prismaComLista as unknown as PrismaService);

      const pedidos = await repositorio.listar(StatusPedido.EM_TRIAGEM);

      expect(pedidos).toEqual([
        {
          id: 42,
          numeroPedido: 'PED-000042',
          status: 'EM_TRIAGEM',
          clienteId: 1,
          clienteNome: 'Cliente Um',
          quantidadeTotal: 2,
          quantidadeTriada: 1,
        },
      ]);
      expect(prismaComLista.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'EM_TRIAGEM' } }),
      );
    });

    it('sem filtro de status lista tudo', async () => {
      const prismaComLista = { pedido: { findMany: jest.fn().mockResolvedValue([]) } };
      const repositorio = new PedidosRepository(prismaComLista as unknown as PrismaService);

      await repositorio.listar();

      expect(prismaComLista.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });
  });
});
