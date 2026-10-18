import { getLastPulledAt } from '@nozbe/watermelondb/sync/impl';
import { syncPullFixture } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { iniciarSincronizacao, sincronizar } from '../syncManager';
import { reiniciarStatusDaSincronizacao } from '../statusDaSincronizacao';
import { instalarGatilhosFalsos } from './gatilhosFalsos';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

/** Cada chamada ao pull fica pendurada até o teste liberá-la. */
function pullsPendurados() {
  const liberar: Array<() => void> = [];
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolver) => {
        liberar.push(() => resolver(respostaJson(200, syncPullFixture)));
      }),
  );
  return liberar;
}

const passarUmTick = () => new Promise<void>((resolver) => setImmediate(() => resolver()));

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  reiniciarStatusDaSincronizacao();
});

describe('sincronizar — gatilho com uma sincronização em curso', () => {
  it('não perde o gatilho: repete uma vez quando a rodada em curso termina', async () => {
    const database = criarBancoDeTeste();
    const liberar = pullsPendurados();

    const primeira = sincronizar(database);
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Três gatilhos durante a rodada viram UMA repetição.
    const segunda = sincronizar(database);
    const terceira = sincronizar(database);
    const quarta = sincronizar(database);
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(1); // nada em paralelo

    liberar[0]();
    await passarUmTick();
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    liberar[1]();
    await Promise.all([primeira, segunda, terceira, quarta]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // A repetição enxergou o `lastPulledAt` gravado pela primeira.
    expect(String(fetchMock.mock.calls[1][0])).toContain(`lastPulledAt=${syncPullFixture.timestamp}`);
  });

  it('com a rodada terminada, o gatilho seguinte começa uma nova (a guarda não fica presa)', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));

    await sincronizar(database);
    await sincronizar(database);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rodada de uma sessão que já acabou não segura a do usuário que entrou', async () => {
    const database = criarBancoDeTeste();
    const liberar = pullsPendurados();

    const doUsuarioA = sincronizar(database);
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Sai A, entra B — e a requisição de A continua pendurada na rede.
    definirTokens({ accessToken: 'token-de-B', refreshToken: 'refresh-de-B' });
    const doUsuarioB = sincronizar(database);
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-de-B');

    liberar[0](); // resposta de A: descartada
    await doUsuarioA;
    expect(await getLastPulledAt(database)).toBeNull();
    expect(await database.get('pedidos').query().fetchCount()).toBe(0);

    liberar[1](); // resposta de B: gravada
    await doUsuarioB;
    expect(await getLastPulledAt(database)).toBe(syncPullFixture.timestamp);
    expect(await database.get('pedidos').query().fetchCount()).toBe(1);
  });
});

describe('iniciarSincronizacao', () => {
  it('sincroniza no boot e a cada gatilho (rede, primeiro plano); a limpeza desliga os ouvintes', async () => {
    const gatilhos = instalarGatilhosFalsos();
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));

    const parar = iniciarSincronizacao(database);
    await passarUmTick();
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    gatilhos.emitirRede(true);
    await passarUmTick();
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    gatilhos.emitirAppState('active');
    await passarUmTick();
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    parar();
    expect(gatilhos.rede.size).toBe(0);
    expect(gatilhos.appState.size).toBe(0);
  });

  it('logout com um gatilho ainda a repetir: a repetição é descartada', async () => {
    const gatilhos = instalarGatilhosFalsos();
    const database = criarBancoDeTeste();
    const liberar = pullsPendurados();

    const parar = iniciarSincronizacao(database);
    await passarUmTick();
    gatilhos.emitirRede(true); // chega com a rodada em curso: marca para repetir
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    parar(); // logout
    liberar[0]();
    await passarUmTick();
    await passarUmTick();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
