import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WS_EVENTS, type NotificacaoDTO } from '@montacontrol/shared';
import type { Server, Socket } from 'socket.io';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { VerificadorTokenService } from '../auth/verificador-token.service';
import { EmissorNotificacao } from './notificacoes.emissor';

/** Única mensagem de recusa do handshake: nunca revela qual etapa falhou. */
const MENSAGEM_RECUSA = 'credenciais inválidas';

interface DadosSocket {
  user?: UsuarioAutenticado;
}

type SocketAutenticavel = Socket<never, never, never, DadosSocket>;

export function salaDoUsuario(usuarioId: number): string {
  return `usuario:${usuarioId}`;
}

/**
 * CORS do handshake a partir de `WS_CORS_ORIGENS` (lista separada por
 * vírgula). Lido a cada requisição, e não no decorator, porque o decorator é
 * avaliado na importação, antes de o `ConfigModule` carregar o `.env`.
 * Ausente: nenhuma origem de navegador liberada (o web em dev usa o proxy do
 * Vite; o mobile não envia `Origin`).
 */
export function resolverOrigemCors(
  origem: string | undefined,
  callback: (erro: Error | null, permitida?: string | boolean) => void,
): void {
  const permitidas = (process.env.WS_CORS_ORIGENS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  callback(null, origem !== undefined && permitidas.includes(origem) ? origem : false);
}

function extrairToken(socket: SocketAutenticavel): string | null {
  const doAuth: unknown = socket.handshake.auth?.token;
  if (typeof doAuth === 'string' && doAuth.length > 0) return doAuth;

  const cabecalho = socket.handshake.headers.authorization;
  if (cabecalho?.startsWith('Bearer ')) return cabecalho.slice('Bearer '.length) || null;
  return null;
}

/**
 * Canal só servidor → cliente (sem `@SubscribeMessage`). O handshake é
 * autenticado com o mesmo verificador do `SupabaseJwtGuard`; cada conexão
 * entra na sala `usuario:{id}` e recebe só as próprias notificações.
 */
@WebSocketGateway({ cors: { origin: resolverOrigemCors } })
export class NotificacoesGateway
  extends EmissorNotificacao
  implements OnGatewayInit<Server>, OnGatewayConnection<SocketAutenticavel>
{
  private readonly logger = new Logger(NotificacoesGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly verificador: VerificadorTokenService) {
    super();
  }

  afterInit(server: Server): void {
    server.use((socket, next) => this.autenticarHandshake(socket, next));
  }

  async handleConnection(client: SocketAutenticavel): Promise<void> {
    const usuario = client.data.user;
    // Defesa em profundidade: o middleware já recusa quem não autenticou.
    if (!usuario) {
      client.disconnect(true);
      return;
    }
    await client.join(salaDoUsuario(usuario.id));
  }

  /** Nunca lança: falha ao emitir para um destinatário não afeta os demais. */
  emitirParaUsuario(usuarioId: number, notificacao: NotificacaoDTO): void {
    try {
      this.server.to(salaDoUsuario(usuarioId)).emit(WS_EVENTS.NOTIFICACAO_NOVA, notificacao);
    } catch (erro) {
      this.logger.error(
        `Falha ao emitir notificação ${notificacao.id} ao usuário ${usuarioId}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  private async autenticarHandshake(
    socket: SocketAutenticavel,
    next: (erro?: Error) => void,
  ): Promise<void> {
    const token = extrairToken(socket);
    if (!token) {
      next(new Error(MENSAGEM_RECUSA));
      return;
    }

    let usuario: UsuarioAutenticado;
    try {
      usuario = await this.verificador.verificar(token);
    } catch (erro) {
      // Detalhe só no log do servidor; o cliente recebe a mensagem genérica.
      this.logger.warn(
        `Handshake recusado: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
      next(new Error(MENSAGEM_RECUSA));
      return;
    }

    socket.data.user = usuario;
    next();
  }
}
