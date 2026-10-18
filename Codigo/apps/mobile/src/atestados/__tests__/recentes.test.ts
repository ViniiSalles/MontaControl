import { atestadosRecentes } from '../recentes';

interface Item {
  chave: string;
  criadoEm: string;
}

function item(parcial: Partial<Item> = {}): Item {
  return { chave: '1', criadoEm: '2026-09-01T12:00:00.000Z', ...parcial };
}

function lista(quantidade: number): Item[] {
  return Array.from({ length: quantidade }, (_, i) =>
    item({ chave: String(i + 1), criadoEm: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z` }),
  );
}

test('com menos atestados que o limite mostra todos e nenhum oculto', () => {
  const { visiveis, ocultos } = atestadosRecentes(lista(3), 5, false);
  expect(visiveis).toHaveLength(3);
  expect(ocultos).toBe(0);
});

test('com exatamente o limite mostra todos e nenhum oculto', () => {
  const { visiveis, ocultos } = atestadosRecentes(lista(5), 5, false);
  expect(visiveis).toHaveLength(5);
  expect(ocultos).toBe(0);
});

test('com mais que o limite mostra só os mais recentes e conta os ocultos', () => {
  const { visiveis, ocultos } = atestadosRecentes(lista(7), 5, false);
  expect(visiveis.map((a) => a.chave)).toEqual(['7', '6', '5', '4', '3']);
  expect(ocultos).toBe(2);
});

test('ordena por criadoEm decrescente independentemente da ordem de entrada', () => {
  const entrada = [
    item({ chave: 'a', criadoEm: '2026-09-01T12:00:00.000Z' }),
    item({ chave: 'b', criadoEm: '2026-09-03T12:00:00.000Z' }),
    item({ chave: 'c', criadoEm: '2026-09-02T12:00:00.000Z' }),
  ];
  expect(atestadosRecentes(entrada, 5, false).visiveis.map((a) => a.chave)).toEqual(['b', 'c', 'a']);
});

test('desempata criadoEm igual pela chave decrescente (resultado estável)', () => {
  const entrada = [item({ chave: 'a' }), item({ chave: 'c' }), item({ chave: 'b' })];
  expect(atestadosRecentes(entrada, 5, false).visiveis.map((a) => a.chave)).toEqual(['c', 'b', 'a']);
});

test('mostrarTodos exibe a lista inteira e nenhum oculto', () => {
  const { visiveis, ocultos } = atestadosRecentes(lista(7), 5, true);
  expect(visiveis).toHaveLength(7);
  expect(ocultos).toBe(0);
});

test('não altera o array recebido', () => {
  const entrada = lista(3);
  const copia = [...entrada];
  atestadosRecentes(entrada, 2, false);
  expect(entrada).toEqual(copia);
});
