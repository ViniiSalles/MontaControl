import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

/**
 * Réplica de `SyncAvariaRow` — avarias registradas pelo montador logado.
 * `pecaDescricao`, `ambienteNome` e `numeroPedido` são rótulos snapshot: a
 * peça pode sair da réplica, a avaria permanece (sem join).
 */
export class Avaria extends Model {
  static table = 'avarias';

  @text('id_cliente') idCliente!: string | null;
  @text('peca_id') pecaId!: string;
  @text('peca_descricao') pecaDescricao!: string;
  @text('ambiente_nome') ambienteNome!: string;
  @text('numero_pedido') numeroPedido!: string;
  @text('tipo_avaria_id') tipoAvariaId!: string;
  @text('descricao') descricao!: string;
  @text('status') status!: string;
  @text('analisada_em') analisadaEm!: string | null;
  @text('parecer') parecer!: string | null;
  @text('criado_em') criadoEm!: string;
}
