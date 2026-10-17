import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

/** Réplica de `SyncAtestadoRow` — datas civis em `YYYY-MM-DD`; a análise do RH chega por atualização da linha. */
export class Atestado extends Model {
  static table = 'atestados';

  @text('id_cliente') idCliente!: string;
  @text('data_inicio') dataInicio!: string;
  @text('data_fim') dataFim!: string;
  @text('observacao') observacao!: string | null;
  @text('status') status!: string;
  @text('motivo_rejeicao') motivoRejeicao!: string | null;
  @text('validado_em') validadoEm!: string | null;
  @text('criado_em') criadoEm!: string;
}
