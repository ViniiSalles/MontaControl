import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
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
import { useHistoricoPontos } from '../useHistoricoPontos';
import { AGORA_FIXO_MS, fixarRelogio, soltarRelogio } from './relogioFixo';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

// Turno de 8h encerrado há poucas horas — precisa cair dentro da janela de
// `janelaDoPeriodo` calculada a partir de "agora" (a leitura filtra pelo
// relógio, fixo em 14:00 de SP no teste, então a fixture é relativa a ele.
// Mesma base (`AGORA_MS`) pras duas pontas: `minutosDaJornada` descarta
// segundos.
const AGORA_MS = AGORA_FIXO_MS;
const CHECKOUT_HA_1H = new Date(AGORA_MS - 60 * 60 * 1000).toISOString();
const CHECKIN_HA_9H = new Date(AGORA_MS - 9 * 60 * 60 * 1000).toISOString();
const CHECKIN_HA_10_DIAS = new Date(AGORA_MS - 10 * 24 * 60 * 60 * 1000).toISOString();
const CHECKOUT_HA_10_DIAS = new Date(AGORA_MS - 10 * 24 * 60 * 60 * 1000 + 8 * 3600 * 1000).toISOString();

const turnoDeHoje = () => linhaDeJornada({ checkin_at: CHECKIN_HA_9H, checkout_at: CHECKOUT_HA_1H });

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

describe('useHistoricoPontos', () => {
  it('lê o histórico da réplica, sem ir à rede ao montar', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [turnoDeHoje()]);

    const { result } = await renderHook(() => useHistoricoPontos(5), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.totalMinutos).toBe(480);
    expect(result.current.dias).toHaveLength(1);
    expect(result.current.erro).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trocar o período muda a janela lida do banco local, sem nova chamada de rede', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [
      turnoDeHoje(),
      linhaDeJornada({ checkin_at: CHECKIN_HA_10_DIAS, checkout_at: CHECKOUT_HA_10_DIAS }),
    ]);

    const { result, rerender } = await renderHook(
      ({ periodo }: { periodo: 5 | 15 | 30 }) => useHistoricoPontos(periodo),
      { wrapper: comBanco(database), initialProps: { periodo: 5 } },
    );
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.dias).toHaveLength(1);
    expect(result.current.totalMinutos).toBe(480);

    await rerender({ periodo: 15 });

    await waitFor(() => expect(result.current.dias).toHaveLength(2));
    expect(result.current.totalMinutos).toBe(960);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ponto marcado offline (na fila) entra no histórico na hora', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [turnoDeHoje()]);
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-offline',
      payload: {
        idCliente: 'checkin-offline',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: new Date(AGORA_MS - 30 * 60 * 1000).toISOString(),
        pedidoId: 12,
      },
    });

    const { result } = await renderHook(() => useHistoricoPontos(5), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.dias[0]?.jornadas).toHaveLength(2));
    expect(result.current.dias[0].jornadas.some((j) => j.status === StatusJornada.EM_ANDAMENTO)).toBe(true);
  });

  it('sem dado local e com a sincronização falhando: erro fica true e dias fica vazio', async () => {
    const database = criarBancoDeTeste();
    atualizarStatusDaSincronizacao({ ultimoErro: 'sem_rede' });

    const { result } = await renderHook(() => useHistoricoPontos(15), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.dias).toEqual([]);
  });

  it('recarregar dispara uma sincronização (o pull do synchronize)', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { result } = await renderHook(() => useHistoricoPontos(15), {
      wrapper: comBanco(database),
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/sync/pull');
  });
});
