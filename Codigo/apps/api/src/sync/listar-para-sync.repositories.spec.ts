import { AmbientesRepository } from '../ambientes/ambientes.repository';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { AvariasRepository } from '../avarias/avarias.repository';
import { TiposAvariaRepository } from '../avarias/tipos-avaria.repository';
import { BancoHorasRepository } from '../banco-horas/banco-horas.repository';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PecasRepository } from '../pecas/pecas.repository';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `listarParaSync` de cada repositório: o `where` precisa SEMPRE carregar o
 * filtro de escopo do montador (requisito de segurança do pull) e a janela de
 * histórico só vale no primeiro pull — no incremental, só `updated_at`.
 */
describe('listarParaSync (filtros de escopo e de janela)', () => {
  const USUARIO_ID = 7;
  const janela = new Date('2026-09-17T12:00:00.000Z');
  const desde = new Date('2026-10-17T12:00:00.000Z');
  const escopoPedido = { montadores: { some: { usuarioId: USUARIO_ID } } };
  const atribuidoDepois = {
    montadores: { some: { usuarioId: USUARIO_ID, createdAt: { gt: desde } } },
  };

  function fakePrisma(...modelos: string[]) {
    const prisma: Record<string, { findMany: jest.Mock }> = {};
    for (const modelo of modelos) prisma[modelo] = { findMany: jest.fn().mockResolvedValue([]) };
    return prisma;
  }

  describe('JornadasRepository', () => {
    it('primeiro pull: usuário + janela de checkin_at', async () => {
      const prisma = fakePrisma('jornada');
      await new JornadasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        janela,
      );

      expect(prisma.jornada.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: USUARIO_ID, checkinAt: { gte: janela } } }),
      );
    });

    it('incremental: usuário + updated_at, sem janela', async () => {
      const prisma = fakePrisma('jornada');
      await new JornadasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        undefined,
        desde,
      );

      expect(prisma.jornada.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: USUARIO_ID, updatedAt: { gt: desde } } }),
      );
    });
  });

  describe('BancoHorasRepository', () => {
    it('primeiro pull: usuário + competência inicial', async () => {
      const prisma = fakePrisma('bancoHoras');
      await new BancoHorasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        { ano: 2026, mes: 8 },
      );

      expect(prisma.bancoHoras.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            usuarioId: USUARIO_ID,
            OR: [{ ano: { gt: 2026 } }, { ano: 2026, mes: { gte: 8 } }],
          },
        }),
      );
    });

    it('incremental: usuário + updated_at, sem competência inicial', async () => {
      const prisma = fakePrisma('bancoHoras');
      await new BancoHorasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        undefined,
        desde,
      );

      expect(prisma.bancoHoras.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: USUARIO_ID, updatedAt: { gt: desde } } }),
      );
    });
  });

  describe('AtestadosRepository', () => {
    it('primeiro pull: usuário + janela de created_at', async () => {
      const prisma = fakePrisma('atestado');
      await new AtestadosRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        janela,
      );

      expect(prisma.atestado.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: USUARIO_ID, createdAt: { gte: janela } } }),
      );
    });

    it('incremental: usuário + updated_at, sem janela', async () => {
      const prisma = fakePrisma('atestado');
      await new AtestadosRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        undefined,
        desde,
      );

      expect(prisma.atestado.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: USUARIO_ID, updatedAt: { gt: desde } } }),
      );
    });
  });

  describe('AvariasRepository', () => {
    it('primeiro pull: só as registradas pelo usuário + janela de created_at', async () => {
      const prisma = fakePrisma('avaria');
      await new AvariasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        janela,
      );

      expect(prisma.avaria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { registradaPor: USUARIO_ID, createdAt: { gte: janela } },
        }),
      );
    });

    it('incremental: registradas pelo usuário + updated_at, sem janela (avaria antiga que mudou chega)', async () => {
      const prisma = fakePrisma('avaria');
      await new AvariasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        undefined,
        desde,
      );

      expect(prisma.avaria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { registradaPor: USUARIO_ID, updatedAt: { gt: desde } },
        }),
      );
    });
  });

  describe('TiposAvariaRepository (catálogo global, sem escopo de usuário)', () => {
    it('primeiro pull: catálogo inteiro', async () => {
      const prisma = fakePrisma('tipoAvaria');
      await new TiposAvariaRepository(prisma as unknown as PrismaService).listarParaSync();

      expect(prisma.tipoAvaria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('incremental: só o alterado depois de desde', async () => {
      const prisma = fakePrisma('tipoAvaria');
      await new TiposAvariaRepository(prisma as unknown as PrismaService).listarParaSync(desde);

      expect(prisma.tipoAvaria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { updatedAt: { gt: desde } } }),
      );
    });
  });

  describe('AmbientesRepository', () => {
    it('primeiro pull: ambientes dos pedidos atribuídos ao usuário', async () => {
      const prisma = fakePrisma('ambiente');
      await new AmbientesRepository(prisma as unknown as PrismaService).listarParaSync(USUARIO_ID);

      expect(prisma.ambiente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pedido: escopoPedido } }),
      );
    });

    it('incremental: mantém o escopo e acrescenta updated_at OU atribuição recente', async () => {
      const prisma = fakePrisma('ambiente');
      await new AmbientesRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        desde,
      );

      expect(prisma.ambiente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            pedido: escopoPedido,
            OR: [{ updatedAt: { gt: desde } }, { pedido: atribuidoDepois }],
          },
        }),
      );
    });
  });

  describe('PecasRepository', () => {
    it('primeiro pull: peças dos pedidos atribuídos ao usuário', async () => {
      const prisma = fakePrisma('peca');
      await new PecasRepository(prisma as unknown as PrismaService).listarParaSync(USUARIO_ID);

      expect(prisma.peca.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ambiente: { pedido: escopoPedido } } }),
      );
    });

    it('incremental: mantém o escopo e acrescenta updated_at OU atribuição recente', async () => {
      const prisma = fakePrisma('peca');
      await new PecasRepository(prisma as unknown as PrismaService).listarParaSync(
        USUARIO_ID,
        desde,
      );

      expect(prisma.peca.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ambiente: { pedido: escopoPedido },
            OR: [{ updatedAt: { gt: desde } }, { ambiente: { pedido: atribuidoDepois } }],
          },
        }),
      );
    });
  });
});
