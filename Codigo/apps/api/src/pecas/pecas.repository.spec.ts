import { Prisma, StatusPeca } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { PecasRepository } from './pecas.repository';

function erroConflito(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

const dadosNovaPeca = {
  ambienteId: 4,
  codigoBarras: 'COD-123',
  descricao: 'Porta de armário',
  triadaPor: 2,
};

describe('PecasRepository', () => {
  let prisma: {
    peca: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let repository: PecasRepository;

  beforeEach(() => {
    prisma = {
      peca: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    repository = new PecasRepository(prisma as unknown as PrismaService);
  });

  describe('buscarPorCodigoBarras', () => {
    it('retorna o id quando o código de barras já foi triado', async () => {
      prisma.peca.findUnique.mockResolvedValue({ id: 9 });

      const peca = await repository.buscarPorCodigoBarras('COD-123');

      expect(peca).toEqual({ id: 9 });
    });

    it('retorna null quando o código de barras é inédito', async () => {
      prisma.peca.findUnique.mockResolvedValue(null);

      const peca = await repository.buscarPorCodigoBarras('COD-999');

      expect(peca).toBeNull();
    });
  });

  describe('criar', () => {
    it('sem peça pendente correspondente, cria a peça já TRIADA como item próprio', async () => {
      const linha = {
        id: 9,
        codigoBarras: 'COD-123',
        descricao: 'Porta de armário',
        status: StatusPeca.TRIADA,
        ambienteId: 4,
      };
      prisma.peca.create.mockResolvedValue(linha);
      prisma.peca.update.mockResolvedValue(linha);

      const peca = await repository.criar(dadosNovaPeca);

      expect(peca).toEqual({
        id: 9,
        codigoBarras: 'COD-123',
        descricao: 'Porta de armário',
        status: StatusPeca.TRIADA,
        ambienteId: 4,
      });
      expect(prisma.peca.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ambienteId: 4,
            itemId: 0,
            codigoBarras: 'COD-123',
            descricao: 'Porta de armário',
            status: StatusPeca.TRIADA,
            triadaPor: 2,
            triadaAt: expect.any(Date),
          },
        }),
      );
      expect(prisma.peca.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9 }, data: { itemId: 9 } }),
      );
    });

    it('consome uma peça PENDENTE do gestor com a mesma descrição no ambiente', async () => {
      prisma.peca.findFirst.mockResolvedValue({ id: 50 });
      prisma.peca.updateMany.mockResolvedValue({ count: 1 });
      prisma.peca.findUniqueOrThrow.mockResolvedValue({
        id: 50,
        codigoBarras: 'COD-123',
        descricao: 'Porta de armário',
        status: StatusPeca.TRIADA,
        ambienteId: 4,
      });

      const peca = await repository.criar(dadosNovaPeca);

      expect(peca).toMatchObject({ id: 50, codigoBarras: 'COD-123', status: StatusPeca.TRIADA });
      expect(prisma.peca.updateMany).toHaveBeenCalledWith({
        where: { id: 50, status: StatusPeca.PENDENTE },
        data: { codigoBarras: 'COD-123', status: StatusPeca.TRIADA, triadaPor: 2, triadaAt: expect.any(Date) },
      });
      expect(prisma.peca.create).not.toHaveBeenCalled();
    });

    it('perdeu a corrida pela peça pendente: cai na criação de peça nova', async () => {
      const linha = { id: 9, codigoBarras: 'COD-123', descricao: 'x', status: StatusPeca.TRIADA, ambienteId: 4 };
      prisma.peca.findFirst.mockResolvedValue({ id: 50 });
      prisma.peca.updateMany.mockResolvedValue({ count: 0 });
      prisma.peca.create.mockResolvedValue(linha);
      prisma.peca.update.mockResolvedValue(linha);

      await repository.criar(dadosNovaPeca);

      expect(prisma.peca.create).toHaveBeenCalled();
    });

    it('retorna null em violação de unicidade (código de barras duplicado)', async () => {
      prisma.peca.create.mockRejectedValue(erroConflito());

      const peca = await repository.criar(dadosNovaPeca);

      expect(peca).toBeNull();
    });

    it('propaga erros que não são de unicidade', async () => {
      prisma.peca.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(repository.criar(dadosNovaPeca)).rejects.toThrow('conexão perdida');
    });
  });
});
