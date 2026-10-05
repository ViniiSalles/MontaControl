import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

/** Outbox — check-in/check-out/ponto-em-atraso/avaria ainda não confirmados pelo servidor. */
export class AcaoPendente extends Model {
  static table = 'acoes_pendentes';

  @text('tipo') tipo!: string;
  @text('id_cliente') idCliente!: string;
  @text('payload') payload!: string;
  @text('criado_em') criadoEm!: string;
  @text('status') status!: string;
  @text('mensagem_descarte') mensagemDescarte!: string | null;
}
