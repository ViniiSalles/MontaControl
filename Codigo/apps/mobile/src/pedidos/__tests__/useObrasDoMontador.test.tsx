import { act, renderHook, waitFor } from '@testing-library/react-native';
import { syncPullFixture } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste, gravarPullNaReplica, pullSemMudancas } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { executarSincronizacao } from '../../sincronizacao/syncManager';
import { useObrasDoMontador } from '../useObrasDoMontador';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  useSincronizacaoStore.getState().reiniciar();
});

describe('useObrasDoMontador', () => {
  it('lê as obras da tabela pedidos da réplica, com o local do cliente, sem ir à rede', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const { result } = await renderHook(() => useObrasDoMontador(database), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    const pedido = syncPullFixture.changes.pedidos.updated[0];
    expect(result.current.obras).toEqual([
      {
        id: Number(pedido.id),
        numeroPedido: pedido.numero_pedido,
        cliente: {
          nome: pedido.cliente_nome,
          endereco: pedido.cliente_endereco,
          cidade: pedido.cliente_cidade,
          estado: pedido.cliente_estado,
          latitude: pedido.cliente_latitude,
          longitude: pedido.cliente_longitude,
        },
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem réplica, a lista é vazia e deixa de carregar (sem erro de rede inventado)', async () => {
    const database = criarBancoDeTeste();

    const { result } = await renderHook(() => useObrasDoMontador(database), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.obras).toEqual([]);
  });

  it('pedido desalocado no servidor some da lista de obras depois do pull', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useObrasDoMontador(database), {
      wrapper: comBanco(database),
    });
    await act(async () => {
      await executarSincronizacao(database);
    });
    await waitFor(() => expect(result.current.obras).toHaveLength(1));

    const incremental = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    incremental.changes.pedidos.deleted = ['12'];
    fetchMock.mockResolvedValueOnce(respostaJson(200, incremental));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(() => expect(result.current.obras).toHaveLength(0));
  });

  it('mudança do endereço do cliente no servidor chega à lista (linha atualizada)', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useObrasDoMontador(database), {
      wrapper: comBanco(database),
    });
    await act(async () => {
      await executarSincronizacao(database);
    });
    await waitFor(() => expect(result.current.obras).toHaveLength(1));

    const incremental = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    incremental.changes.pedidos.updated = [
      { ...syncPullFixture.changes.pedidos.updated[0], cliente_endereco: 'Av. Nova, 500' },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, incremental));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(() => expect(result.current.obras[0].cliente.endereco).toBe('Av. Nova, 500'));
  });

  it('recarregar dispara uma sincronização', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useObrasDoMontador(database), {
      wrapper: comBanco(database),
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.obras).toEqual([]);

    await act(async () => {
      await result.current.recarregar();
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/sync/pull');
    await waitFor(() => expect(result.current.obras).toHaveLength(1));
  });
});
