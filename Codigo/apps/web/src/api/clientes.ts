import type { ClienteResumoDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarClientes(token: string, busca?: string): Promise<ClienteResumoDTO[]> {
  const parametros = busca ? `?busca=${encodeURIComponent(busca)}` : ''
  return requisitar<ClienteResumoDTO[]>(`/api/clientes${parametros}`, { token })
}
