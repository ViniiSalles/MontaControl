import type { PedidoDoMontadorDTO } from '@montacontrol/shared';
import { lerErro } from '../jornada/clienteJornadas';
import { urlBaseApi } from '../config/api';

/** GET /api/pedidos/meus — obras atribuídas ao montador, com peças e local do cliente. */
export async function listarMeusPedidos(token: string): Promise<PedidoDoMontadorDTO[]> {
  const resposta = await fetch(`${urlBaseApi}/api/pedidos/meus`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as PedidoDoMontadorDTO[];
}
