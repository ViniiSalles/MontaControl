import type { AtestadoDTO, EnviarAtestadoRequest } from '@montacontrol/shared';
import { lerErro } from '../jornada/clienteJornadas';
import { urlBaseApi } from '../config/api';

/** POST /api/atestados — envia o atestado com foto(s); idempotente por `idCliente`. */
export async function enviarAtestado(token: string, dados: EnviarAtestadoRequest): Promise<AtestadoDTO> {
  const resposta = await fetch(`${urlBaseApi}/api/atestados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as AtestadoDTO;
}

/** GET /api/atestados/meus — os próprios atestados do montador, mais recente primeiro. */
export async function listarMeusAtestados(token: string): Promise<AtestadoDTO[]> {
  const resposta = await fetch(`${urlBaseApi}/api/atestados/meus`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as AtestadoDTO[];
}
