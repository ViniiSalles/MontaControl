import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesRepository, type NovaNotificacao } from './notificacoes.repository';

const CRIADA_EM = new Date('2026-10-27T12:00:00.000Z');

function linha(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: 7,
    usuarioId: 3,
    tipo: 'AVARIA_REPORTADA',
    titulo: 'Avaria reportada',
    mensagem: 'Peça 12 chegou quebrada',
    referenciaTipo: 'AVARIA',
    referenciaId: 123,
    chaveOrigem: 'avaria:123:reportada',
    lida: false,
    lidaAt: null,
    createdAt: CRIADA_EM,
    updatedAt: CRIADA_EM,
    ...sobrescrita,
  };
}

describe('NotificacoesRepository', () => {
  let prisma: {
    notificacao: {
      createManyAndReturn: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let repository: NotificacoesRepository;

  beforeEach(async () => {
    prisma = {
      notificacao: {
        createManyAndReturn: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const modulo = await Test.createTestingModule({
      providers: [NotificacoesRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();
    repository = modulo.get(NotificacoesRepository);
  });

  describe('criarVarias', () => {
    const base: NovaNotificacao = {
      usuarioId: 3,
      tipo: 'AVARIA_REPORTADA',
      titulo: 'Avaria reportada',
      mensagem: 'Peça 12 chegou quebrada',
      referenciaTipo: 'AVARIA',
      referenciaId: 123,
      chaveOrigem: 'avaria:123:reportada',
    };

    it('ignora chaveOrigem repetida e devolve só as novas', async () => {
      // O banco descartou a linha do usuário 4 (conflito) e devolveu só a do 3.
      prisma.notificacao.createManyAndReturn.mockResolvedValue([linha()]);

      const criadas = await repository.criarVarias([base, { ...base, usuarioId: 4 }]);

      expect(prisma.notificacao.createManyAndReturn).toHaveBeenCalledWith({
        data: [base, { ...base, usuarioId: 4 }],
        skipDuplicates: true,
      });
      expect(criadas).toEqual([
        {
          usuarioId: 3,
          notificacao: {
            id: 7,
            tipo: 'AVARIA_REPORTADA',
            titulo: 'Avaria reportada',
            mensagem: 'Peça 12 chegou quebrada',
            referenciaTipo: 'AVARIA',
            referenciaId: 123,
            lida: false,
            criadaEm: '2026-10-27T12:00:00.000Z',
          },
        },
      ]);
    });

    it('grava referência ausente como nula', async () => {
      prisma.notificacao.createManyAndReturn.mockResolvedValue([
        linha({ referenciaTipo: null, referenciaId: null }),
      ]);

      const [criada] = await repository.criarVarias([
        { usuarioId: 3, tipo: 'AVARIA_REPORTADA', titulo: 't', mensagem: 'm', chaveOrigem: 'k' },
      ]);

      expect(criada.notificacao.referenciaTipo).toBeNull();
      expect(criada.notificacao.referenciaId).toBeNull();
    });

    it('lista vazia não consulta o banco', async () => {
      await expect(repository.criarVarias([])).resolves.toEqual([]);
      expect(prisma.notificacao.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('listarDoUsuario', () => {
    it('devolve as mais recentes primeiro, limitadas ao usuário', async () => {
      prisma.notificacao.findMany.mockResolvedValue([linha({ id: 9 }), linha({ id: 8 })]);

      const itens = await repository.listarDoUsuario(3, 20);

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 3 },
        orderBy: { id: 'desc' },
        take: 20,
      });
      expect(itens.map((n) => n.id)).toEqual([9, 8]);
    });

    it('respeita cursor antesDe', async () => {
      prisma.notificacao.findMany.mockResolvedValue([]);

      await repository.listarDoUsuario(3, 10, 8);

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 3, id: { lt: 8 } },
        orderBy: { id: 'desc' },
        take: 10,
      });
    });
  });

  describe('contarNaoLidas', () => {
    it('conta só as não lidas do usuário', async () => {
      prisma.notificacao.count.mockResolvedValue(4);

      await expect(repository.contarNaoLidas(3)).resolves.toBe(4);
      expect(prisma.notificacao.count).toHaveBeenCalledWith({
        where: { usuarioId: 3, lida: false },
      });
    });
  });

  describe('marcarLida', () => {
    it('marca como lida e devolve true quando a notificação é do usuário', async () => {
      prisma.notificacao.updateMany.mockResolvedValue({ count: 1 });

      await expect(repository.marcarLida(7, 3)).resolves.toBe(true);
      expect(prisma.notificacao.updateMany).toHaveBeenCalledWith({
        where: { id: 7, usuarioId: 3 },
        data: { lida: true, lidaAt: expect.any(Date) },
      });
    });

    it('devolve false para usuário diferente', async () => {
      prisma.notificacao.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.marcarLida(7, 99)).resolves.toBe(false);
      expect(prisma.notificacao.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 7, usuarioId: 99 } }),
      );
    });
  });

  describe('marcarTodasLidas', () => {
    it('marca as não lidas do usuário e devolve quantas foram', async () => {
      prisma.notificacao.updateMany.mockResolvedValue({ count: 5 });

      await expect(repository.marcarTodasLidas(3)).resolves.toBe(5);
      expect(prisma.notificacao.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: 3, lida: false },
        data: { lida: true, lidaAt: expect.any(Date) },
      });
    });
  });

  describe('listarParaSync', () => {
    const DIA_MS = 24 * 60 * 60 * 1000;
    const AGORA = Date.parse('2026-10-27T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(AGORA);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('primeiro pull (desde nulo): só do usuário, na janela de created_at', async () => {
      prisma.notificacao.findMany.mockResolvedValue([]);

      await repository.listarParaSync(3, null, 30);

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 3, createdAt: { gte: new Date(AGORA - 30 * DIA_MS) } },
        orderBy: { id: 'asc' },
        select: expect.any(Object),
      });
    });

    it('incremental: só do usuário, por updated_at depois de desde e sem janela', async () => {
      prisma.notificacao.findMany.mockResolvedValue([]);
      const desde = new Date('2026-10-27T11:00:00.000Z');

      await repository.listarParaSync(3, desde, 30);

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 3, updatedAt: { gt: desde } },
        orderBy: { id: 'asc' },
        select: expect.any(Object),
      });
    });

    it('devolve as linhas em termos de domínio, com criadaEm', async () => {
      prisma.notificacao.findMany.mockResolvedValue([linha({ id: 9 })]);

      await expect(repository.listarParaSync(3, null, 30)).resolves.toEqual([
        {
          id: 9,
          tipo: 'AVARIA_REPORTADA',
          titulo: 'Avaria reportada',
          mensagem: 'Peça 12 chegou quebrada',
          referenciaTipo: 'AVARIA',
          referenciaId: 123,
          lida: false,
          criadaEm: CRIADA_EM,
        },
      ]);
    });
  });
});
