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
  active: boolean;
  on: jest.Mock;
  off: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
}

function criarSocketFalso() {
  const ouvintes = new Map<string, Set<Ouvinte>>();
  const socket: SocketFalso = {
    connected: false,
    active: false,
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
      socket.active = true;
      return socket;
    }),
    disconnect: jest.fn(() => {
      socket.connected = false;
      socket.active = false;
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

    // Ao conectar de fato, recupera o que passou enquanto estava offline.
    falso.emitir('connect');
    expect(sincronizarMock).toHaveBeenCalledTimes(1);
    expect(sincronizarMock).toHaveBeenCalledWith(database);

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

  describe('quando o servidor recusa a conexão', () => {
    // Recusa no handshake (connect_error do middleware) ou 'io server disconnect':
    // o socket.io-client destrói o socket (`active` vira false) e NÃO reconecta
    // sozinho — a retentativa é nossa. Falha de transporte, ao contrário, o
    // Manager retenta (`active` continua true) e não deve ser duplicada.
    const recusar = () => {
      falso.socket.connected = false;
      falso.socket.active = false;
      falso.emitir('connect_error', new Error('credenciais inválidas'));
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('connect_error agenda nova tentativa com backoff limitado', async () => {
      iniciar();
      falso.socket.connect.mockClear();

      // Nunca desloga: só sincroniza (o que renova o token no 401) e reconecta.
      recusar();
      expect(falso.socket.connect).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1999);
      expect(falso.socket.connect).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(falso.socket.connect).toHaveBeenCalledTimes(1);
      expect(sincronizarMock).toHaveBeenCalledWith(database);

      // O atraso dobra a cada recusa seguida...
      recusar();
      await jest.advanceTimersByTimeAsync(3999);
      expect(falso.socket.connect).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(falso.socket.connect).toHaveBeenCalledTimes(2);

      // ...até o teto de 60 s, sem crescer além dele.
      for (let i = 0; i < 8; i += 1) {
        recusar();
        await jest.advanceTimersByTimeAsync(60_000);
      }
      const antes = falso.socket.connect.mock.calls.length;
      recusar();
      await jest.advanceTimersByTimeAsync(59_999);
      expect(falso.socket.connect).toHaveBeenCalledTimes(antes);
      await jest.advanceTimersByTimeAsync(1);
      expect(falso.socket.connect).toHaveBeenCalledTimes(antes + 1);

      expect(falso.socket.disconnect).not.toHaveBeenCalled();
    });

    it('um connect bem-sucedido volta o atraso ao inicial', async () => {
      iniciar();
      recusar();
      await jest.advanceTimersByTimeAsync(2000);
      recusar();
      await jest.advanceTimersByTimeAsync(4000);

      falso.emitir('connect');
      falso.socket.connect.mockClear();
      recusar();
      await jest.advanceTimersByTimeAsync(2000);

      expect(falso.socket.connect).toHaveBeenCalledTimes(1);
    });

    it("'io server disconnect' também agenda nova tentativa", async () => {
      iniciar();
      falso.socket.connect.mockClear();
      falso.socket.active = false;

      falso.emitir('disconnect', 'io server disconnect');
      await jest.advanceTimersByTimeAsync(2000);

      expect(falso.socket.connect).toHaveBeenCalledTimes(1);
    });

    it('falha de transporte (socket ainda ativo) fica com o backoff do Socket.io', async () => {
      iniciar();
      falso.socket.connect.mockClear();

      falso.emitir('connect_error', new Error('websocket error'));
      falso.emitir('disconnect', 'transport close');
      await jest.advanceTimersByTimeAsync(120_000);

      expect(falso.socket.connect).not.toHaveBeenCalled();
      expect(falso.socket.disconnect).not.toHaveBeenCalled();
    });

    it('retentativa é cancelada no cleanup e ao ficar offline', async () => {
      const parar = iniciar();
      falso.socket.connect.mockClear();

      recusar();
      parar();
      await jest.advanceTimersByTimeAsync(120_000);
      expect(falso.socket.connect).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);

      // Offline: a retentativa pendente some; ao voltar, quem conecta é o store.
      const outro = criarSocketFalso();
      criarSocket.mockReturnValue(outro.socket);
      iniciar();
      outro.socket.connect.mockClear();
      outro.socket.active = false;
      outro.emitir('connect_error', new Error('credenciais inválidas'));
      useSincronizacaoStore.setState({ online: false });
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(120_000);
      expect(outro.socket.connect).not.toHaveBeenCalled();
    });

    it('não retenta para sessão antiga', async () => {
      iniciar();
      falso.socket.connect.mockClear();

      recusar();
      definirTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' });
      await jest.advanceTimersByTimeAsync(120_000);

      expect(falso.socket.connect).not.toHaveBeenCalled();
    });

    it('não retenta se a sessão trocar durante a sincronização que precede a tentativa', async () => {
      let liberar!: () => void;
      sincronizarMock.mockReturnValue(new Promise<void>((resolver) => (liberar = resolver)));
      iniciar();
      falso.socket.connect.mockClear();

      recusar();
      await jest.advanceTimersByTimeAsync(2000);
      definirTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' });
      liberar();
      await jest.advanceTimersByTimeAsync(0);

      expect(falso.socket.connect).not.toHaveBeenCalled();
    });

    it('falha da sincronização que precede a tentativa não impede a reconexão', async () => {
      sincronizarMock.mockRejectedValue(new Error('sem rede'));
      iniciar();
      falso.socket.connect.mockClear();

      recusar();
      await jest.advanceTimersByTimeAsync(2000);

      expect(falso.socket.connect).toHaveBeenCalledTimes(1);
    });
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
