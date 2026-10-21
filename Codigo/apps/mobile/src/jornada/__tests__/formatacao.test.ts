import { formatarDiaDaSemana, formatarDiaEMes } from '../formatacao';

describe('formatarDiaEMes', () => {
  it.each([
    ['2026-08-26', '26 ago'],
    ['2026-10-07', '07 out'],
    ['2026-01-01', '01 jan'],
  ])('%s → %s', (data, esperado) => {
    expect(formatarDiaEMes(data)).toBe(esperado);
  });
});

describe('formatarDiaDaSemana', () => {
  it.each([
    ['2026-08-26', 'quarta-feira'],
    ['2026-10-18', 'domingo'],
  ])('%s → %s', (data, esperado) => {
    expect(formatarDiaDaSemana(data)).toBe(esperado);
  });

  // A entrada é um dia civil: formatar no fuso do aparelho poderia trocar o dia.
  it('não desloca o dia civil pelo fuso', () => {
    expect(formatarDiaDaSemana('2026-01-01')).toBe('quinta-feira');
  });
});
