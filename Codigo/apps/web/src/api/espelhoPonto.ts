import type { EspelhoPontoDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function buscarEspelhoPonto(
  token: string,
  usuarioId: number,
  ano: number,
  mes: number,
): Promise<EspelhoPontoDTO> {
  return requisitar<EspelhoPontoDTO>(
    `/api/espelho-ponto/${usuarioId}?ano=${ano}&mes=${mes}`,
    { token },
  )
}
