import { Test } from '@nestjs/testing';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from '../pontos-em-atraso/pontos-em-atraso.repository';
import type { UsuarioListado } from '../usuarios/usuario-listado';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { BancoHorasRepository } from './banco-horas.repository';
import { BancoHorasService } from './banco-horas.service';

const USUARIO_ID = 7;

/** 26/08/2026 14:00 em America/Sao_Paulo (17:00Z) — "agora" congelado. */
const AGORA = new Date('2026-08-26T17:00:00.000Z');

/** Setembro/2026: 22 dias úteis × 8 h = 176 h previstas. */
const ANO = 2026;
const MES = 9;

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

function usuarioFake(parcial: Partial<UsuarioListado> = {}): UsuarioListado {
  return {
    id: USUARIO_ID,
    nome: 'Montador Um',
    email: 'm1@x.local',
    perfil: Perfil.MONTADOR,
    ativo: true,
    ...parcial,
  };
}

describe('BancoHorasService', () => {
  let service: BancoHorasService;
  let bancoHoras: jest.Mocked<BancoHorasRepository>;
  let jornadas: jest.Mocked<JornadasRepository>;
  let atestados: jest.Mocked<AtestadosRepository>;
  let pontos: jest.Mocked<PontosEmAtrasoRepository>;
  let usuarios: jest.Mocked<UsuariosRepository>;

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
    const duploAtestados: Partial<jest.Mocked<AtestadosRepository>> = {
      listarValidadosNoPeriodo: jest.fn().mockResolvedValue([]),
    };
    const duploPontos: Partial<jest.Mocked<PontosEmAtrasoRepository>> = {
      contarPendentesPorUsuario: jest.fn().mockResolvedValue(new Map()),
    };
    const duploUsuarios: Partial<jest.Mocked<UsuariosRepository>> = {
      listar: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn().mockResolvedValue(usuarioFake()),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        BancoHorasService,
        { provide: BancoHorasRepository, useValue: duploBancoHoras },
        { provide: JornadasRepository, useValue: duploJornadas },
        { provide: AtestadosRepository, useValue: duploAtestados },
        { provide: PontosEmAtrasoRepository, useValue: duploPontos },
        { provide: UsuariosRepository, useValue: duploUsuarios },
      ],
    }).compile();

    service = modulo.get(BancoHorasService);
    bancoHoras = modulo.get(BancoHorasRepository);
    jornadas = modulo.get(JornadasRepository);
    atestados = modulo.get(AtestadosRepository);
    pontos = modulo.get(PontosEmAtrasoRepository);
    usuarios = modulo.get(UsuariosRepository);
    jest.clearAllMocks();
    jornadas.listarNoPeriodo.mockResolvedValue([]);
    atestados.listarValidadosNoPeriodo.mockResolvedValue([]);
    pontos.contarPendentesPorUsuario.mockResolvedValue(new Map());
    usuarios.listar.mockResolvedValue([]);
    usuarios.buscarPorId.mockResolvedValue(usuarioFake());
    bancoHoras.salvar.mockImplementation((dados) => Promise.resolve({ id: 1, ...dados }));
    bancoHoras.buscar.mockResolvedValue(null);
  });

  describe('calcular', () => {
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
      expect(bancoHoras.salvar).toHaveBeenCalledWith(expect.objectContaining({ mes: 8, ano: 2026 }));
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

    it('abona os dias úteis do atestado validado, reduzindo a dívida', async () => {
      atestados.listarValidadosNoPeriodo.mockResolvedValue([
        { dataInicio: '2026-08-03', dataFim: '2026-08-06' }, // seg a qui: 4 dias úteis
      ]);

      const resultado = await service.calcular(USUARIO_ID, 8, 2026);

      expect(resultado.saldo).toBe(4 * 8 - 168);
    });
  });

  describe('calcularSemPersistir', () => {
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
      const resultado = await service.calcularSemPersistir(USUARIO_ID, 8, 2026);

      expect(resultado.id).toBe(0);
    });

    it('calcula o mesmo horasTrabalhadas/horasPrevistas/saldo que calcular', async () => {
      jornadas.listarNoPeriodo.mockResolvedValue([
        jornadaFake({
          id: 1,
          checkinAt: '2026-08-03T11:00:00.000Z',
          checkoutAt: '2026-08-03T15:00:00.000Z',
        }),
        jornadaFake({
          id: 2,
          checkinAt: '2026-08-03T16:00:00.000Z',
          checkoutAt: '2026-08-03T20:00:00.000Z',
        }),
      ]);

      const resultado = await service.calcularSemPersistir(USUARIO_ID, 8, 2026);

      expect(resultado.horasTrabalhadas).toBe(8);
      expect(resultado.horasPrevistas).toBe(168);
      expect(resultado.saldo).toBe(8 - 168);
    });
  });

  describe('doMontador', () => {
    it('sem jornada e sem atestado, o saldo é o mês inteiro devendo', async () => {
      const resultado = await service.doMontador(USUARIO_ID, ANO, MES);

      expect(resultado.horasPrevistas).toBe(176);
      expect(resultado.horasTrabalhadas).toBe(0);
      expect(resultado.horasAbonadas).toBe(0);
      expect(resultado.saldo).toBe(-176);
    });

    it('soma as horas das jornadas finalizadas do mês', async () => {
      jornadas.listarNoPeriodo.mockResolvedValue([
        jornadaFake({
          id: 1,
          checkinAt: '2026-09-01T11:00:00.000Z',
          checkoutAt: '2026-09-01T20:00:00.000Z', // 9h
        }),
        jornadaFake({
          id: 2,
          checkinAt: '2026-09-02T11:00:00.000Z',
          checkoutAt: '2026-09-02T18:00:00.000Z', // 7h
        }),
      ]);

      const resultado = await service.doMontador(USUARIO_ID, ANO, MES);

      expect(resultado.horasTrabalhadas).toBe(16);
      expect(resultado.saldo).toBe(16 - 176);
    });

    it('abona os dias úteis do atestado validado, reduzindo a dívida', async () => {
      atestados.listarValidadosNoPeriodo.mockResolvedValue([
        { dataInicio: '2026-09-01', dataFim: '2026-09-04' }, // ter a sex: 4 dias úteis
      ]);

      const resultado = await service.doMontador(USUARIO_ID, ANO, MES);

      expect(resultado.horasAbonadas).toBe(32);
      expect(resultado.saldo).toBe(-144);
    });

    it('grava o snapshot em banco_horas a cada leitura', async () => {
      await service.doMontador(USUARIO_ID, ANO, MES);

      expect(bancoHoras.salvar).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: USUARIO_ID, ano: ANO, mes: MES, saldo: -176 }),
      );
    });

    it('conta as compensações pendentes do montador', async () => {
      pontos.contarPendentesPorUsuario.mockResolvedValue(new Map([[USUARIO_ID, 3]]));

      const resultado = await service.doMontador(USUARIO_ID, ANO, MES);

      expect(resultado.compensacoesPendentes).toBe(3);
    });
  });

  describe('listarDaEquipe', () => {
    it('lista só montadores no painel da equipe, com as compensações pendentes', async () => {
      usuarios.listar.mockResolvedValue([
        usuarioFake({ id: 7, nome: 'Montador Um' }),
        usuarioFake({ id: 8, nome: 'Ana RH', perfil: Perfil.RH }),
      ]);
      pontos.contarPendentesPorUsuario.mockResolvedValue(new Map([[7, 2]]));

      const resultado = await service.listarDaEquipe(ANO, MES);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].usuarioNome).toBe('Montador Um');
      expect(resultado[0].compensacoesPendentes).toBe(2);
    });
  });
});
