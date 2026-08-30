import { StatusJornada, agruparJornadasPorDia } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';

const FUSO = 'America/Sao_Paulo';

function jornada(parcial: Partial<JornadaDTO> & { id: number }): JornadaDTO {
  return {
    usuarioId: 1,
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
    criadoEm: '2026-08-26T10:00:00.000Z',
    ...parcial,
  };
}

describe('agruparJornadasPorDia', () => {
  it('funde duas jornadas do mesmo dia: menor início, maior fim, minutos somados', () => {
    const dias = agruparJornadasPorDia(
      [
        jornada({
          id: 1,
          checkinAt: '2026-08-26T11:00:00.000Z', // 08:00 local
          checkoutAt: '2026-08-26T15:00:00.000Z', // 12:00 local — 240 min
        }),
        jornada({
          id: 2,
          checkinAt: '2026-08-26T16:00:00.000Z', // 13:00 local
          checkoutAt: '2026-08-26T20:00:00.000Z', // 17:00 local — 240 min
        }),
      ],
      FUSO,
    );

    expect(dias).toHaveLength(1);
    expect(dias[0].data).toBe('2026-08-26');
    expect(dias[0].inicio).toBe('2026-08-26T11:00:00.000Z');
    expect(dias[0].fim).toBe('2026-08-26T20:00:00.000Z');
    expect(dias[0].minutosTrabalhados).toBe(480);
    expect(dias[0].emAndamento).toBe(false);
  });

  it('jornada sem check-out marca o dia como em andamento e contribui zero minuto', () => {
    const dias = agruparJornadasPorDia(
      [jornada({ id: 1, status: StatusJornada.EM_ANDAMENTO, checkinAt: '2026-08-26T11:00:00.000Z' })],
      FUSO,
    );

    expect(dias[0].emAndamento).toBe(true);
    expect(dias[0].fim).toBeNull();
    expect(dias[0].minutosTrabalhados).toBe(0);
  });

  it('jornada que cruza a meia-noite conta inteira no dia do check-in', () => {
    const dias = agruparJornadasPorDia(
      [
        jornada({
          id: 1,
          checkinAt: '2026-08-27T02:50:00.000Z', // 26/08 23:50 local
          checkoutAt: '2026-08-27T03:30:00.000Z', // 27/08 00:30 local — 40 min
        }),
      ],
      FUSO,
    );

    expect(dias).toHaveLength(1);
    expect(dias[0].data).toBe('2026-08-26');
    expect(dias[0].minutosTrabalhados).toBe(40);
  });

  it('ordena do dia mais recente para o mais antigo', () => {
    const dias = agruparJornadasPorDia(
      [
        jornada({ id: 1, checkinAt: '2026-08-24T12:00:00.000Z', checkoutAt: '2026-08-24T13:00:00.000Z' }),
        jornada({ id: 2, checkinAt: '2026-08-26T12:00:00.000Z', checkoutAt: '2026-08-26T13:00:00.000Z' }),
      ],
      FUSO,
    );

    expect(dias.map((d) => d.data)).toEqual(['2026-08-26', '2026-08-24']);
  });

  it('ignora jornada sem check-in — não há dia ao qual pertencer', () => {
    expect(agruparJornadasPorDia([jornada({ id: 1 })], FUSO)).toEqual([]);
  });
});
