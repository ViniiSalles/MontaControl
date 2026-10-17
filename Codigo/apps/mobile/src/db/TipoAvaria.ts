import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

/** Réplica de `SyncTipoAvariaRow` — catálogo global, igual para todos os montadores. */
export class TipoAvaria extends Model {
  static table = 'tipos_avaria';

  @text('nome') nome!: string;
  @text('descricao') descricao!: string;
}
