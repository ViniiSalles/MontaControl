import type { PecaDTO, TriarPecaRequest } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

/** US07/UC09/UC10 — cadastra a peça via código de barras; a API agrupa por pedido e ambiente. */
export function triarPeca(token: string, dados: TriarPecaRequest): Promise<PecaDTO> {
  return requisitar<PecaDTO>('/api/pecas', { token, metodo: 'POST', corpo: dados })
}
