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
  /** `true` enquanto o Manager do Socket.io cuida da (re)conexão; `false` quando o socket foi destruído. */
  readonly active: boolean;
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

/** Primeira espera antes de retentar depois de uma recusa; dobra a cada recusa seguida. */
export const ATRASO_INICIAL_RETENTATIVA_MS = 2_000;
/** Teto do atraso: uma recusa persistente gera no máximo uma tentativa por minuto. */
export const ATRASO_MAXIMO_RETENTATIVA_MS = 60_000;

const criarSocketPadrao: CriarSocket = (url, opcoes) => io(url, opcoes) as unknown as SocketLike;

/**
 * Canal de tempo real do app autenticado. O socket é só um gatilho: não carrega
 * dado de domínio, apenas acorda `sincronizar`, que continua sendo o único
 * caminho de dados para o banco local.
 *
 * - Conecta só enquanto `online` (NetInfo, publicado no store); some a rede,
 *   desconecta, volta, reconecta — sem deixar o Socket.io tentando no escuro.
 * - `auth` é função: cada (re)conexão pede o token em memória. Sem sessão,
 *   responde sem token e o servidor recusa.
 * - Recusa do servidor (`connect_error` do handshake ou `io server
 *   disconnect`): o socket.io-client DESTRÓI o socket (`active` = false) e não
 *   reconecta sozinho — só falha de transporte tem backoff do Manager. A
 *   retentativa é daqui: espera com backoff (2 s dobrando até 60 s, de volta
 *   a 2 s após um `connect`), roda `sincronizar` — cujo 401 renova o token,
 *   porque `obterTokenValido` não confere validade — e então reconecta. Só
 *   enquanto online e na mesma sessão. NUNCA desloga: a sessão só acaba pelo
 *   fluxo de refresh (`tokenSessao`); uma recusa pode ser falha transitória.
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

  let ativo = true;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let atraso = ATRASO_INICIAL_RETENTATIVA_MS;

  const mesmaSessao = () => geracaoDaSessao() === geracao;
  const podeConectar = () =>
    ativo && mesmaSessao() && useSincronizacaoStore.getState().online;

  const cancelarRetentativa = () => {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
  };

  const sincronizarSeMesmaSessao = () => {
    if (!mesmaSessao()) return;
    // `sincronizar` já deduplica e publica o erro no store; aqui só evita rejeição solta.
    sincronizar(database).catch(() => undefined);
  };

  const aoConectar = () => {
    cancelarRetentativa();
    atraso = ATRASO_INICIAL_RETENTATIVA_MS;
    sincronizarSeMesmaSessao();
  };

  const agendarRetentativa = () => {
    // `active`: o Manager ainda está tentando (falha de transporte) — não duplicar.
    if (socket.active || temporizador !== null || !podeConectar()) return;
    const espera = atraso;
    atraso = Math.min(atraso * 2, ATRASO_MAXIMO_RETENTATIVA_MS);
    temporizador = setTimeout(() => {
      temporizador = null;
      // O 401 do pull renova o token que o próximo `auth` vai ler; falha aqui não impede a tentativa.
      sincronizar(database)
        .catch(() => undefined)
        .then(() => {
          if (podeConectar() && !socket.active) socket.connect();
        });
    }, espera);
  };

  const aoDesconectar = (motivo: string) => {
    if (motivo === 'io server disconnect') agendarRetentativa();
  };

  socket.on(WS_EVENTS.NOTIFICACAO_NOVA, sincronizarSeMesmaSessao);
  socket.on('connect', aoConectar);
  socket.on('connect_error', agendarRetentativa);
  socket.on('disconnect', aoDesconectar);

  if (useSincronizacaoStore.getState().online) socket.connect();

  const soltarStore = useSincronizacaoStore.subscribe((estado, anterior) => {
    if (estado.online === anterior.online) return;
    cancelarRetentativa();
    if (estado.online) {
      atraso = ATRASO_INICIAL_RETENTATIVA_MS;
      socket.connect();
    } else {
      socket.disconnect();
    }
  });

  return () => {
    ativo = false;
    cancelarRetentativa();
    soltarStore();
    socket.off(WS_EVENTS.NOTIFICACAO_NOVA, sincronizarSeMesmaSessao);
    socket.off('connect', aoConectar);
    socket.off('connect_error', agendarRetentativa);
    socket.off('disconnect', aoDesconectar);
    socket.disconnect();
  };
}
