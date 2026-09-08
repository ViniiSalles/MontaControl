import { Test } from '@nestjs/testing';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { BancoHorasRepository } from './banco-horas.repository';
import { BancoHorasService } from './banco-horas.service';

const USUARIO_ID = 7;

/** 26/08/2026 14:00 em America/Sao_Paulo (17:00Z) — "agora" congelado. */
const AGORA = new Date('2026-08-26T17:00:00.000Z');

function jornadaFake(parcial: Partial<JornadaDTO> & { id: number }): JornadaDTO {
  return {
    usuarioId: USUARIO_ID,
    status: StatusJornada.FINALIZADA,
    checkinAt: null,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-01T10:00:00.000Z',
    ...parcial,
  };
}

describe('BancoHorasService', () => {
  let service: BancoHorasService;
  let bancoHoras: jest.Mocked<BancoHorasRepository>;
  let jornadas: jest.Mocked<JornadasRepository>;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const duploBancoHoras: Partial<jest.Mocked<BancoHorasRepository>> = {
      salvar: jest.fn().mockImplementation((dados) => Promise.resolve({ id: 1, ...dados })),
      buscar: jest.fn().mockResolvedValue(null),
    };
    const duploJornadas: Partial<jest.Mocked<JornadasRepository>> = {
      listarNoPeriodo: jest.fn().mockResolvedValue([]),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        BancoHorasService,
        { provide: BancoHorasRepository, useValue: duploBancoHoras },
        { provide: JornadasRepository, useValue: duploJornadas },
      ],
    }).compile();

    service = modulo.get(BancoHorasService);
    bancoHoras = modulo.get(BancoHorasRepository);
    jornadas = modulo.get(JornadasRepository);
    jest.clearAllMocks();
    jornadas.listarNoPeriodo.mockResolvedValue([]);
    bancoHoras.salvar.mockImplementation((dados) => Promise.resolve({ id: 1, ...dados }));
    bancoHoras.buscar.mockResolvedValue(null);
  });

  it('consulta as jornadas do mês pedido com os limites corretos', async () => {
    await service.calcular(USUARIO_ID, 8, 2026);

    expect(jornadas.listarNoPeriodo).toHaveBeenCalledWith(
      USUARIO_ID,
      '2026-08-01T03:00:00.000Z',
      '2026-09-01T02:59:59.999Z',
    );
  });

  it('soma os minutos de duas jornadas no mesmo dia (ex.: intervalo de almoço)', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([
      jornadaFake({
        id: 1,
        checkinAt: '2026-08-03T11:00:00.000Z', // 08:00 local
        checkoutAt: '2026-08-03T15:00:00.000Z', // 12:00 local — 240 min
      }),
      jornadaFake({
        id: 2,
        checkinAt: '2026-08-03T16:00:00.000Z', // 13:00 local
        checkoutAt: '2026-08-03T20:00:00.000Z', // 17:00 local — 240 min
      }),
    ]);

    const resultado = await service.calcular(USUARIO_ID, 8, 2026);

    expect(resultado.horasTrabalhadas).toBe(8);
    expect(resultado.horasPrevistas).toBe(168); // 21 dias úteis × 8h
    expect(resultado.saldo).toBe(8 - 168);
  });

  it('ignora jornada em andamento (sem checkout) no total', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([
      jornadaFake({ id: 1, checkinAt: '2026-08-03T11:00:00.000Z', checkoutAt: null }),
    ]);

    const resultado = await service.calcular(USUARIO_ID, 8, 2026);

    expect(resultado.horasTrabalhadas).toBe(0);
  });

  it('usa o mês corrente quando mes/ano não são informados', async () => {
    await service.calcular(USUARIO_ID);

    expect(jornadas.listarNoPeriodo).toHaveBeenCalledWith(
      USUARIO_ID,
      '2026-08-01T03:00:00.000Z',
      '2026-09-01T02:59:59.999Z',
    );
    expect(bancoHoras.salvar).toHaveBeenCalledWith(
      expect.objectContaining({ mes: 8, ano: 2026 }),
    );
  });

  it('grava o resultado calculado via BancoHorasRepository', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([
      jornadaFake({
        id: 1,
        checkinAt: '2026-08-03T11:00:00.000Z',
        checkoutAt: '2026-08-03T19:00:00.000Z', // 8h
      }),
    ]);

    await service.calcular(USUARIO_ID, 8, 2026);

    expect(bancoHoras.salvar).toHaveBeenCalledWith({
      usuarioId: USUARIO_ID,
      mes: 8,
      ano: 2026,
      horasTrabalhadas: 8,
      horasPrevistas: 168,
      saldo: 8 - 168,
    });
  });
});

