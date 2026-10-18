import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StatusAtestado, syncPullFixture } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarPullNaReplica,
  pullSemMudancas,
} from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { AcaoPendente } from '../../db/AcaoPendente';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { executarSincronizacao } from '../../sincronizacao/syncManager';
import { useMeusAtestados } from '../useMeusAtestados';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

const ATESTADO_DA_REPLICA = syncPullFixture.changes.atestados.updated[0];

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  useSincronizacaoStore.getState().reiniciar();
});

describe('useMeusAtestados', () => {
  it('lê os atestados da réplica, sem ir à rede', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const { result } = await renderHook(() => useMeusAtestados(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.atestados).toEqual([
      {
        chave: ATESTADO_DA_REPLICA.id_cliente,
        dataInicio: '2026-09-22',
        dataFim: '2026-09-23',
        observacao: 'Consulta e repouso.',
        status: StatusAtestado.REJEITADO,
        motivoRejeicao: 'Documento ilegível.',
        criadoEm: ATESTADO_DA_REPLICA.criado_em,
        aguardandoEnvio: false,
      },
    ]);
    expect(result.current.erro).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('atestado na fila entra na lista aguardando envio e vira um só quando o pull o traz', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);
    const { result } = await renderHook(() => useMeusAtestados(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await criarAcaoPendente(database, {
        tipo: 'atestado',
        idCliente: 'atestado-offline',
        criadoEm: '2026-10-17T10:00:00.000Z',
        payload: {
          idCliente: 'atestado-offline',
          dataInicio: '2026-10-15',
          dataFim: '2026-10-16',
          fotosCaminhos: ['file:///a.jpg', 'file:///b.jpg'],
        },
      });
    });

    await waitFor(() => expect(result.current.atestados).toHaveLength(2));
    expect(result.current.atestados[0]).toMatchObject({
      chave: 'atestado-offline',
      dataInicio: '2026-10-15',
      status: StatusAtestado.PENDENTE,
      aguardandoEnvio: true,
    });

    // O servidor aceitou (fica `enviada`) e o pull o devolve com o mesmo idCliente.
    await act(async () => {
      const [acao] = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
      await database.write(() =>
        acao.update((registro) => {
          registro.status = 'enviada';
        }),
      );
    });
    await waitFor(() => expect(result.current.atestados[0].aguardandoEnvio).toBe(false));

    const pull = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    pull.changes.atestados.updated = [
      {
        ...ATESTADO_DA_REPLICA,
        id: '10',
        id_cliente: 'atestado-offline',
        data_inicio: '2026-10-15',
        data_fim: '2026-10-16',
        observacao: null,
        status: StatusAtestado.PENDENTE,
        motivo_rejeicao: null,
        validado_em: null,
        criado_em: '2026-10-17T10:00:02.000Z',
      },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, pull));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(async () =>
      expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0),
    );
    expect(result.current.atestados).toHaveLength(2);
    expect(
      result.current.atestados.filter((atestado) => atestado.chave === 'atestado-offline'),
    ).toHaveLength(1);
  });

  it('a decisão do RH chega à lista quando o pull atualiza o atestado existente', async () => {
    const database = criarBancoDeTeste();
    const pullInicial = pullSemMudancas(syncPullFixture.timestamp);
    pullInicial.changes.atestados.updated = [
      { ...ATESTADO_DA_REPLICA, status: StatusAtestado.PENDENTE, motivo_rejeicao: null },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, pullInicial));
    const { result } = await renderHook(() => useMeusAtestados(), { wrapper: comBanco(database) });
    await act(async () => {
      await executarSincronizacao(database);
    });
    await waitFor(() => expect(result.current.atestados).toHaveLength(1));
    expect(result.current.atestados[0].status).toBe(StatusAtestado.PENDENTE);

    const incremental = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    incremental.changes.atestados.updated = [
      { ...ATESTADO_DA_REPLICA, status: StatusAtestado.VALIDADO, motivo_rejeicao: null },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, incremental));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(() => expect(result.current.atestados[0].status).toBe(StatusAtestado.VALIDADO));
  });

  it('erro só quando a sincronização falhou E não há nenhum atestado (nem na fila)', async () => {
    const database = criarBancoDeTeste();
    const { result } = await renderHook(() => useMeusAtestados(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe(false);

    await act(async () => {
      useSincronizacaoStore.setState({ ultimoErro: 'sem_rede' });
    });
    expect(result.current.erro).toBe(true);

    await act(async () => {
      await gravarPullNaReplica(database, syncPullFixture);
    });
    await waitFor(() => expect(result.current.atestados).toHaveLength(1));
    expect(result.current.erro).toBe(false);
  });

  it('recarregar dispara uma sincronização', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useMeusAtestados(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/sync/pull');
    await waitFor(() => expect(result.current.atestados).toHaveLength(1));
  });
});
