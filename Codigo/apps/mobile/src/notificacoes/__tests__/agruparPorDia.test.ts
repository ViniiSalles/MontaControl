import { agruparPorDia } from '../agruparPorDia';

const AGORA = '2026-10-14T17:00:00.000Z'; // 14:00 em America/Sao_Paulo

const item = (id: string, criadaEm: string) => ({ id, criadaEm });

describe('agruparPorDia', () => {
  it('agruparPorDia separa Hoje, Ontem e datas anteriores no fuso de operação', () => {
    const itens = [
      item('a', '2026-10-14T15:00:00.000Z'), // 12:00 de hoje
      item('b', '2026-10-14T03:00:00.000Z'), // 00:00 de hoje em SP
      // 23:59 de ontem em SP — ainda é dia 14 em UTC, então só o fuso o põe em "Ontem".
      item('c', '2026-10-14T02:59:00.000Z'),
      item('d', '2026-10-13T12:00:00.000Z'),
      item('e', '2026-10-10T12:00:00.000Z'),
      item('f', '2026-09-30T12:00:00.000Z'),
    ];

    const grupos = agruparPorDia(itens, AGORA);

    expect(grupos.map((grupo) => grupo.rotulo)).toEqual(['Hoje', 'Ontem', '10/10/2026', '30/09/2026']);
    expect(grupos.map((grupo) => grupo.itens.map((i) => i.id))).toEqual([['a', 'b'], ['c', 'd'], ['e'], ['f']]);
  });

  it('o "agora" também é avaliado no fuso: 23:00 de SP ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC', () => {
    const grupos = agruparPorDia([item('a', '2026-10-14T15:00:00.000Z')], '2026-10-15T02:00:00.000Z');

    expect(grupos.map((grupo) => grupo.rotulo)).toEqual(['Hoje']);
  });

  it('item no futuro (relógio do aparelho atrasado) cai em Hoje em vez de inventar um rótulo', () => {
    const grupos = agruparPorDia([item('a', '2026-10-16T12:00:00.000Z')], AGORA);

    expect(grupos.map((grupo) => grupo.rotulo)).toEqual(['Hoje']);
  });

  it('mantém a ordem recebida e devolve vazio sem itens', () => {
    expect(agruparPorDia([], AGORA)).toEqual([]);
  });
});
