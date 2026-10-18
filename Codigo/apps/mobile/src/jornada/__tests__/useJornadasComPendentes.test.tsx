import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada, syncPullFixture } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  linhaDeJornada,
} from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { AcaoPendente } from '../../db/AcaoPendente';
import { executarSincronizacao } from '../../sincronizacao/syncManager';
import { useJornadasComPendentes } from '../useJornadasComPendentes';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

const ID_CLIENTE_CHECKIN_502 = '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a03';
const PAYLOAD_CHECKIN_502 = {
  idCliente: ID_CLIENTE_CHECKIN_502,
  latitude: -19.9191002,
  longitude: -43.9386399,
  registradoEm: '2026-10-16T11:00:03.000Z',
  pedidoId: 12,
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
});

describe('useJornadasComPendentes', () => {
  it('lê só a réplica e não vai à rede sozinho', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [linhaDeJornada({ id: '501' })]);

    const { result } = await renderHook(() => useJornadasComPendentes(), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornadas.map((j) => j.id)).toEqual([501]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('check-in offline aparece assim que entra na fila; depois do envio e do pull há UMA jornada', async () => {
    const database = criarBancoDeTeste();
    const { result } = await renderHook(() => useJornadasComPendentes(), {
      wrapper: comBanco(database),
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornadas).toHaveLength(0);

    await act(async () => {
      await criarAcaoPendente(database, {
        tipo: 'checkin',
        idCliente: ID_CLIENTE_CHECKIN_502,
        payload: PAYLOAD_CHECKIN_502,
      });
    });

    await waitFor(() => expect(result.current.jornadas).toHaveLength(1));
    expect(result.current.jornadas[0]).toMatchObject({
      status: StatusJornada.EM_ANDAMENTO,
      pedidoId: 12,
    });
    expect(result.current.jornadas[0].id).toBeLessThan(0);

    // Fila enviada + pull: a ação sai da fila e a jornada passa a ser a da réplica.
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/jornadas/checkin')
        ? respostaJson(201, { id: 502 })
        : respostaJson(200, syncPullFixture),
    );
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(() =>
      expect(
        result.current.jornadas.filter((j) => j.checkinIdCliente === ID_CLIENTE_CHECKIN_502),
      ).toHaveLength(1),
    );
    expect(
      result.current.jornadas.find((j) => j.checkinIdCliente === ID_CLIENTE_CHECKIN_502)!.id,
    ).toBe(502);
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(0);
  });

  it('um update do servidor numa jornada que já estava na réplica chega à tela (check-out)', async () => {
    const database = criarBancoDeTeste();
    // Primeiro pull de verdade: traz a 502 aberta e as demais do fixture.
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));
    const { result } = await renderHook(() => useJornadasComPendentes(), {
      wrapper: comBanco(database),
    });
    await act(async () => {
      await executarSincronizacao(database);
    });
    await waitFor(() => expect(result.current.jornadas.find((j) => j.id === 502)).toBeDefined());
    expect(result.current.jornadas.find((j) => j.id === 502)!.status).toBe(
      StatusJornada.EM_ANDAMENTO,
    );

    const fechada = {
      ...syncPullFixture.changes.jornadas.updated.find((j) => j.id === '502')!,
      status: StatusJornada.FINALIZADA,
      checkout_at: '2026-10-16T20:00:00.000Z',
      checkout_id_cliente: 'checkout-502',
    };
    const incremental = JSON.parse(JSON.stringify(syncPullFixture));
    incremental.changes.jornadas.updated = [fechada];
    incremental.timestamp = syncPullFixture.timestamp + 1000;
    fetchMock.mockResolvedValue(respostaJson(200, incremental));
    await act(async () => {
      await executarSincronizacao(database);
    });

    await waitFor(() =>
      expect(result.current.jornadas.find((j) => j.id === 502)!.status).toBe(
        StatusJornada.FINALIZADA,
      ),
    );
    expect(result.current.jornadas.find((j) => j.id === 502)!.checkoutAt).toBe(
      '2026-10-16T20:00:00.000Z',
    );
  });

  it('ação descartada pelo servidor sai da tela', async () => {
    const database = criarBancoDeTeste();
    const acao = await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-x',
      payload: { ...PAYLOAD_CHECKIN_502, idCliente: 'checkin-x' },
    });
    const { result } = await renderHook(() => useJornadasComPendentes(), {
      wrapper: comBanco(database),
    });
    await waitFor(() => expect(result.current.jornadas).toHaveLength(1));

    await act(async () => {
      await database.write(() =>
        acao.update((registro) => {
          registro.status = 'descartada';
        }),
      );
    });

    await waitFor(() => expect(result.current.jornadas).toHaveLength(0));
  });
});
