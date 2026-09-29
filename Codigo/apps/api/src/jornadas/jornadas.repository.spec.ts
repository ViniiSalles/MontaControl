import { TipoMarcacao } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { JornadasRepository } from './jornadas.repository';

/** `tx` fake: registra as chamadas feitas dentro da transação, sem banco real. */
function criarTxFake(opcoes: { ultimoNsr: number | null; jornadaCriada?: Record<string, unknown> }) {
  const chamadas: { queryRaw: string[]; jornadaCreate?: unknown; jornadaUpdate?: unknown; marcacaoCreate?: unknown } = {
    queryRaw: [],
  };
  // `paraJornadaDTO` (jornada-mapper.ts) lê todos os campos da seleção — o
  // fake precisa devolver a linha "completa" (como o Prisma devolveria),
  // e não só os campos que cada teste quer sobrescrever (id/usuarioId).
  const linhaJornadaPadrao = {
    id: 42,
    usuarioId: 7,
    status: 'EM_ANDAMENTO',
    checkinAt: new Date('2026-09-01T11:00:00.000Z'),
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    createdAt: new Date('2026-09-01T11:00:00.000Z'),
    solicitacaoPonto: null,
  };
  const linhaJornada = { ...linhaJornadaPadrao, ...opcoes.jornadaCriada };
  const tx = {
    $queryRaw: jest.fn((...args: unknown[]) => {
      chamadas.queryRaw.push(String(args[0]));
      return Promise.resolve([]);
    }),
    jornada: {
      create: jest.fn((args: unknown) => {
        chamadas.jornadaCreate = args;
        return Promise.resolve(linhaJornada);
      }),
      update: jest.fn((args: unknown) => {
        chamadas.jornadaUpdate = args;
        return Promise.resolve(linhaJornada);
      }),
    },
    marcacaoPonto: {
      aggregate: jest.fn().mockResolvedValue({ _max: { nsr: opcoes.ultimoNsr } }),
      create: jest.fn((args: unknown) => {
        chamadas.marcacaoCreate = args;
        return Promise.resolve({});
      }),
    },
  };
  return { tx, chamadas };
}

describe('JornadasRepository — geração de NSR', () => {
  it('criarCheckin grava marcação ENTRADA com NSR = MAX+1, sob advisory lock', async () => {
    const { tx, chamadas } = criarTxFake({ ultimoNsr: 5, jornadaCriada: { id: 42, usuarioId: 7 } });
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new JornadasRepository(prisma);

    await repository.criarCheckin({
      usuarioId: 7,
      idCliente: '11111111-1111-1111-1111-111111111111',
      latitude: -19.93,
      longitude: -43.94,
      endereco: null,
      checkinAt: new Date('2026-09-01T11:00:00.000Z'),
      pedidoId: null,
    });

    expect(chamadas.queryRaw[0]).toContain('pg_advisory_xact_lock');
    expect(chamadas.marcacaoCreate).toMatchObject({
      data: expect.objectContaining({ nsr: 6, jornadaId: 42, usuarioId: 7, tipo: TipoMarcacao.ENTRADA, coletor: '01' }),
    });
  });

  it('primeira marcação do sistema recebe NSR 1 (MAX ainda é null)', async () => {
    const { tx, chamadas } = criarTxFake({ ultimoNsr: null, jornadaCriada: { id: 1, usuarioId: 3 } });
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new JornadasRepository(prisma);

    await repository.criarCheckin({
      usuarioId: 3,
      idCliente: '22222222-2222-2222-2222-222222222222',
      latitude: -19.93,
      longitude: -43.94,
      endereco: null,
      checkinAt: new Date('2026-09-01T11:00:00.000Z'),
      pedidoId: null,
    });

    expect((chamadas.marcacaoCreate as { data: { nsr: number } }).data.nsr).toBe(1);
  });

  it('marcação gravada mais de 2 minutos depois de marcada é offline', async () => {
    const { tx, chamadas } = criarTxFake({ ultimoNsr: 0, jornadaCriada: { id: 1, usuarioId: 3 } });
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new JornadasRepository(prisma);
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T11:05:00.000Z')); // 5 min depois do checkinAt

    await repository.criarCheckin({
      usuarioId: 3,
      idCliente: '33333333-3333-3333-3333-333333333333',
      latitude: -19.93,
      longitude: -43.94,
      endereco: null,
      checkinAt: new Date('2026-09-01T11:00:00.000Z'),
      pedidoId: null,
    });

    expect((chamadas.marcacaoCreate as { data: { offline: boolean } }).data.offline).toBe(true);
    jest.useRealTimers();
  });

  it('registrarCheckout grava marcação SAIDA para a jornada informada', async () => {
    const { tx, chamadas } = criarTxFake({ ultimoNsr: 10, jornadaCriada: { id: 42, usuarioId: 7 } });
    const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
    const repository = new JornadasRepository(prisma);

    await repository.registrarCheckout(42, {
      idCliente: '44444444-4444-4444-4444-444444444444',
      latitude: -19.93,
      longitude: -43.94,
      endereco: null,
      checkoutAt: new Date('2026-09-01T19:00:00.000Z'),
      pedidoId: null,
    });

    expect(chamadas.marcacaoCreate).toMatchObject({
      data: expect.objectContaining({ nsr: 11, jornadaId: 42, tipo: TipoMarcacao.SAIDA }),
    });
  });
});
