import type { DashboardDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

/** US08/US09 — visão da operação para o gestor (indicadores, pedidos, alertas, produtividade). */
export function buscarDashboard(token: string): Promise<DashboardDTO> {
  return requisitar<DashboardDTO>('/api/dashboard', { token })
}
