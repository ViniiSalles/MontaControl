import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

/** Réplica de `SyncAmbienteRow`. */
export class Ambiente extends Model {
  static table = 'ambientes';

  @text('pedido_id') pedidoId!: string;
  @text('nome') nome!: string;
  @text('status') status!: string;
}
