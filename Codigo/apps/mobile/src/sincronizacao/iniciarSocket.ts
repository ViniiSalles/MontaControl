import type { Database } from '@nozbe/watermelondb';
import { io } from 'socket.io-client';
import { WS_EVENTS } from '@montacontrol/shared';
import { geracaoDaSessao, obterTokenValido } from '../auth/tokenSessao';
import { urlBaseApi } from '../config/api';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { sincronizar } from './syncManager';

/** Subconjunto do `Socket` do socket.io-client que este módulo usa; os testes injetam um falso. */
export interface SocketLike {
  readonly connected: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(evento: string, ouvinte: (...args: any[]) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(evento: string, ouvinte?: (...args: any[]) => void): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

export interface OpcoesSocket {
  path: string;
  autoConnect: boolean;
  transports: string[];
  /** Função (não objeto): o Socket.io a chama a cada (re)conexão, então o token vai sempre atual. */
  auth: (entregar: (dados: { token?: string }) => void) => void;
}

export type CriarSocket = (url: string, opcoes: OpcoesSocket) => SocketLike;

const criarSocketPadrao: CriarSocket = (url, opcoes) => io(url, opcoes) as unknown as SocketLike;

/**
 * Canal de tempo real do app autenticado. O socket é só um gatilho: não carrega
 * dado de domínio, apenas acorda `sincronizar`, que continua sendo o único
 * caminho de dados para o banco local.
 *
 * - Conecta só enquanto `online` (NetInfo, publicado no store); some a rede,
 *   desconecta, volta, reconecta — sem deixar o Socket.io tentando no escuro.
 * - `auth` é função: cada (re)conexão pede o token atual (renovado, se for o
 *   caso). Sem sessão, responde sem token; o servidor recusa com
 *   `connect_error` e o Socket.io faz o backoff por conta própria.
 * - `connect_error` NÃO é logout: pode ser falha transitória do servidor. A
 *   sessão só acaba pelo fluxo de refresh (`tokenSessao`), nunca por aqui.
 * - Ao conectar (inicial e reconexões) sincroniza, para recuperar o que
 *   chegou enquanto o socket estava fora.
 * - Evento de sessão antiga (logout/novo login depois do início) é ignorado.
 *
 * Devolve o cleanup: remove os ouvintes, solta o store e desconecta.
 */
export function iniciarSocket(
  database: Database,
  criarSocket: CriarSocket = criarSocketPadrao,
): () => void {
  const geracao = geracaoDaSessao();

  const socket = criarSocket(urlBaseApi, {
    path: '/socket.io',
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (entregar) => {
      obterTokenValido().then(
        (token) => entregar({ token }),
        // Sem sessão (`ErroSessaoExpirada`): segue sem token, o servidor recusa.
        () => entregar({}),
      );
    },
  });

  const sincronizarSeMesmaSessao = () => {
    if (geracaoDaSessao() !== geracao) return;
    // `sincronizar` já deduplica e publica o erro no store; aqui só evita rejeição solta.
    sincronizar(database).catch(() => undefined);
  };

  socket.on(WS_EVENTS.NOTIFICACAO_NOVA, sincronizarSeMesmaSessao);
  socket.on('connect', sincronizarSeMesmaSessao);

  const ajustarConexao = (online: boolean) => {
    if (online) socket.connect();
    else socket.disconnect();
  };

  if (useSincronizacaoStore.getState().online) socket.connect();

  const soltarStore = useSincronizacaoStore.subscribe((estado, anterior) => {
    if (estado.online !== anterior.online) ajustarConexao(estado.online);
  });

  return () => {
    soltarStore();
    socket.off(WS_EVENTS.NOTIFICACAO_NOVA, sincronizarSeMesmaSessao);
    socket.off('connect', sincronizarSeMesmaSessao);
    socket.disconnect();
  };
}
