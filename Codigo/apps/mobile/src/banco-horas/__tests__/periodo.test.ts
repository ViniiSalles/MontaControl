import { ehMesCorrente, mesAnterior, mesSeguinte, periodoAtual } from '../periodo';

describe('mesAnterior', () => {
  it('volta um mês dentro do mesmo ano', () => {
    expect(mesAnterior({ mes: 8, ano: 2026 })).toEqual({ mes: 7, ano: 2026 });
  });

  it('janeiro volta para dezembro do ano anterior', () => {
    expect(mesAnterior({ mes: 1, ano: 2026 })).toEqual({ mes: 12, ano: 2025 });
  });
});

describe('mesSeguinte', () => {
  it('avança um mês dentro do mesmo ano', () => {
    expect(mesSeguinte({ mes: 8, ano: 2026 })).toEqual({ mes: 9, ano: 2026 });
  });

  it('dezembro avança para janeiro do ano seguinte', () => {
    expect(mesSeguinte({ mes: 12, ano: 2026 })).toEqual({ mes: 1, ano: 2027 });
  });
});

describe('periodoAtual', () => {
  it('deriva mês e ano do instante ISO, no fuso de operação', () => {
    // 2026-08-26T02:00:00Z = 2026-08-25 23:00 em America/Sao_Paulo (UTC-3):
    // ainda é o dia (e o mês) anterior no fuso de operação.
    expect(periodoAtual('2026-08-26T02:00:00.000Z')).toEqual({ mes: 8, ano: 2026 });
  });
});

describe('ehMesCorrente', () => {
  const AGORA_ISO = '2026-08-26T17:00:00.000Z'; // 14:00 local

  it('true quando mês e ano batem com o período atual', () => {
    expect(ehMesCorrente({ mes: 8, ano: 2026 }, AGORA_ISO)).toBe(true);
  });

  it('false para qualquer outro mês', () => {
    expect(ehMesCorrente({ mes: 7, ano: 2026 }, AGORA_ISO)).toBe(false);
    expect(ehMesCorrente({ mes: 8, ano: 2025 }, AGORA_ISO)).toBe(false);
  });
});
