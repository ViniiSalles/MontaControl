import type { SaldoMontadorDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarBancoHoras(
  token: string,
  ano: number,
  mes: number,
): Promise<SaldoMontadorDTO[]> {
  return requisitar<SaldoMontadorDTO[]>(`/api/banco-horas?ano=${ano}&mes=${mes}`, { token })
}
