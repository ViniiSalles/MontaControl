import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/** Espelho local de `JornadaDTO` — hoje + histórico de 5 dias (issue #18). */
export class Jornada extends Model {
  static table = 'jornadas';

  @field('remote_id') remoteId!: number | null;
  @field('usuario_id') usuarioId!: number;
  @text('status') status!: string;
  @text('checkin_at') checkinAt!: string | null;
  @field('checkin_latitude') checkinLatitude!: number | null;
  @field('checkin_longitude') checkinLongitude!: number | null;
  @text('checkin_endereco') checkinEndereco!: string | null;
  @text('checkout_at') checkoutAt!: string | null;
  @field('checkout_latitude') checkoutLatitude!: number | null;
  @field('checkout_longitude') checkoutLongitude!: number | null;
  @text('checkout_endereco') checkoutEndereco!: string | null;
  @field('lancado_em_atraso') lancadoEmAtraso!: boolean;
  @text('criado_em') criadoEm!: string;
  @text('id_cliente_checkin') idClienteCheckin!: string | null;
  @text('id_cliente_checkout') idClienteCheckout!: string | null;
}
