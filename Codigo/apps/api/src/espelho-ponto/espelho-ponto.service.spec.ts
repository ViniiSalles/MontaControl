import { Test } from '@nestjs/testing';
import { StatusJornada } from '@montacontrol/shared';
import type { BancoHorasDTO, JornadaDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import type { UsuarioListado } from '../usuarios/usuario-listado';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { EspelhoPontoService } from './espelho-ponto.service';
import { MontadorNaoEncontradoException } from './exceptions/montador-nao-encontrado.exception';

const USUARIO_ID = 42;

function usuarioFake(parcial: Partial<UsuarioListado> = {}): UsuarioListado {
  return {
    id: USUARIO_ID,
    nome: 'Maria Montadora',
    email: 'maria@montacontrol.local',
    perfil: Perfil.MONTADOR,
    ativo: true,
    ...parcial,
  };
}

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

function bancoHorasFake(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return {
    id: 1,
    usuarioId: USUARIO_ID,
    mes: 8,
    ano: 2026,
    horasTrabalhadas: 160,
    horasPrevistas: 168,
    saldo: -8,
    ...parcial,
  };
}

describe('EspelhoPontoService', () => {
  let service: EspelhoPontoService;
  let usuarios: jest.Mocked<UsuariosRepository>;
  let jornadas: jest.Mocked<JornadasRepository>;
  let bancoHoras: jest.Mocked<BancoHorasService>;

  beforeEach(async () => {
    const duploUsuarios: Partial<jest.Mocked<UsuariosRepository>> = {
      buscarPorId: jest.fn().mockResolvedValue(usuarioFake()),
    };
    const duploJornadas: Partial<jest.Mocked<JornadasRepository>> = {
      listarNoPeriodo: jest.fn().mockResolvedValue([]),
    };
    const duploBancoHoras: Partial<jest.Mocked<BancoHorasService>> = {
      calcularSemPersistir: jest.fn().mockResolvedValue(bancoHorasFake()),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        EspelhoPontoService,
        { provide: UsuariosRepository, useValue: duploUsuarios },
        { provide: JornadasRepository, useValue: duploJornadas },
        { provide: BancoHorasService, useValue: duploBancoHoras },
      ],
    }).compile();

    service = modulo.get(EspelhoPontoService);
    usuarios = modulo.get(UsuariosRepository);
    jornadas = modulo.get(JornadasRepository);
    bancoHoras = modulo.get(BancoHorasService);
    jest.clearAllMocks();
    usuarios.buscarPorId.mockResolvedValue(usuarioFake());
    jornadas.listarNoPeriodo.mockResolvedValue([]);
    bancoHoras.calcularSemPersistir.mockResolvedValue(bancoHorasFake());
  });

  it('lança MontadorNaoEncontradoException quando o usuário não existe', async () => {
    usuarios.buscarPorId.mockResolvedValue(null);

    await expect(service.gerar(USUARIO_ID, 8, 2026)).rejects.toBeInstanceOf(
      MontadorNaoEncontradoException,
    );

    expect.assertions(2);
    try {
      await service.gerar(USUARIO_ID, 8, 2026);
    } catch (erro) {
      expect((erro as MontadorNaoEncontradoException).getStatus()).toBe(404);
    }
  });

  it('lança MontadorNaoEncontradoException quando o usuário existe mas não é MONTADOR', async () => {
    usuarios.buscarPorId.mockResolvedValue(usuarioFake({ perfil: Perfil.RH }));

    await expect(service.gerar(USUARIO_ID, 8, 2026)).rejects.toBeInstanceOf(
      MontadorNaoEncontradoException,
    );

    expect.assertions(2);
    try {
      await service.gerar(USUARIO_ID, 8, 2026);
    } catch (erro) {
      expect((erro as MontadorNaoEncontradoException).getStatus()).toBe(404);
    }
  });

  it('lança MontadorNaoEncontradoException quando o usuário está inativo (soft delete)', async () => {
    usuarios.buscarPorId.mockResolvedValue(usuarioFake({ ativo: false }));

    await expect(service.gerar(USUARIO_ID, 8, 2026)).rejects.toBeInstanceOf(
      MontadorNaoEncontradoException,
    );
  });

  it('com incluirInativo, retorna o espelho de um montador inativo', async () => {
    usuarios.buscarPorId.mockResolvedValue(usuarioFake({ ativo: false }));

    const resultado = await service.gerar(USUARIO_ID, 8, 2026, true);

    expect(resultado.usuarioId).toBe(USUARIO_ID);
  });

  it('consulta as jornadas do mês pedido com os limites corretos', async () => {
    await service.gerar(USUARIO_ID, 8, 2026);

    expect(jornadas.listarNoPeriodo).toHaveBeenCalledWith(
      USUARIO_ID,
      '2026-08-01T03:00:00.000Z',
      '2026-09-01T02:59:59.999Z',
    );
  });

  it('agrupa as jornadas do período por dia', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([
      jornadaFake({
        id: 1,
        checkinAt: '2026-08-03T11:00:00.000Z',
        checkoutAt: '2026-08-03T19:00:00.000Z',
      }),
      jornadaFake({
        id: 2,
        checkinAt: '2026-08-04T11:00:00.000Z',
        checkoutAt: '2026-08-04T19:00:00.000Z',
      }),
    ]);

    const resultado = await service.gerar(USUARIO_ID, 8, 2026);

    expect(resultado.dias).toHaveLength(2);
    expect(resultado.dias.map((d) => d.data)).toEqual(['2026-08-04', '2026-08-03']);
    expect(resultado.usuarioId).toBe(USUARIO_ID);
    expect(resultado.usuarioNome).toBe('Maria Montadora');
    expect(resultado.mes).toBe(8);
    expect(resultado.ano).toBe(2026);
  });

  it('propaga o BancoHorasDTO do BancoHorasService sem alterar', async () => {
    const saldoCalculado = bancoHorasFake({ horasTrabalhadas: 100, saldo: -68 });
    bancoHoras.calcularSemPersistir.mockResolvedValue(saldoCalculado);

    const resultado = await service.gerar(USUARIO_ID, 8, 2026);

    expect(bancoHoras.calcularSemPersistir).toHaveBeenCalledWith(USUARIO_ID, 8, 2026);
    expect(resultado.bancoHoras).toEqual(saldoCalculado);
  });
});
