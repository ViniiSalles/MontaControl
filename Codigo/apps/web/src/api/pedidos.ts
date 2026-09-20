import type { PedidoComAmbientesDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

/** N7T3 — peças do pedido organizadas por ambiente, para conferência antes do despacho. */
export function buscarPedidoComAmbientes(
  token: string,
  numeroPedido: string,
): Promise<PedidoComAmbientesDTO> {
  return requisitar<PedidoComAmbientesDTO>(`/api/pedidos/${encodeURIComponent(numeroPedido)}`, {
    token,
  })
}
