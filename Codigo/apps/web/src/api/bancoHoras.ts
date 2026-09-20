import type { SaldoMontadorDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

/** GET /banco-horas/equipe — painel do RH/GESTOR, uma linha por montador. */
export function listarBancoHorasDaEquipe(
  token: string,
  ano: number,
  mes: number,
): Promise<SaldoMontadorDTO[]> {
  return requisitar<SaldoMontadorDTO[]>(`/api/banco-horas/equipe?ano=${ano}&mes=${mes}`, { token })
}
