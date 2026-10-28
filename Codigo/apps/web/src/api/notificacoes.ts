import type { ListaNotificacoesDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

interface ParametrosListagem {
  limite?: number
  /** Cursor (id) devolvido em `proximoCursor`: traz só as mais antigas que ele. */
  antesDe?: number
}

export function listarNotificacoes(
  token: string,
  parametros: ParametrosListagem = {},
): Promise<ListaNotificacoesDTO> {
  const consulta = new URLSearchParams()
  if (parametros.limite !== undefined) consulta.set('limite', String(parametros.limite))
  if (parametros.antesDe !== undefined) consulta.set('antesDe', String(parametros.antesDe))
  const sufixo = consulta.size > 0 ? `?${consulta}` : ''
  return requisitar<ListaNotificacoesDTO>(`/api/notificacoes${sufixo}`, { token })
}

export function marcarNotificacaoLida(token: string, id: number): Promise<void> {
  return requisitar<void>(`/api/notificacoes/${id}/lida`, { token, metodo: 'PATCH' })
}

export function marcarTodasNotificacoesLidas(token: string): Promise<void> {
  return requisitar<void>('/api/notificacoes/marcar-todas-lidas', { token, metodo: 'POST' })
}
