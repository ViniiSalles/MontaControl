import { PrismaService } from '../prisma/prisma.service';
import { MarcacoesRepository } from './marcacoes.repository';

function criarTxFake(pendentes: unknown[], ultimaSelada: { hash: string } | null) {
  const atualizadas: Array<{ id: number; hash: string }> = [];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    marcacaoPonto: {
      findMany: jest.fn().mockResolvedValue(pendentes),
      findFirst: jest.fn().mockResolvedValue(ultimaSelada),
      update: jest.fn((args: { where: { id: number }; data: { hash: string } }) => {
        atualizadas.push({ id: args.where.id, hash: args.data.hash });
        return Promise.resolve({});
      }),
    },
  };
  return { tx, atualizadas };
}

function marcacaoPendente(parcial: Record<string, unknown> = {}) {
  return {
    id: 1,
    nsr: 1,
    jornadaId: 10,
    marcadoEm: new Date('2026-09-01T11:00:00.000Z'),
    gravadoEm: new Date('2026-09-01T11:00:05.000Z'),
    coletor: '01',
    offline: false,
    usuario: { cpf: '45212345601', nome: 'Ana Souza' },
    ...parcial,
  };
}

describe('MarcacoesRepository.selarPendentes', () => {
  it('bloqueia (ok=false) quando alguma marcação pendente é de usuário sem CPF', async () => {
    const { tx } = criarTxFake([marcacaoPendente({ usuario: { cpf: null, nome: 'Beto Lima' } })], null);
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado).toEqual({ ok: false, montadoresSemCpf: ['Beto Lima'] });
    expect(tx.marcacaoPonto.update).not.toHaveBeenCalled();
  });

  it('não repete o mesmo nome duas vezes quando o usuário tem mais de uma marcação sem CPF', async () => {
    const { tx } = criarTxFake(
      [
        marcacaoPendente({ id: 1, nsr: 1, usuario: { cpf: null, nome: 'Beto Lima' } }),
        marcacaoPendente({ id: 2, nsr: 2, usuario: { cpf: null, nome: 'Beto Lima' } }),
      ],
      null,
    );
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado.montadoresSemCpf).toEqual(['Beto Lima']);
  });

  it('sela em ordem de NSR, encadeando a partir do hash da última já selada', async () => {
    const { tx, atualizadas } = criarTxFake(
      [marcacaoPendente({ id: 5, nsr: 3 }), marcacaoPendente({ id: 6, nsr: 4 })],
      { hash: 'a'.repeat(64) },
    );
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado.ok).toBe(true);
    expect(atualizadas).toHaveLength(2);
    expect(atualizadas[0].id).toBe(5);
    expect(atualizadas[1].id).toBe(6);
    expect(atualizadas[0].hash).not.toBe(atualizadas[1].hash); // NSRs diferentes → hashes diferentes
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('nenhuma pendente: sucesso sem tocar em nada', async () => {
    const { tx, atualizadas } = criarTxFake([], null);
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado).toEqual({ ok: true, montadoresSemCpf: [] });
    expect(atualizadas).toHaveLength(0);
  });
});

describe('MarcacoesRepository.listarNoPeriodo', () => {
  it('devolve só as marcações já seladas no período, em ordem de NSR', async () => {
    const prisma = {
      marcacaoPonto: {
        findMany: jest.fn().mockResolvedValue([
          {
            nsr: 1,
            marcadoEm: new Date('2026-09-01T11:00:00.000Z'),
            gravadoEm: new Date('2026-09-01T11:00:05.000Z'),
            coletor: '01',
            offline: false,
            hash: 'a'.repeat(64),
            usuario: { cpf: '45212345601' },
          },
        ]),
      },
    } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const linhas = await repository.listarNoPeriodo('2026-09-01T03:00:00.000Z', '2026-10-01T02:59:59.999Z');

    expect(linhas).toEqual([
      {
        nsr: 1,
        cpf: '45212345601',
        marcadoEm: new Date('2026-09-01T11:00:00.000Z'),
        gravadoEm: new Date('2026-09-01T11:00:05.000Z'),
        coletor: '01',
        offline: false,
        hash: 'a'.repeat(64),
      },
    ]);
  });

  it('lança se uma marcação já selada não tiver CPF — invariante violada', async () => {
    const prisma = {
      marcacaoPonto: {
        findMany: jest.fn().mockResolvedValue([
          {
            nsr: 1,
            marcadoEm: new Date(),
            gravadoEm: new Date(),
            coletor: '01',
            offline: false,
            hash: 'a'.repeat(64),
            usuario: { cpf: null },
          },
        ]),
      },
    } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    await expect(repository.listarNoPeriodo('2026-09-01', '2026-09-30')).rejects.toThrow(/invariante/i);
  });
});
