import type { AtestadoDTO, EnviarAtestadoRequest } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';

/** POST /api/atestados — envia o atestado com foto(s); idempotente por `idCliente`. */
export async function enviarAtestado(dados: EnviarAtestadoRequest): Promise<AtestadoDTO> {
  const resposta = await requisitarAutenticado('/api/atestados', { metodo: 'POST', corpo: dados });
  return (await resposta.json()) as AtestadoDTO;
}

/** GET /api/atestados/meus — os próprios atestados do montador, mais recente primeiro. */
export async function listarMeusAtestados(): Promise<AtestadoDTO[]> {
  const resposta = await requisitarAutenticado('/api/atestados/meus');
  return (await resposta.json()) as AtestadoDTO[];
}
