import type {
  AvariaDTO,
  AvariaDetalhadaDTO,
  ReportarAvariaRequest,
  StatusAvaria,
  TipoAvariaDTO,
} from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

/** Fila do gestor — todas as avarias, mais recente primeiro. O filtro é feito na tela. */
export function listarAvarias(token: string): Promise<AvariaDTO[]> {
  return requisitar<AvariaDTO[]>('/api/avarias', { token })
}

export function detalharAvaria(token: string, id: number): Promise<AvariaDetalhadaDTO> {
  return requisitar<AvariaDetalhadaDTO>(`/api/avarias/${id}`, { token })
}

export function atualizarStatusAvaria(
  token: string,
  id: number,
  status: StatusAvaria,
  parecer?: string,
): Promise<AvariaDTO> {
  return requisitar<AvariaDTO>(`/api/avarias/${id}/status`, {
    token,
    metodo: 'PATCH',
    corpo: { status, parecer },
  })
}

export function listarTiposAvaria(token: string): Promise<TipoAvariaDTO[]> {
  return requisitar<TipoAvariaDTO[]>('/api/avarias/tipos', { token })
}

/** Reporte do operador na triagem. */
export function reportarAvaria(token: string, dados: ReportarAvariaRequest): Promise<AvariaDTO> {
  return requisitar<AvariaDTO>('/api/avarias', { token, metodo: 'POST', corpo: dados })
}
