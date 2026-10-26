import type { DashboardDTO, RastreioPecaDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

/** US08/US09 — visão da operação para o gestor (indicadores, pedidos, alertas, produtividade). */
export function buscarDashboard(token: string): Promise<DashboardDTO> {
  return requisitar<DashboardDTO>('/api/dashboard', { token })
}

/** Quem bipou cada peça do pedido (triagem e descarregamento). */
export function rastrearPecasPedido(token: string, pedidoId: number): Promise<RastreioPecaDTO[]> {
  return requisitar<RastreioPecaDTO[]>(`/api/dashboard/pedidos/${pedidoId}/pecas`, { token })
}
