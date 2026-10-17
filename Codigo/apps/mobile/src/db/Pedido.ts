import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/** Réplica de `SyncPedidoRow` — pedido atribuído ao montador, com o cliente (local da obra) desnormalizado. */
export class Pedido extends Model {
  static table = 'pedidos';

  @text('numero_pedido') numeroPedido!: string;
  @text('status') status!: string;
  @text('cliente_id') clienteId!: string;
  @text('cliente_nome') clienteNome!: string;
  @text('cliente_endereco') clienteEndereco!: string;
  @text('cliente_cidade') clienteCidade!: string;
  @text('cliente_estado') clienteEstado!: string;
  @field('cliente_latitude') clienteLatitude!: number;
  @field('cliente_longitude') clienteLongitude!: number;
}
