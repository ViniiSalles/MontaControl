import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { EspelhoPontoService } from './espelho-ponto.service';

const ANO = 2026;
const MES = 9;

function jornada(dia: string, horaInicio: string, horaFim: string | null, emAtraso = false) {
  return {
    id: 1,
    usuarioId: 7,
    status: horaFim ? 'FINALIZADA' : 'EM_ANDAMENTO',
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
  let jornadas: { listarNoPeriodo: jest.Mock };
  let atestados: { listarValidadosNoPeriodo: jest.Mock };
  let usuarios: { listar: jest.Mock };
  let service: EspelhoPontoService;

  beforeEach(() => {
    jornadas = { listarNoPeriodo: jest.fn().mockResolvedValue([]) };
    atestados = { listarValidadosNoPeriodo: jest.fn().mockResolvedValue([]) };
    usuarios = {
      listar: jest.fn().mockResolvedValue([
        { id: 7, nome: 'Montador Um', email: 'm1@x.local', perfil: Perfil.MONTADOR, ativo: true },
      ]),
    };
    service = new EspelhoPontoService(
      jornadas as unknown as JornadasRepository,
      atestados as unknown as AtestadosRepository,
      usuarios as unknown as UsuariosRepository,
    );
  });

  it('lista todos os dias do mês, inclusive os sem marcação', async () => {
    const espelho = await service.montar(7, ANO, MES);

    expect(espelho.dias).toHaveLength(30);
    expect(espelho.dias[0].data).toBe('2026-09-01');
    expect(espelho.dias[29].data).toBe('2026-09-30');
    expect(espelho.dias[4].diaUtil).toBe(false); // 05/09 é sábado
  });

  it('preenche o dia com a marcação e soma o total do mês', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([jornada('2026-09-01', '11:00', '20:00')]);

    const espelho = await service.montar(7, ANO, MES);
    const primeiro = espelho.dias[0];

    expect(primeiro.minutosTrabalhados).toBe(540);
    expect(primeiro.emAndamento).toBe(false);
    expect(espelho.minutosTrabalhados).toBe(540);
  });

  it('marca o dia que veio de ponto em atraso aprovado', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([jornada('2026-09-02', '11:00', '20:00', true)]);

    const espelho = await service.montar(7, ANO, MES);

    expect(espelho.dias[1].lancadoEmAtraso).toBe(true);
  });

  it('marca o dia em andamento quando falta o check-out', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([jornada('2026-09-03', '11:00', null)]);

    const espelho = await service.montar(7, ANO, MES);

    expect(espelho.dias[2].emAndamento).toBe(true);
    expect(espelho.dias[2].minutosTrabalhados).toBe(0);
  });

  it('marca como abonado o dia útil coberto por atestado validado e fecha o saldo', async () => {
    atestados.listarValidadosNoPeriodo.mockResolvedValue([
      { dataInicio: '2026-09-01', dataFim: '2026-09-04' },
    ]);

    const espelho = await service.montar(7, ANO, MES);

    expect(espelho.dias[0].abonado).toBe(true);
    expect(espelho.dias[4].abonado).toBe(false); // sábado não abona
    expect(espelho.minutosAbonados).toBe(4 * 480);
    expect(espelho.minutosPrevistos).toBe(22 * 480);
    expect(espelho.saldoMinutos).toBe(4 * 480 - 22 * 480);
  });
});
