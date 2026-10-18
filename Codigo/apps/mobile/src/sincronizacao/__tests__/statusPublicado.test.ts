import { syncPullFixture } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { iniciarSincronizacao, sincronizar } from '../syncManager';
import { instalarGatilhosFalsos } from './gatilhosFalsos';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();
const passarUmTick = () => new Promise<void>((resolver) => setImmediate(() => resolver()));
const estado = () => useSincronizacaoStore.getState();

let gatilhos: ReturnType<typeof instalarGatilhosFalsos>;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  gatilhos = instalarGatilhosFalsos();
  useSincronizacaoStore.getState().reiniciar();
});

describe('status publicado no store pelo syncManager', () => {
  it('sincronizar publica sincronizando durante a rodada e a hora do fim no sucesso', async () => {
    const database = criarBancoDeTeste();
    let liberar: () => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolver) => {
          liberar = () => resolver(respostaJson(200, syncPullFixture));
        }),
    );

    const rodada = sincronizar(database);
    await passarUmTick();
    expect(estado().sincronizando).toBe(true);
    expect(estado().ultimaSincronizacaoEm).toBeNull();

    liberar();
    await rodada;

    expect(estado().sincronizando).toBe(false);
    expect(estado().ultimoErro).toBeNull();
    expect(estado().ultimaSincronizacaoEm).not.toBeNull();
  });

  it('falha de rede publica o erro e mantém a hora da última sincronização boa', async () => {
    const database = criarBancoDeTeste();
    await sincronizar(database);
    const anterior = estado().ultimaSincronizacaoEm;
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await sincronizar(database);

    expect(estado().ultimoErro).toBe('sem_rede');
    expect(estado().ultimaSincronizacaoEm).toBe(anterior);
  });

  it('o evento de rede publica online/offline e a volta da conexão dispara a sincronização', async () => {
    const database = criarBancoDeTeste();
    const parar = iniciarSincronizacao(database);
    await passarUmTick();
    fetchMock.mockClear();

    gatilhos.emitirRede(false);
    expect(estado().online).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    gatilhos.emitirRede(true);
    expect(estado().online).toBe(true);
    await passarUmTick();
    expect(fetchMock).toHaveBeenCalled();

    parar();
  });

  it('conectado sem internet alcançável conta como offline', () => {
    const database = criarBancoDeTeste();
    const parar = iniciarSincronizacao(database);

    gatilhos.rede.forEach((ouvinte) =>
      ouvinte({ isConnected: true, isInternetReachable: false } as never),
    );

    expect(estado().online).toBe(false);
    parar();
  });

  it('parar a sincronização (logout) devolve o status ao inicial', async () => {
    const database = criarBancoDeTeste();
    const parar = iniciarSincronizacao(database);
    await passarUmTick();
    await sincronizar(database);
    gatilhos.emitirRede(false);
    useSincronizacaoStore.setState({ ultimoErro: 'falha', pendentes: 3 });
    expect(estado().ultimaSincronizacaoEm).not.toBeNull();

    parar();

    expect(estado()).toMatchObject({
      online: true,
      sincronizando: false,
      pendentes: 0,
      ultimaSincronizacaoEm: null,
      ultimoErro: null,
      avisosDescartados: [],
    });
  });
});
