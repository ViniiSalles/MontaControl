import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/**
 * Réplica local de `SyncJornadaRow` (contrato de pull de `@montacontrol/shared`).
 * Só o `synchronize()` escreve aqui: o que o montador marcou e o servidor
 * ainda não confirmou fica em `acoes_pendentes` e é sobreposto na leitura
 * (`jornada/jornadasComPendentes`).
 */
export class Jornada extends Model {
  static table = 'jornadas';

  @field('usuario_id') usuarioId!: number;
  /** Obra do check-in (id do servidor); nula em jornada antiga ou em ponto em atraso. */
  @text('pedido_id') pedidoId!: string | null;
  @text('status') status!: string;
  @text('checkin_at') checkinAt!: string | null;
  @field('checkin_latitude') checkinLatitude!: number | null;
  @field('checkin_longitude') checkinLongitude!: number | null;
  @text('checkin_endereco') checkinEndereco!: string | null;
  /** UUID do aparelho que casa a jornada do servidor com a ação da fila (contrato do pull). */
  @text('checkin_id_cliente') checkinIdCliente!: string | null;
  @text('checkout_at') checkoutAt!: string | null;
  @field('checkout_latitude') checkoutLatitude!: number | null;
  @field('checkout_longitude') checkoutLongitude!: number | null;
  @text('checkout_endereco') checkoutEndereco!: string | null;
  @text('checkout_id_cliente') checkoutIdCliente!: string | null;
  @field('lancado_em_atraso') lancadoEmAtraso!: boolean;
  @text('criado_em') criadoEm!: string;
}
