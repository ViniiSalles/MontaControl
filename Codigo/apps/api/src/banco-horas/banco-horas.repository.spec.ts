import { PrismaService } from '../prisma/prisma.service';
import { BancoHorasRepository } from './banco-horas.repository';

describe('BancoHorasRepository', () => {
  let prisma: { bancoHoras: { findUnique: jest.Mock; upsert: jest.Mock } };
  let repository: BancoHorasRepository;

  beforeEach(() => {
    prisma = {
      bancoHoras: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    repository = new BancoHorasRepository(prisma as unknown as PrismaService);
  });

  describe('buscar', () => {
    it('retorna o banco de horas mapeado quando encontrado', async () => {
      prisma.bancoHoras.findUnique.mockResolvedValue({
        id: 1,
        usuarioId: 7,
        mes: 8,
        ano: 2026,
        horasTrabalhadas: { toNumber: () => 160 },
        horasPrevistas: { toNumber: () => 168 },
        saldo: { toNumber: () => -8 },
      });

      const resultado = await repository.buscar(7, 8, 2026);

      expect(resultado).toEqual({
        id: 1,
        usuarioId: 7,
        mes: 8,
        ano: 2026,
        horasTrabalhadas: 160,
        horasPrevistas: 168,
        saldo: -8,
      });
      expect(prisma.bancoHoras.findUnique).toHaveBeenCalledWith({
        where: { usuarioId_mes_ano: { usuarioId: 7, mes: 8, ano: 2026 } },
        select: {
          id: true,
          usuarioId: true,
          mes: true,
          ano: true,
          horasTrabalhadas: true,
          horasPrevistas: true,
          saldo: true,
        },
      });
    });

    it('retorna null quando não há cálculo para o período', async () => {
      prisma.bancoHoras.findUnique.mockResolvedValue(null);

      const resultado = await repository.buscar(7, 8, 2026);

      expect(resultado).toBeNull();
    });
  });

  describe('salvar', () => {
    it('grava (upsert) por usuarioId/mes/ano', async () => {
      prisma.bancoHoras.upsert.mockResolvedValue({
        id: 1,
        usuarioId: 7,
        mes: 8,
        ano: 2026,
        horasTrabalhadas: { toNumber: () => 160 },
        horasPrevistas: { toNumber: () => 168 },
        saldo: { toNumber: () => -8 },
      });

      const resultado = await repository.salvar({
        usuarioId: 7,
        mes: 8,
        ano: 2026,
        horasTrabalhadas: 160,
        horasPrevistas: 168,
        saldo: -8,
      });

      expect(resultado.saldo).toBe(-8);
      expect(prisma.bancoHoras.upsert).toHaveBeenCalledWith({
        where: { usuarioId_mes_ano: { usuarioId: 7, mes: 8, ano: 2026 } },
        create: {
          usuarioId: 7,
          mes: 8,
          ano: 2026,
          horasTrabalhadas: 160,
          horasPrevistas: 168,
          saldo: -8,
          calculadoAt: expect.any(Date),
        },
        update: {
          horasTrabalhadas: 160,
          horasPrevistas: 168,
          saldo: -8,
          calculadoAt: expect.any(Date),
        },
        select: {
          id: true,
          usuarioId: true,
          mes: true,
          ano: true,
          horasTrabalhadas: true,
          horasPrevistas: true,
          saldo: true,
        },
      });
    });
  });
});
