import { comporInstante, diaNoFuso, somarDias } from '@montacontrol/shared';

const FUSO = 'America/Sao_Paulo';

describe('diaNoFuso', () => {
  it('classifica 21h no fuso local como o dia local, não o dia UTC', () => {
    // 2026-08-25T21:00-03:00 é 2026-08-26T00:00Z — em UTC já virou dia 26.
    expect(diaNoFuso('2026-08-26T00:00:00.000Z', FUSO)).toBe('2026-08-25');
  });

  it('classifica meio-dia normalmente', () => {
    expect(diaNoFuso('2026-08-26T15:00:00.000Z', FUSO)).toBe('2026-08-26');
  });
});

describe('comporInstante', () => {
  it('compõe dia e hora locais no instante UTC correspondente', () => {
    expect(comporInstante('2026-08-26', '08:30', FUSO)).toBe('2026-08-26T11:30:00.000Z');
  });

  it('é o inverso de diaNoFuso na virada do dia', () => {
    const instante = comporInstante('2026-08-25', '23:50', FUSO);
    expect(diaNoFuso(instante, FUSO)).toBe('2026-08-25');
  });
});

describe('somarDias', () => {
  it('subtrai dias atravessando a virada de mês', () => {
    expect(somarDias('2026-09-02', -7)).toBe('2026-08-26');
  });

  it('soma zero devolve a mesma data', () => {
    expect(somarDias('2026-08-26', 0)).toBe('2026-08-26');
  });
});
