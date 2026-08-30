jest.mock('../clienteJornadas');

import { renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { buscarJornadaAtual } from '../clienteJornadas';
import { useJornadaAtual } from '../useJornadaAtual';

const TOKEN = 'token-de-teste';

const JORNADA_FALSA: JornadaDTO = {
  id: 1,
  usuarioId: 10,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-08-29T12:00:00.000Z',
  checkinLatitude: -19.9325,
  checkinLongitude: -43.9382,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-08-29T12:00:00.000Z',
};

describe('useJornadaAtual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('começa carregando e depois preenche a jornada', async () => {
    // Promessa controlada manualmente: só resolve depois da asserção do
    // estado inicial, senão o `await renderHook` da v14 já flusharia o
    // efeito e "carregando" nunca seria observado como `true`.
    let resolverBusca!: (jornada: JornadaDTO) => void;
    (buscarJornadaAtual as jest.Mock).mockReturnValue(
      new Promise<JornadaDTO>((resolve) => {
        resolverBusca = resolve;
      }),
    );

    const { result } = await renderHook(() => useJornadaAtual(TOKEN));

    expect(result.current.carregando).toBe(true);

    resolverBusca(JORNADA_FALSA);
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.jornada).toEqual(JORNADA_FALSA);
    expect(result.current.erro).toBe(false);
  });

  it('falha da API deixa erro true sem derrubar o hook', async () => {
    (buscarJornadaAtual as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useJornadaAtual(TOKEN));

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.erro).toBe(true);
    expect(result.current.jornada).toBeNull();
  });
});
