import { diasUteisNoMes, horasPrevistasNoMes } from '@montacontrol/shared';

describe('diasUteisNoMes', () => {
  it('conta os dias de segunda a sexta em agosto/2026', () => {
    expect(diasUteisNoMes(8, 2026)).toBe(21);
  });

  it('conta os dias úteis em fevereiro de ano bissexto (29 dias)', () => {
    expect(diasUteisNoMes(2, 2028)).toBe(21);
  });
});

describe('horasPrevistasNoMes', () => {
  it('multiplica dias úteis por 8 horas', () => {
    expect(horasPrevistasNoMes(8, 2026)).toBe(168);
  });

  it('fevereiro de ano não bissexto tem menos horas previstas', () => {
    expect(horasPrevistasNoMes(2, 2026)).toBe(160);
  });
});
