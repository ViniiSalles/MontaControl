import { diasAbonados, diasUteisNoMes, periodoDoMes } from '@montacontrol/shared';

describe('calendario de RH', () => {
  describe('diasUteisNoMes', () => {
    it('conta só de segunda a sexta', () => {
      // Setembro/2026: 1º é terça, 30 dias, 22 dias úteis.
      expect(diasUteisNoMes(2026, 9)).toHaveLength(22);
    });

    it('devolve os dias em ISO YYYY-MM-DD, do primeiro ao último', () => {
      const dias = diasUteisNoMes(2026, 9);

      expect(dias[0]).toBe('2026-09-01');
      expect(dias[dias.length - 1]).toBe('2026-09-30');
      expect(dias).not.toContain('2026-09-05'); // sábado
      expect(dias).not.toContain('2026-09-06'); // domingo
    });
  });

  describe('diasAbonados', () => {
    it('abona só os dias úteis dentro do período do atestado', () => {
      const abonados = diasAbonados(
        [{ dataInicio: '2026-09-03', dataFim: '2026-09-07' }],
        2026,
        9,
      );

      // 03 (qui), 04 (sex), 07 (seg) — 05 e 06 são fim de semana.
      expect([...abonados].sort()).toEqual(['2026-09-03', '2026-09-04', '2026-09-07']);
    });

    it('recorta o período ao mês pedido', () => {
      const abonados = diasAbonados(
        [{ dataInicio: '2026-08-28', dataFim: '2026-09-02' }],
        2026,
        9,
      );

      expect([...abonados].sort()).toEqual(['2026-09-01', '2026-09-02']);
    });

    it('não conta o mesmo dia duas vezes quando dois atestados se sobrepõem', () => {
      const abonados = diasAbonados(
        [
          { dataInicio: '2026-09-01', dataFim: '2026-09-02' },
          { dataInicio: '2026-09-02', dataFim: '2026-09-03' },
        ],
        2026,
        9,
      );

      expect(abonados.size).toBe(3);
    });
  });

  describe('periodoDoMes', () => {
    it('vai do dia 1 ao último dia do mês', () => {
      expect(periodoDoMes(2026, 2)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });
      expect(periodoDoMes(2028, 2)).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
    });
  });
});
