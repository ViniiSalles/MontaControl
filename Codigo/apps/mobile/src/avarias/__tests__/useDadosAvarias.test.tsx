import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StatusAvaria, syncPullFixture } from '@montacontrol/shared';
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
import {
  atualizarStatusDaSincronizacao,
  reiniciarStatusDaSincronizacao,
} from '../../sincronizacao/statusDaSincronizacao';
import { executarSincronizacao } from '../../sincronizacao/syncManager';
import { useDadosAvarias } from '../useDadosAvarias';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

const AVARIA_DA_REPLICA = syncPullFixture.changes.avarias.updated[0];

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  reiniciarStatusDaSincronizacao();
});

describe('useDadosAvarias', () => {
  it('lê pedidos, peças, tipos e histórico da réplica, sem ir à rede', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const { result } = await renderHook(() => useDadosAvarias(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    const [pedido] = result.current.pedidos;
    expect(pedido.numeroPedido).toBe('PED-2026-0012');
    expect(pedido.ambientes.map((ambiente) => ambiente.nome)).toEqual(['Cozinha', 'Quarto casal']);
    expect(pedido.ambientes[1].pecas.map((peca) => peca.descricao)).toEqual([
      'Porta de correr 2,10m',
      'Painel lateral guarda-roupa',
    ]);
    expect(result.current.tipos.map((tipo) => tipo.nome)).toEqual([
      'Peça danificada',
      'Peça faltando',
    ]);
    expect(result.current.avarias).toEqual([
      {
        chave: AVARIA_DA_REPLICA.id_cliente,
        descricaoPeca: 'Porta de correr 2,10m',
        ambiente: 'Quarto casal',
        numeroPedido: 'PED-2026-0012',
        tipoAvaria: 'Peça danificada',
        status: StatusAvaria.EM_ANALISE,
        parecer: null,
        criadoEm: AVARIA_DA_REPLICA.criado_em,
        aguardandoEnvio: false,
      },
    ]);
    expect(result.current.erro).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('avaria na fila entra na lista com o selo e vira uma só quando o pull a traz (mesmo idCliente)', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);
    const { result } = await renderHook(() => useDadosAvarias(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await criarAcaoPendente(database, {
        tipo: 'avaria',
        idCliente: 'avaria-offline',
        criadoEm: '2026-10-17T10:00:00.000Z',
        payload: {
          idCliente: 'avaria-offline',
          pecaId: 304,
          tipoAvariaId: 2,
          descricao: 'Não veio',
        },
      });
    });

    await waitFor(() => expect(result.current.avarias).toHaveLength(2));
    expect(result.current.avarias[0]).toMatchObject({
      chave: 'avaria-offline',
      descricaoPeca: 'Painel lateral guarda-roupa',
      ambiente: 'Quarto casal',
      tipoAvaria: 'Peça faltando',
      aguardandoEnvio: true,
    });

    // O servidor a aceitou (fica `enviada`); o pull a devolve com o mesmo idCliente.
    await act(async () => {
      const [acao] = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
      await database.write(() =>
        acao.update((registro) => {
          registro.status = 'enviada';
        }),
      );
    });
    await waitFor(() => expect(result.current.avarias[0].aguardandoEnvio).toBe(false));

    const pull = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    pull.changes.avarias.updated = [
      {
        ...AVARIA_DA_REPLICA,
        id: '78',
        id_cliente: 'avaria-offline',
        peca_id: '304',
        peca_descricao: 'Painel lateral guarda-roupa',
        tipo_avaria_id: '2',
        descricao: 'Não veio',
        status: StatusAvaria.REPORTADA,
        criado_em: '2026-10-17T10:00:03.000Z',
      },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, pull));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(async () =>
      expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0),
    );
    expect(result.current.avarias).toHaveLength(2);
    expect(
      result.current.avarias.filter((avaria) => avaria.chave === 'avaria-offline'),
    ).toHaveLength(1);
    expect(result.current.avarias[0].aguardandoEnvio).toBe(false);
  });

  it('o parecer do gestor chega à lista quando o pull atualiza a avaria existente', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useDadosAvarias(), { wrapper: comBanco(database) });
    await act(async () => {
      await executarSincronizacao(database);
    });
    await waitFor(() => expect(result.current.avarias).toHaveLength(1));

    const incremental = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    incremental.changes.avarias.updated = [
      { ...AVARIA_DA_REPLICA, status: StatusAvaria.RESOLVIDA, parecer: 'Peça reposta' },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, incremental));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(() => expect(result.current.avarias[0].parecer).toBe('Peça reposta'));
    expect(result.current.avarias[0].status).toBe(StatusAvaria.RESOLVIDA);
  });

  it('réplica vazia e nenhuma falha de sincronização: listas vazias, sem erro inventado', async () => {
    const database = criarBancoDeTeste();

    const { result } = await renderHook(() => useDadosAvarias(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.pedidos).toEqual([]);
    expect(result.current.erro).toBe(false);
  });

  it('erro só quando a sincronização falhou E não há nenhum dado local', async () => {
    const database = criarBancoDeTeste();
    const { result } = await renderHook(() => useDadosAvarias(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      atualizarStatusDaSincronizacao({ ultimoErro: 'sem_rede' });
    });
    expect(result.current.erro).toBe(true);

    await act(async () => {
      await gravarPullNaReplica(database, syncPullFixture);
    });
    await waitFor(() => expect(result.current.pedidos).toHaveLength(1));
    expect(result.current.erro).toBe(false);
  });

  it('recarregar dispara uma sincronização', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useDadosAvarias(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/sync/pull');
    await waitFor(() => expect(result.current.pedidos).toHaveLength(1));
  });
});
