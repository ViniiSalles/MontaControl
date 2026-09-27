import { textoPeriodo } from '../formatarPeriodo';

describe('textoPeriodo', () => {
  it('um dia só mostra a data e "1 dia"', () => {
    expect(textoPeriodo('2026-10-12', '2026-10-12')).toBe('12/10 (1 dia)');
  });

  it('vários dias mostra o intervalo e a contagem inclusiva', () => {
    expect(textoPeriodo('2026-10-15', '2026-10-17')).toBe('15/10 a 17/10 (3 dias)');
  });

  it('período atravessando o mês conta os dias corridos', () => {
    expect(textoPeriodo('2026-09-29', '2026-10-02')).toBe('29/09 a 02/10 (4 dias)');
  });
});
