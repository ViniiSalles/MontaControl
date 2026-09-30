import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AmbientesRepository } from './ambientes.repository';

function erroConflito(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

describe('AmbientesRepository', () => {
  let prisma: {
    ambiente: { findFirst: jest.Mock; create: jest.Mock; findFirstOrThrow: jest.Mock };
  };
  let repository: AmbientesRepository;

  beforeEach(() => {
    prisma = {
      ambiente: { findFirst: jest.fn(), create: jest.fn(), findFirstOrThrow: jest.fn() },
    };
    repository = new AmbientesRepository(prisma as unknown as PrismaService);
  });

  describe('buscarOuCriar', () => {
    it('reaproveita o ambiente já existente para o mesmo pedido e nome', async () => {
      prisma.ambiente.findFirst.mockResolvedValue({ id: 4, nome: 'Cozinha' });

      const ambiente = await repository.buscarOuCriar(3, 'Cozinha');

      expect(ambiente).toEqual({ id: 4, nome: 'Cozinha' });
      expect(prisma.ambiente.create).not.toHaveBeenCalled();
    });

    it('cria um novo ambiente quando não existe ainda', async () => {
      prisma.ambiente.findFirst.mockResolvedValue(null);
      prisma.ambiente.create.mockResolvedValue({ id: 5, nome: 'Quarto' });

      const ambiente = await repository.buscarOuCriar(3, 'Quarto');

      expect(ambiente).toEqual({ id: 5, nome: 'Quarto' });
      expect(prisma.ambiente.create).toHaveBeenCalledWith({
        data: { pedidoId: 3, nome: 'Quarto' },
        select: { id: true, nome: true },
      });
    });

    it('sob corrida (P2002), devolve o ambiente que o concorrente acabou de criar', async () => {
      prisma.ambiente.findFirst.mockResolvedValue(null);
      prisma.ambiente.create.mockRejectedValue(erroConflito());
      prisma.ambiente.findFirstOrThrow.mockResolvedValue({ id: 6, nome: 'Sala' });

      const ambiente = await repository.buscarOuCriar(3, 'Sala');

      expect(ambiente).toEqual({ id: 6, nome: 'Sala' });
    });

    it('propaga erros que não são de unicidade', async () => {
      prisma.ambiente.findFirst.mockResolvedValue(null);
      prisma.ambiente.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(repository.buscarOuCriar(3, 'Sala')).rejects.toThrow('conexão perdida');
    });
  });
});
