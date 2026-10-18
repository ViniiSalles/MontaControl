import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

/**
 * Ciclo de uma ação na fila:
 * - `pendente`: ainda não confirmada pelo servidor (é a única que a drenagem
 *   envia e a que o selo "aguardando envio" conta);
 * - `enviada`: check-in/check-out, avaria ou atestado que o servidor aceitou,
 *   mas cujo registro o pull ainda não trouxe para a réplica — fica na
 *   sobreposição para a tela não perdê-lo no intervalo; o `synchronize()`
 *   bem-sucedido a apaga;
 * - `descartada`: recusada pelo servidor (a tela avisa e a linha é apagada).
 */
export type StatusAcao = 'pendente' | 'enviada' | 'descartada';

/** Outbox — check-in/check-out/ponto-em-atraso/avaria/atestado ainda não confirmados pelo servidor. */
export class AcaoPendente extends Model {
  static table = 'acoes_pendentes';

  @text('tipo') tipo!: string;
  @text('id_cliente') idCliente!: string;
  @text('payload') payload!: string;
  @text('criado_em') criadoEm!: string;
  @text('status') status!: string;
  @text('mensagem_descarte') mensagemDescarte!: string | null;
}
