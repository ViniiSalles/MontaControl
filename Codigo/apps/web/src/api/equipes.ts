import type { EquipeDTO, SalvarEquipeRequest } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarEquipes(token: string): Promise<EquipeDTO[]> {
  return requisitar<EquipeDTO[]>('/api/equipes', { token })
}

export function criarEquipe(token: string, dados: SalvarEquipeRequest): Promise<EquipeDTO> {
  return requisitar<EquipeDTO>('/api/equipes', { token, metodo: 'POST', corpo: dados })
}

export function atualizarEquipe(token: string, id: number, dados: SalvarEquipeRequest): Promise<EquipeDTO> {
  return requisitar<EquipeDTO>(`/api/equipes/${id}`, { token, metodo: 'PUT', corpo: dados })
}

export function removerEquipe(token: string, id: number): Promise<void> {
  return requisitar<void>(`/api/equipes/${id}`, { token, metodo: 'DELETE' })
}
