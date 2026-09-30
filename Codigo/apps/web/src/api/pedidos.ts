import type {
  CriarPedidoRequest,
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
