import { Test } from '@nestjs/testing';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import type { UsuarioListado } from '../usuarios/usuario-listado';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { MontadorNaoEncontradoException } from './exceptions/montador-nao-encontrado.exception';
import { EspelhoPontoService } from './espelho-ponto.service';

const USUARIO_ID = 42;
const ANO = 2026;
const MES = 9;

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

function jornadaFake(
  dia: string,
  horaInicio: string,
  horaFim: string | null,
  emAtraso = false,
): JornadaDTO {
  return {
    id: 1,
    usuarioId: USUARIO_ID,
    status: horaFim ? StatusJornada.FINALIZADA : StatusJornada.EM_ANDAMENTO,
    checkinAt: `${dia}T${horaInicio}:00.000Z`,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: horaFim ? `${dia}T${horaFim}:00.000Z` : null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: emAtraso,
    criadoEm: `${dia}T${horaInicio}:00.000Z`,
  };
}

describe('EspelhoPontoService', () => {
  let service: EspelhoPontoService;
  let usuarios: jest.Mocked<UsuariosRepository>;
  let jornadas: jest.Mocked<JornadasRepository>;
  let atestados: jest.Mocked<AtestadosRepository>;

  beforeEach(async () => {
    const duploUsuarios: Partial<jest.Mocked<UsuariosRepository>> = {
      buscarPorId: jest.fn().mockResolvedValue(usuarioFake()),
    };
    const duploJornadas: Partial<jest.Mocked<JornadasRepository>> = {
      listarNoPeriodo: jest.fn().mockResolvedValue([]),
    };
    const duploAtestados: Partial<jest.Mocked<AtestadosRepository>> = {
      listarValidadosNoPeriodo: jest.fn().mockResolvedValue([]),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        EspelhoPontoService,
        { provide: UsuariosRepository, useValue: duploUsuarios },
        { provide: JornadasRepository, useValue: duploJornadas },
        { provide: AtestadosRepository, useValue: duploAtestados },
      ],
    }).compile();

    service = modulo.get(EspelhoPontoService);
    usuarios = modulo.get(UsuariosRepository);
    jornadas = modulo.get(JornadasRepository);
    atestados = modulo.get(AtestadosRepository);
    jest.clearAllMocks();
    usuarios.buscarPorId.mockResolvedValue(usuarioFake());
    jornadas.listarNoPeriodo.mockResolvedValue([]);
    atestados.listarValidadosNoPeriodo.mockResolvedValue([]);
  });

  it('lança MontadorNaoEncontradoException quando o usuário não existe', async () => {
    usuarios.buscarPorId.mockResolvedValue(null);

    await expect(service.montar(USUARIO_ID, ANO, MES)).rejects.toBeInstanceOf(
      MontadorNaoEncontradoException,
    );

    expect.assertions(2);
    try {
      await service.montar(USUARIO_ID, ANO, MES);
    } catch (erro) {
      expect((erro as MontadorNaoEncontradoException).getStatus()).toBe(404);
    }
  });

  it('lança MontadorNaoEncontradoException quando o usuário existe mas não é MONTADOR', async () => {
    usuarios.buscarPorId.mockResolvedValue(usuarioFake({ perfil: Perfil.RH }));

    await expect(service.montar(USUARIO_ID, ANO, MES)).rejects.toBeInstanceOf(
      MontadorNaoEncontradoException,
    );
  });

  it('lança MontadorNaoEncontradoException quando o usuário está inativo (soft delete)', async () => {
    usuarios.buscarPorId.mockResolvedValue(usuarioFake({ ativo: false }));

    await expect(service.montar(USUARIO_ID, ANO, MES)).rejects.toBeInstanceOf(
      MontadorNaoEncontradoException,
    );
  });

  it('com incluirInativo, retorna o espelho de um montador inativo', async () => {
    usuarios.buscarPorId.mockResolvedValue(usuarioFake({ ativo: false }));

    const resultado = await service.montar(USUARIO_ID, ANO, MES, true);

    expect(resultado.usuarioId).toBe(USUARIO_ID);
  });

  it('consulta as jornadas do mês pedido com os limites corretos', async () => {
    await service.montar(USUARIO_ID, ANO, MES);

    expect(jornadas.listarNoPeriodo).toHaveBeenCalledWith(
      USUARIO_ID,
      '2026-09-01T03:00:00.000Z',
      '2026-10-01T02:59:59.999Z',
    );
  });

  it('lista todos os dias do mês, inclusive os sem marcação', async () => {
    const espelho = await service.montar(USUARIO_ID, ANO, MES);

    expect(espelho.dias).toHaveLength(30);
    expect(espelho.dias[0].data).toBe('2026-09-01');
    expect(espelho.dias[29].data).toBe('2026-09-30');
    expect(espelho.dias[4].diaUtil).toBe(false); // 05/09 é sábado
  });

  it('preenche o dia com a marcação e soma o total do mês', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([jornadaFake('2026-09-01', '11:00', '20:00')]);

    const espelho = await service.montar(USUARIO_ID, ANO, MES);
    const primeiro = espelho.dias[0];

    expect(primeiro.minutosTrabalhados).toBe(540);
    expect(primeiro.emAndamento).toBe(false);
    expect(espelho.minutosTrabalhados).toBe(540);
    expect(espelho.usuarioNome).toBe('Maria Montadora');
    expect(espelho.mes).toBe(MES);
    expect(espelho.ano).toBe(ANO);
  });

  it('marca o dia que veio de ponto em atraso aprovado', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([jornadaFake('2026-09-02', '11:00', '20:00', true)]);

    const espelho = await service.montar(USUARIO_ID, ANO, MES);

    expect(espelho.dias[1].lancadoEmAtraso).toBe(true);
  });

  it('marca o dia em andamento quando falta o check-out', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([jornadaFake('2026-09-03', '11:00', null)]);

    const espelho = await service.montar(USUARIO_ID, ANO, MES);

    expect(espelho.dias[2].emAndamento).toBe(true);
    expect(espelho.dias[2].minutosTrabalhados).toBe(0);
  });

  it('marca como abonado o dia útil coberto por atestado validado e fecha o saldo', async () => {
    atestados.listarValidadosNoPeriodo.mockResolvedValue([
      { dataInicio: '2026-09-01', dataFim: '2026-09-04' },
    ]);

    const espelho = await service.montar(USUARIO_ID, ANO, MES);

    expect(espelho.dias[0].abonado).toBe(true);
    expect(espelho.dias[4].abonado).toBe(false); // sábado não abona
    expect(espelho.minutosAbonados).toBe(4 * 480);
    expect(espelho.minutosPrevistos).toBe(22 * 480);
    expect(espelho.saldoMinutos).toBe(4 * 480 - 22 * 480);
  });
});
