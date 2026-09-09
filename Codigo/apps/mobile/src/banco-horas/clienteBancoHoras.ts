import type { BancoHorasDTO } from '@montacontrol/shared';
import { lerErro } from '../jornada/clienteJornadas';
import { urlBaseApi } from '../config/api';

/** GET /api/banco-horas — saldo do montador autenticado no mês/ano pedidos. */
export async function buscarBancoHoras(token: string, mes: number, ano: number): Promise<BancoHorasDTO> {
  const resposta = await fetch(`${urlBaseApi}/api/banco-horas?mes=${mes}&ano=${ano}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as BancoHorasDTO;
}
