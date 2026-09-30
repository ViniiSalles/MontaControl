import { StatusAmbiente } from '../../generated/prisma';
import { StatusPedido } from '@montacontrol/shared';
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

  describe('criar', () => {
    it('cria pedido, numeroPedido derivado do id, ambientes e um slot de peça por item', async () => {
      const tx = {
        pedido: {
          create: jest.fn().mockResolvedValue({ id: 42 }),
          update: jest.fn().mockResolvedValue({ id: 42, numeroPedido: 'PED-000042' }),
        },
        ambiente: { create: jest.fn().mockResolvedValue({ id: 7 }) },
        peca: {
          create: jest.fn().mockResolvedValue({ id: 100 }),
          update: jest.fn().mockResolvedValue({ id: 100, itemId: 100 }),
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
      // Um item = um slot com a quantidade planejada, bipado uma única vez.
      expect(tx.peca.create).toHaveBeenCalledTimes(1);
      expect(tx.peca.create).toHaveBeenCalledWith({
        data: { ambienteId: 7, descricao: 'Porta 90cm', quantidade: 3, itemId: 0 },
        select: { id: true },
      });
      expect(tx.peca.update).toHaveBeenCalledWith({ where: { id: 100 }, data: { itemId: 100 } });
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
