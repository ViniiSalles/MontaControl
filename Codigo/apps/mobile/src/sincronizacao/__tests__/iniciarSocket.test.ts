jest.mock('../syncManager');

import { WS_EVENTS } from '@montacontrol/shared';
import { definirTokens, geracaoDaSessao } from '../../auth/tokenSessao';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { iniciarSocket } from '../iniciarSocket';
import type { OpcoesSocket, SocketLike } from '../iniciarSocket';
import { sincronizar } from '../syncManager';

type Ouvinte = (...args: unknown[]) => void;

const proximoCiclo = () => new Promise<void>((resolver) => setImmediate(() => resolver()));

/** Socket falso que de fato registra/remove ouvintes e guarda o estado de conexão. */
interface SocketFalso extends SocketLike {
  connected: boolean;
  on: jest.Mock;
  off: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
}

function criarSocketFalso() {
  const ouvintes = new Map<string, Set<Ouvinte>>();
  const socket: SocketFalso = {
    connected: false,
    on: jest.fn((evento: string, ouvinte: Ouvinte) => {
      if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
      ouvintes.get(evento)!.add(ouvinte);
      return socket;
    }),
    off: jest.fn((evento: string, ouvinte?: Ouvinte) => {
      if (ouvinte) ouvintes.get(evento)?.delete(ouvinte);
      else ouvintes.delete(evento);
      return socket;
    }),
    connect: jest.fn(() => {
      socket.connected = true;
      return socket;
    }),
    disconnect: jest.fn(() => {
      socket.connected = false;
      return socket;
    }),
  };
  return {
    socket,
    /** Ouvintes vivos de um evento. */
    ouvintesDe: (evento: string) => ouvintes.get(evento)?.size ?? 0,
    emitir(evento: string, ...args: unknown[]) {
      [...(ouvintes.get(evento) ?? [])].forEach((ouvinte) => ouvinte(...args));
    },
  };
}

const sincronizarMock = jest.mocked(sincronizar);
const database = criarBancoDeTeste();

let falso: ReturnType<typeof criarSocketFalso>;
let criarSocket: jest.Mock<SocketLike, [string, OpcoesSocket]>;

function iniciar() {
  return iniciarSocket(database, criarSocket);
}

beforeEach(() => {
  jest.clearAllMocks();
  sincronizarMock.mockResolvedValue(undefined);
  falso = criarSocketFalso();
  criarSocket = jest.fn<SocketLike, [string, OpcoesSocket]>(() => falso.socket);
  useSincronizacaoStore.getState().reiniciar();
  definirTokens({ accessToken: 'token-1', refreshToken: 'refresh-1' });
});

describe('iniciarSocket', () => {
  it('não conecta offline e conecta ao ficar online', () => {
    useSincronizacaoStore.setState({ online: false });

    iniciar();
    expect(falso.socket.connect).not.toHaveBeenCalled();

    useSincronizacaoStore.setState({ online: true });
    expect(falso.socket.connect).toHaveBeenCalledTimes(1);

    useSincronizacaoStore.setState({ online: false });
    expect(falso.socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('conecta de imediato quando já começa online', () => {
    iniciar();

    expect(falso.socket.connect).toHaveBeenCalledTimes(1);
  });

  it('cria o socket sem conexão automática, no path padrão e com auth em função', async () => {
    iniciar();

    const [url, opcoes] = criarSocket.mock.calls[0];
    expect(typeof url).toBe('string');
    expect(opcoes).toMatchObject({ path: '/socket.io', autoConnect: false });
    expect(opcoes.transports).toEqual(['websocket', 'polling']);

    const cb = jest.fn();
    opcoes.auth(cb);
    await proximoCiclo();
    expect(cb).toHaveBeenCalledWith({ token: 'token-1' });
  });

  it('auth pede o token a cada chamada, para renovar a cada reconexão', async () => {
    iniciar();
    const { auth } = criarSocket.mock.calls[0][1];

    definirTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' });
    const cb = jest.fn();
    auth(cb);
    await proximoCiclo();

    expect(cb).toHaveBeenCalledWith({ token: 'token-2' });
  });

  it('auth sem sessão não estoura: responde sem token', async () => {
    iniciar();
    const { auth } = criarSocket.mock.calls[0][1];

    definirTokens(null);
    const cb = jest.fn();
    auth(cb);
    await proximoCiclo();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({});
  });

  it('notificacao:nova dispara sincronizar', () => {
    iniciar();

    falso.emitir(WS_EVENTS.NOTIFICACAO_NOVA, { id: 1 });

    expect(sincronizarMock).toHaveBeenCalledTimes(1);
    expect(sincronizarMock).toHaveBeenCalledWith(database);
  });

  it('reconexão dispara sincronizar', () => {
    iniciar();

    falso.emitir('connect');
    expect(sincronizarMock).toHaveBeenCalledTimes(1);

    falso.emitir('disconnect', 'transport close');
    falso.emitir('connect');
    expect(sincronizarMock).toHaveBeenCalledTimes(2);
    expect(sincronizarMock).toHaveBeenLastCalledWith(database);
  });

  it('connect_error não derruba nem desconecta: o backoff é do Socket.io', () => {
    iniciar();

    falso.emitir('connect_error', new Error('credenciais inválidas'));

    expect(falso.socket.disconnect).not.toHaveBeenCalled();
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it('cleanup desconecta', () => {
    const parar = iniciar();

    parar();

    expect(falso.socket.disconnect).toHaveBeenCalled();
    expect(falso.ouvintesDe(WS_EVENTS.NOTIFICACAO_NOVA)).toBe(0);
    expect(falso.ouvintesDe('connect')).toBe(0);

    // O store também foi desassinado: voltar a ficar online não reconecta.
    falso.socket.connect.mockClear();
    useSincronizacaoStore.setState({ online: false });
    useSincronizacaoStore.setState({ online: true });
    expect(falso.socket.connect).not.toHaveBeenCalled();
  });

  it('evento de sessão antiga é ignorado', () => {
    iniciar();
    const geracaoInicial = geracaoDaSessao();

    definirTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' });
    expect(geracaoDaSessao()).not.toBe(geracaoInicial);

    falso.emitir(WS_EVENTS.NOTIFICACAO_NOVA, { id: 1 });
    falso.emitir('connect');

    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it('erro de sincronizar não vira rejeição não tratada', async () => {
    sincronizarMock.mockRejectedValue(new Error('falhou'));
    iniciar();

    falso.emitir(WS_EVENTS.NOTIFICACAO_NOVA, { id: 1 });
    await proximoCiclo();

    expect(sincronizarMock).toHaveBeenCalledTimes(1);
  });
});
