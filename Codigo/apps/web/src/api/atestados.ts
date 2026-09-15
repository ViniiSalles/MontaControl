import type { AtestadoDTO, AtestadoDetalhadoDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarAtestadosPendentes(token: string): Promise<AtestadoDTO[]> {
  return requisitar<AtestadoDTO[]>('/api/atestados/pendentes', { token })
}

/** GET /atestados/historico — tudo que já saiu de PENDENTE, mais recente primeiro. */
export function listarHistoricoAtestados(token: string): Promise<AtestadoDTO[]> {
  return requisitar<AtestadoDTO[]>('/api/atestados/historico', { token })
}

export function detalharAtestado(token: string, id: number): Promise<AtestadoDetalhadoDTO> {
  return requisitar<AtestadoDetalhadoDTO>(`/api/atestados/${id}`, { token })
}

export function validarAtestado(token: string, id: number): Promise<AtestadoDTO> {
  return requisitar<AtestadoDTO>(`/api/atestados/${id}/validar`, { token, metodo: 'PATCH' })
}

export function rejeitarAtestado(
  token: string,
  id: number,
  motivo: string,
): Promise<AtestadoDTO> {
  return requisitar<AtestadoDTO>(`/api/atestados/${id}/rejeitar`, {
    token,
    metodo: 'PATCH',
    corpo: { motivo },
  })
}
