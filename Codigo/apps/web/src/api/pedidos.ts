import type {
  CriarPedidoRequest,
  PedidoComAmbientesDTO,
  PedidoDTO,
  PedidoResumoDTO,
  StatusPedido,
} from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarPedidos(token: string, status?: StatusPedido): Promise<PedidoResumoDTO[]> {
  const parametros = status ? `?status=${status}` : ''
  return requisitar<PedidoResumoDTO[]>(`/api/pedidos${parametros}`, { token })
}

export function criarPedido(token: string, dados: CriarPedidoRequest): Promise<PedidoDTO> {
  return requisitar<PedidoDTO>('/api/pedidos', { token, metodo: 'POST', corpo: dados })
}

/** N7T3 — peças do pedido organizadas por ambiente, para conferência antes do despacho. */
export function buscarPedidoComAmbientes(
  token: string,
  numeroPedido: string,
): Promise<PedidoComAmbientesDTO> {
  return requisitar<PedidoComAmbientesDTO>(`/api/pedidos/${encodeURIComponent(numeroPedido)}`, {
    token,
  })
}
