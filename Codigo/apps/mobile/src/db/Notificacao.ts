import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { ReferenciaNotificacao, TipoNotificacao } from '@montacontrol/shared';

/**
 * Réplica de `SyncNotificacaoRow` — notificações do montador logado (as mesmas
 * que chegam pelo WebSocket). O id local é o do servidor, como string;
 * `referenciaId` também é string (convenção dos ids do contrato). `lida` muda
 * no lugar quando o pull traz a notificação já lida.
 */
export class Notificacao extends Model {
  static table = 'notificacoes';

  @text('tipo') tipo!: TipoNotificacao;
  @text('titulo') titulo!: string;
  @text('mensagem') mensagem!: string;
  @text('referencia_tipo') referenciaTipo!: ReferenciaNotificacao | null;
  @text('referencia_id') referenciaId!: string | null;
  @field('lida') lida!: boolean;
  @text('criada_em') criadaEm!: string;
}
