import { StatusAtestado } from '@montacontrol/shared';
import type { AtestadoDTO } from '@montacontrol/shared';
import { atestadosRecentes } from '../recentes';

function atestadoFake(parcial: Partial<AtestadoDTO> = {}): AtestadoDTO {
  return {
    id: 1,
    usuarioId: 1,
    usuarioNome: 'Montador',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-03',
    observacao: null,
    status: StatusAtestado.PENDENTE,
    motivoRejeicao: null,
    validadoPor: null,
    validadoEm: null,
    criadoEm: '2026-09-01T12:00:00.000Z',
    ...parcial,
  };
}

function lista(quantidade: number): AtestadoDTO[] {
  return Array.from({ length: quantidade }, (_, i) =>
    atestadoFake({ id: i + 1, criadoEm: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z` }),
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
  expect(visiveis.map((a) => a.id)).toEqual([7, 6, 5, 4, 3]);
  expect(ocultos).toBe(2);
});

test('ordena por criadoEm decrescente independentemente da ordem de entrada', () => {
  const entrada = [
    atestadoFake({ id: 1, criadoEm: '2026-09-01T12:00:00.000Z' }),
    atestadoFake({ id: 2, criadoEm: '2026-09-03T12:00:00.000Z' }),
    atestadoFake({ id: 3, criadoEm: '2026-09-02T12:00:00.000Z' }),
  ];
  expect(atestadosRecentes(entrada, 5, false).visiveis.map((a) => a.id)).toEqual([2, 3, 1]);
});

test('desempata criadoEm igual pelo id decrescente', () => {
  const entrada = [atestadoFake({ id: 1 }), atestadoFake({ id: 3 }), atestadoFake({ id: 2 })];
  expect(atestadosRecentes(entrada, 5, false).visiveis.map((a) => a.id)).toEqual([3, 2, 1]);
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
