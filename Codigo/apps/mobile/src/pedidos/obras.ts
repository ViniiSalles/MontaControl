import type { Database, Query } from '@nozbe/watermelondb';
import type { PedidoDoMontadorDTO } from '@montacontrol/shared';
import { Pedido } from '../db/Pedido';

/** O que o ponto precisa da obra: o pedido e onde fica o cliente (centro do raio de tolerância). */
export type ObraDoPonto = Pick<PedidoDoMontadorDTO, 'id' | 'numeroPedido' | 'cliente'>;

/**
 * Colunas do pedido que mudam in-place num `synchronize()` (pedido ou cliente
 * alterado no servidor) e precisam reemitir a consulta.
 */
export const COLUNAS_OBSERVADAS_DE_PEDIDO = [
  'numero_pedido',
  'cliente_nome',
  'cliente_endereco',
  'cliente_cidade',
  'cliente_estado',
  'cliente_latitude',
  'cliente_longitude',
];

export function queryPedidos(database: Database): Query<Pedido> {
  return database.get<Pedido>('pedidos').query();
}

/** Linha da réplica → obra do ponto. O id local é o do servidor (string numérica); a API de check-in pede número. */
export function paraObraDoPonto(pedido: Pedido): ObraDoPonto {
  return {
    id: Number(pedido.id),
    numeroPedido: pedido.numeroPedido,
    cliente: {
      nome: pedido.clienteNome,
      endereco: pedido.clienteEndereco,
      cidade: pedido.clienteCidade,
      estado: pedido.clienteEstado,
      latitude: pedido.clienteLatitude,
      longitude: pedido.clienteLongitude,
    },
  };
}
