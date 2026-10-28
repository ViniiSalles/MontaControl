import type { NotificacaoDTO } from '@montacontrol/shared';

/**
 * Porta de saída para empurrar notificações em tempo real. O gateway
 * WebSocket a implementa; o service depende só desta abstração.
 */
export abstract class EmissorNotificacao {
  abstract emitirParaUsuario(usuarioId: number, notificacao: NotificacaoDTO): void;
}
