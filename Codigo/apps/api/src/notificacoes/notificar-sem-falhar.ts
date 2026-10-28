import type { Logger } from '@nestjs/common';
import type { EntradaNotificacao, NotificacoesService } from './notificacoes.service';

/**
 * Dispara a notificação sem nunca deixar o aviso derrubar a operação de
 * negócio que o originou. `NotificacoesService.notificar` já não lança, mas
 * quem chama não deve depender disso: uma rejeição aqui só vira log.
 */
export async function notificarSemFalhar(
  notificacoes: NotificacoesService,
  entrada: EntradaNotificacao,
  logger: Logger,
): Promise<void> {
  try {
    await notificacoes.notificar(entrada);
  } catch (erro) {
    logger.error(
      `Falha ao notificar (${entrada.chaveOrigem})`,
      erro instanceof Error ? erro.stack : String(erro),
    );
  }
}
