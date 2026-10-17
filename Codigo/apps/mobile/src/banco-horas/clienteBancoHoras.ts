import type { BancoHorasDTO } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';

/** GET /api/banco-horas — saldo do montador autenticado no mês/ano pedidos. */
export async function buscarBancoHoras(mes: number, ano: number): Promise<BancoHorasDTO> {
  const resposta = await requisitarAutenticado(`/api/banco-horas?mes=${mes}&ano=${ano}`);
  return (await resposta.json()) as BancoHorasDTO;
}
