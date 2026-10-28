import type {
  AluguelEpiDTO,
  RegistrarAluguelEpiRequest,
  RegistrarDevolucaoEpiRequest,
  SalvarTipoEpiRequest,
  TipoEpiDTO,
} from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarTiposEpi(token: string): Promise<TipoEpiDTO[]> {
  return requisitar<TipoEpiDTO[]>('/api/epis/tipos', { token })
}

export function criarTipoEpi(token: string, dados: SalvarTipoEpiRequest): Promise<TipoEpiDTO> {
  return requisitar<TipoEpiDTO>('/api/epis/tipos', { token, metodo: 'POST', corpo: dados })
}

export function atualizarTipoEpi(token: string, id: number, dados: SalvarTipoEpiRequest): Promise<TipoEpiDTO> {
  return requisitar<TipoEpiDTO>(`/api/epis/tipos/${id}`, { token, metodo: 'PUT', corpo: dados })
}

export function listarAlugueisEpi(token: string): Promise<AluguelEpiDTO[]> {
  return requisitar<AluguelEpiDTO[]>('/api/epis/alugueis', { token })
}

export function registrarAluguelEpi(token: string, dados: RegistrarAluguelEpiRequest): Promise<AluguelEpiDTO> {
  return requisitar<AluguelEpiDTO>('/api/epis/alugueis', { token, metodo: 'POST', corpo: dados })
}

export function registrarDevolucaoEpi(
  token: string,
  id: number,
  dados: RegistrarDevolucaoEpiRequest,
): Promise<AluguelEpiDTO> {
  return requisitar<AluguelEpiDTO>(`/api/epis/alugueis/${id}/devolucao`, { token, metodo: 'PATCH', corpo: dados })
}

export function cancelarAluguelEpi(token: string, id: number): Promise<void> {
  return requisitar<void>(`/api/epis/alugueis/${id}`, { token, metodo: 'DELETE' })
}
