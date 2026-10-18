import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  linhaDeJornada,
} from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import {
  atualizarStatusDaSincronizacao,
  reiniciarStatusDaSincronizacao,
} from '../../sincronizacao/statusDaSincronizacao';
import { useJornadaAtual } from '../useJornadaAtual';
import { AGORA_FIXO_MS, fixarRelogio, soltarRelogio } from './relogioFixo';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

// Instantes relativos ao relógio fixo do teste (14:00 em SP): o hook decide
// "hoje" por ele, e o relógio real quebrava os testes logo depois da meia-noite.
const minutosAtras = (minutos: number) => new Date(AGORA_FIXO_MS - minutos * 60_000).toISOString();
const HA_4MIN = minutosAtras(4);
const HA_3MIN = minutosAtras(3);
const HA_2MIN = minutosAtras(2);
const HA_1MIN = minutosAtras(1);

const abertaNaReplica = () =>
  linhaDeJornada({
    id: '502',
    status: StatusJornada.EM_ANDAMENTO,
    checkin_endereco: 'Rua Falsa, 123',
    checkout_at: null,
    checkout_latitude: null,
    checkout_longitude: null,
    checkout_endereco: null,
    checkout_id_cliente: null,
  });

afterEach(() => {
  soltarRelogio();
});

beforeEach(() => {
  fixarRelogio();
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  reiniciarStatusDaSincronizacao();
});

describe('useJornadaAtual', () => {
  it('lê a jornada aberta da réplica, sem ir à rede ao montar', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornada?.checkinEndereco).toBe('Rua Falsa, 123');
    expect(result.current.jornada?.pedidoId).toBe(12);
    expect(result.current.erro).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem jornada aberta, mostra o último turno encerrado hoje (o ponto recém-batido não some)', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [
      linhaDeJornada({ id: '601', checkin_at: HA_4MIN, checkout_at: HA_3MIN }),
      linhaDeJornada({ id: '602', checkin_at: HA_2MIN, checkout_at: HA_1MIN }),
    ]);

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornada).toMatchObject({ id: 602, status: StatusJornada.FINALIZADA });
  });

  it('jornada encerrada em outro dia não é mostrada', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [
      linhaDeJornada({
        checkin_at: '2020-01-02T11:00:00.000Z',
        checkout_at: '2020-01-02T20:00:00.000Z',
      }),
    ]);

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornada).toBeNull();
  });

  it('check-in offline (só na fila) já é a jornada atual', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-offline',
      payload: {
        idCliente: 'checkin-offline',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: '2026-10-17T11:00:00.000Z',
        pedidoId: 12,
      },
    });

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.jornada).not.toBeNull());
    expect(result.current.jornada).toMatchObject({
      status: StatusJornada.EM_ANDAMENTO,
      pedidoId: 12,
    });
  });

  it('check-out pendente por cima de jornada aberta da réplica: a jornada passa a encerrada', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
    await criarAcaoPendente(database, {
      tipo: 'checkout',
      idCliente: 'checkout-offline',
      payload: {
        idCliente: 'checkout-offline',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: HA_1MIN,
      },
    });

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornada).toMatchObject({
      id: 502,
      status: StatusJornada.FINALIZADA,
      checkoutAt: HA_1MIN,
    });
  });

  it('sem dado local e com a sincronização falhando: erro fica true', async () => {
    const database = criarBancoDeTeste();
    atualizarStatusDaSincronizacao({ ultimoErro: 'sem_rede' });

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.jornada).toBeNull();
  });

  it('com dado local, a falha de sincronização não vira erro de tela', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
    atualizarStatusDaSincronizacao({ ultimoErro: 'sem_rede' });

    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe(false);
  });

  it('recarregar dispara uma sincronização (o pull do synchronize), não um GET de jornada', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/sync/pull');
  });

  it('recarregar com o pull ok traz a jornada para a tela', async () => {
    const database = criarBancoDeTeste();
    const { result } = await renderHook(() => useJornadaAtual(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const pull = {
      changes: {
        jornadas: {
          created: [],
          updated: [abertaNaReplica()],
          deleted: [],
        },
      },
      timestamp: Date.parse('2026-10-17T12:00:00.000Z'),
    };
    for (const tabela of ['banco_horas', 'pedidos', 'ambientes', 'pecas', 'tipos_avaria', 'avarias', 'atestados']) {
      (pull.changes as Record<string, unknown>)[tabela] = { created: [], updated: [], deleted: [] };
    }
    fetchMock.mockResolvedValue(respostaJson(200, pull));

    await act(async () => {
      await result.current.recarregar();
    });

    await waitFor(() => expect(result.current.jornada?.id).toBe(502));
  });
});
