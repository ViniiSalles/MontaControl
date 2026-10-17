import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/** Réplica de `SyncPecaRow` — `codigoBarras` é nulo enquanto a peça está PENDENTE. */
export class Peca extends Model {
  static table = 'pecas';

  @text('ambiente_id') ambienteId!: string;
  @text('codigo_barras') codigoBarras!: string | null;
  @text('descricao') descricao!: string;
  @field('quantidade') quantidade!: number;
  @text('status') status!: string;
}
