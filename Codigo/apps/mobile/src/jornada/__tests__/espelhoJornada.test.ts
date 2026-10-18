import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { construirHistoricoDTO, janelaDoPeriodo, jornadasNoPeriodo } from '../espelhoJornada';

function jornadaFalsa(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: 3,
    status: StatusJornada.FINALIZADA,
    checkinAt: '2026-09-09T12:00:00.000Z',
    checkinLatitude: -19.9,
    checkinLongitude: -43.9,
    checkinEndereco: 'Rua Falsa, 123',
    checkoutAt: '2026-09-09T18:00:00.000Z',
    checkoutLatitude: -19.9,
    checkoutLongitude: -43.9,
    checkoutEndereco: 'Rua Falsa, 123',
    lancadoEmAtraso: false,
    criadoEm: '2026-09-09T12:00:00.000Z',
    ...parcial,
  };
}

describe('janelaDoPeriodo', () => {
  it('5 dias termina no dia civil de agora e começa 4 dias antes', () => {
    const janela = janelaDoPeriodo(5, '2026-09-09T15:00:00.000Z'); // 12:00 local (UTC-3)

    expect(janela.fimPeriodo).toBe('2026-09-09');
    expect(janela.inicioPeriodo).toBe('2026-09-05');
  });
});

describe('jornadasNoPeriodo', () => {
  const AGORA = '2026-09-09T15:00:00.000Z';

  it('mantém só as jornadas com check-in dentro da janela do período', () => {
    const dentro = jornadaFalsa({ id: 1, checkinAt: '2026-09-09T12:00:00.000Z' });
    const noLimiteInferior = jornadaFalsa({ id: 2, checkinAt: '2026-09-05T03:00:00.000Z' });
    const antes = jornadaFalsa({ id: 3, checkinAt: '2026-09-05T02:59:59.999Z' });
    const depois = jornadaFalsa({ id: 4, checkinAt: '2026-09-10T03:00:00.000Z' });
    const semCheckin = jornadaFalsa({ id: 5, checkinAt: null });

    const resultado = jornadasNoPeriodo(
      [dentro, noLimiteInferior, antes, depois, semCheckin],
      5,
      AGORA,
    );

    expect(resultado.map((j) => j.id)).toEqual([1, 2]);
  });

  it('um período maior alcança jornadas mais antigas', () => {
    const antiga = jornadaFalsa({ id: 1, checkinAt: '2026-08-20T12:00:00.000Z' });

    expect(jornadasNoPeriodo([antiga], 5, AGORA)).toHaveLength(0);
    expect(jornadasNoPeriodo([antiga], 30, AGORA)).toHaveLength(1);
  });
});

describe('construirHistoricoDTO', () => {
  it('agrupa por dia e soma os minutos, reaproveitando agruparJornadasPorDia', () => {
    const historico = construirHistoricoDTO([jornadaFalsa({ id: 1 })], 5, '2026-09-09T15:00:00.000Z');

    expect(historico.periodoDias).toBe(5);
    expect(historico.dias).toHaveLength(1);
    expect(historico.dias[0].minutosTrabalhados).toBe(360);
    expect(historico.totalMinutos).toBe(360);
  });
});
