import { formatarHoras, formatarMesAno, formatarSaldoHoras } from '../formatacao';

describe('formatarHoras', () => {
  it('converte horas decimais em "Xh YYmin", sem sinal', () => {
    expect(formatarHoras(12.75)).toBe('12h 45min');
    expect(formatarHoras(0)).toBe('0h 00min');
  });
});

describe('formatarSaldoHoras', () => {
  it('saldo positivo ganha o sinal "+"', () => {
    expect(formatarSaldoHoras(12.75)).toBe('+12h 45min');
  });

  it('saldo negativo ganha o sinal "-", sem duplo sinal', () => {
    expect(formatarSaldoHoras(-8)).toBe('-8h 00min');
  });

  it('saldo zero ganha o sinal "+"', () => {
    expect(formatarSaldoHoras(0)).toBe('+0h 00min');
  });
});

describe('formatarMesAno', () => {
  it('formata mês e ano por extenso', () => {
    expect(formatarMesAno(8, 2026)).toBe('Agosto de 2026');
    expect(formatarMesAno(1, 2027)).toBe('Janeiro de 2027');
    expect(formatarMesAno(12, 2026)).toBe('Dezembro de 2026');
  });
});
