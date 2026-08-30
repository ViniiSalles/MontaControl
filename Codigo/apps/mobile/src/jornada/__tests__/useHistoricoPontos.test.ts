jest.mock('../clienteJornadas');

import { renderHook, waitFor } from '@testing-library/react-native';
import type { DiaJornadaDTO, HistoricoJornadasDTO } from '@montacontrol/shared';
import { buscarHistorico } from '../clienteJornadas';
import { useHistoricoPontos } from '../useHistoricoPontos';

const TOKEN = 'token-de-teste';

const DIA_FALSO: DiaJornadaDTO = {
  data: '2026-08-29',
  inicio: '2026-08-29T12:00:00.000Z',
  fim: '2026-08-29T20:00:00.000Z',
  minutosTrabalhados: 480,
  emAndamento: false,
  jornadas: [],
};

function historico(periodoDias: HistoricoJornadasDTO['periodoDias']): HistoricoJornadasDTO {
  return {
    periodoDias,
    inicioPeriodo: '2026-08-01T00:00:00.000Z',
    fimPeriodo: '2026-08-29T23:59:59.000Z',
    dias: [DIA_FALSO],
    totalMinutos: 480,
  };
}

describe('useHistoricoPontos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('começa carregando e depois preenche os dias e o total', async () => {
    // Promessa controlada manualmente: só resolve depois da asserção do
    // estado inicial, senão o `await renderHook` da v14 já flusharia o
    // efeito e "carregando" nunca seria observado como `true`.
    let resolverBusca!: (dados: HistoricoJornadasDTO) => void;
    (buscarHistorico as jest.Mock).mockReturnValue(
      new Promise<HistoricoJornadasDTO>((resolve) => {
        resolverBusca = resolve;
      }),
    );

    const { result } = await renderHook(() => useHistoricoPontos(TOKEN, 5));

    expect(result.current.carregando).toBe(true);

    resolverBusca(historico(5));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.dias).toEqual([DIA_FALSO]);
    expect(result.current.totalMinutos).toBe(480);
    expect(result.current.erro).toBe(false);
  });

  it('falha da API deixa erro true sem derrubar o hook', async () => {
    (buscarHistorico as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useHistoricoPontos(TOKEN, 15));

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.erro).toBe(true);
    expect(result.current.dias).toEqual([]);
  });

  it('trocar o período dispara nova busca com o período novo', async () => {
    (buscarHistorico as jest.Mock).mockResolvedValue(historico(5));

    const { result, rerender } = await renderHook(
      ({ periodo }: { periodo: 5 | 15 | 30 }) => useHistoricoPontos(TOKEN, periodo),
      { initialProps: { periodo: 5 } },
    );

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(buscarHistorico).toHaveBeenLastCalledWith(TOKEN, 5);

    (buscarHistorico as jest.Mock).mockResolvedValue(historico(30));
    await rerender({ periodo: 30 });

    await waitFor(() => expect(buscarHistorico).toHaveBeenLastCalledWith(TOKEN, 30));
    await waitFor(() => expect(result.current.totalMinutos).toBe(480));
  });
});
