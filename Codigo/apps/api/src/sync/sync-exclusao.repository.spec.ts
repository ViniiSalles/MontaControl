import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SyncExclusaoRepository } from './sync-exclusao.repository';

describe('SyncExclusaoRepository', () => {
  let prisma: { syncExclusao: { create: jest.Mock; createMany: jest.Mock } };
  let repository: SyncExclusaoRepository;

  beforeEach(async () => {
    prisma = {
      syncExclusao: { create: jest.fn(), createMany: jest.fn() },
    };
    const modulo = await Test.createTestingModule({
      providers: [SyncExclusaoRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();
    repository = modulo.get(SyncExclusaoRepository);
  });

  describe('registrar', () => {
    it('grava uma exclusão para o usuário informado', async () => {
      await repository.registrar('pedidos', '3', 9);

      expect(prisma.syncExclusao.create).toHaveBeenCalledWith({
        data: { entidade: 'pedidos', registroId: '3', usuarioId: 9 },
      });
    });

    it('usuário nulo vale para todos os usuários', async () => {
      await repository.registrar('pedidos', '3', null);

      expect(prisma.syncExclusao.create).toHaveBeenCalledWith({
        data: { entidade: 'pedidos', registroId: '3', usuarioId: null },
      });
    });

    it('usa o cliente da transação quando informado, nunca o Prisma global', async () => {
      const tx = { syncExclusao: { create: jest.fn() } };

      await repository.registrar('pecas', '21', 9, tx as never);

      expect(tx.syncExclusao.create).toHaveBeenCalledTimes(1);
      expect(prisma.syncExclusao.create).not.toHaveBeenCalled();
    });
  });

  describe('registrarVarios', () => {
    it('grava todas as exclusões numa única inserção', async () => {
      const tx = { syncExclusao: { createMany: jest.fn() } };

      await repository.registrarVarios(
        [
          { entidade: 'pedidos', registroId: '3', usuarioId: 9 },
          { entidade: 'ambientes', registroId: '11', usuarioId: 9 },
        ],
        tx as never,
      );

      expect(tx.syncExclusao.createMany).toHaveBeenCalledWith({
        data: [
          { entidade: 'pedidos', registroId: '3', usuarioId: 9 },
          { entidade: 'ambientes', registroId: '11', usuarioId: 9 },
        ],
      });
      expect(prisma.syncExclusao.createMany).not.toHaveBeenCalled();
    });

    it('lista vazia não toca o banco', async () => {
      await repository.registrarVarios([]);

      expect(prisma.syncExclusao.createMany).not.toHaveBeenCalled();
    });
  });
});