describe('BancoHorasService — calcularSemPersistir', () => {
  let service: BancoHorasService;
  let bancoHoras: jest.Mocked<BancoHorasRepository>;
  let jornadas: jest.Mocked<JornadasRepository>;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const duploBancoHoras: Partial<jest.Mocked<BancoHorasRepository>> = {
      salvar: jest.fn().mockImplementation((dados) => Promise.resolve({ id: 1, ...dados })),
      buscar: jest.fn().mockResolvedValue(null),
    };
    const duploJornadas: Partial<jest.Mocked<JornadasRepository>> = {
      listarNoPeriodo: jest.fn().mockResolvedValue([]),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        BancoHorasService,
        { provide: BancoHorasRepository, useValue: duploBancoHoras },
        { provide: JornadasRepository, useValue: duploJornadas },
      ],
    }).compile();

    service = modulo.get(BancoHorasService);
    bancoHoras = modulo.get(BancoHorasRepository);
    jornadas = modulo.get(JornadasRepository);
    jest.clearAllMocks();
    jornadas.listarNoPeriodo.mockResolvedValue([]);
    bancoHoras.salvar.mockImplementation((dados) => Promise.resolve({ id: 1, ...dados }));
    bancoHoras.buscar.mockResolvedValue(null);
  });

  it('não chama bancoHoras.salvar', async () => {
    await service.calcularSemPersistir(USUARIO_ID, 8, 2026);

    expect(bancoHoras.salvar).not.toHaveBeenCalled();
  });

  it('reaproveita o id de um registro já existente', async () => {
    bancoHoras.buscar.mockResolvedValue({
      id: 5,
      usuarioId: USUARIO_ID,
      mes: 8,
      ano: 2026,
      horasTrabalhadas: 0,
      horasPrevistas: 0,
      saldo: 0,
    });

    const resultado = await service.calcularSemPersistir(USUARIO_ID, 8, 2026);

    expect(resultado.id).toBe(5);
  });

  it('retorna id: 0 quando não existe registro gravado', async () => {
    bancoHoras.buscar.mockResolvedValue(null);

    const resultado = await service.calcularSemPersistir(USUARIO_ID, 8, 2026);

    expect(resultado.id).toBe(0);
  });

  it('calcula o mesmo horasTrabalhadas/horasPrevistas/saldo que calcular', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([
      jornadaFake({
        id: 1,
        checkinAt: '2026-08-03T11:00:00.000Z', // 08:00 local
        checkoutAt: '2026-08-03T15:00:00.000Z', // 12:00 local — 240 min
      }),
      jornadaFake({
        id: 2,
        checkinAt: '2026-08-03T16:00:00.000Z', // 13:00 local
        checkoutAt: '2026-08-03T20:00:00.000Z', // 17:00 local — 240 min
      }),
    ]);

    const resultado = await service.calcularSemPersistir(USUARIO_ID, 8, 2026);

    expect(resultado.horasTrabalhadas).toBe(8);
    expect(resultado.horasPrevistas).toBe(168);
    expect(resultado.saldo).toBe(8 - 168);
  });
});
