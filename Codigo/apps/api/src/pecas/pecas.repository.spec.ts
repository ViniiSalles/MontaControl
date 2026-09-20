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
  let prisma: { peca: { findUnique: jest.Mock; create: jest.Mock } };
  let repository: PecasRepository;

  beforeEach(() => {
    prisma = { peca: { findUnique: jest.fn(), create: jest.fn() } };
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
    it('cria a peça já como TRIADA e mapeia o DTO', async () => {
      prisma.peca.create.mockResolvedValue({
        id: 9,
        codigoBarras: 'COD-123',
        descricao: 'Porta de armário',
        status: StatusPeca.TRIADA,
        ambienteId: 4,
      });

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
            codigoBarras: 'COD-123',
            descricao: 'Porta de armário',
            triadaPor: 2,
          },
        }),
      );
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
