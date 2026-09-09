import type { SolicitacaoPontoDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarCompensacoesPendentes(token: string): Promise<SolicitacaoPontoDTO[]> {
  return requisitar<SolicitacaoPontoDTO[]>('/api/pontos-em-atraso/pendentes', { token })
}

export function aprovarCompensacao(token: string, id: number): Promise<SolicitacaoPontoDTO> {
  return requisitar<SolicitacaoPontoDTO>(`/api/pontos-em-atraso/${id}/aprovar`, {
    token,
    metodo: 'PATCH',
  })
}

export function rejeitarCompensacao(
  token: string,
  id: number,
  motivo: string,
): Promise<SolicitacaoPontoDTO> {
  return requisitar<SolicitacaoPontoDTO>(`/api/pontos-em-atraso/${id}/rejeitar`, {
    token,
    metodo: 'PATCH',
    corpo: { motivo },
  })
}
