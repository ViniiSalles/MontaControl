import type { PedidoDoMontadorDTO } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';

/** GET /api/pedidos/meus — obras atribuídas ao montador, com peças e local do cliente. */
export async function listarMeusPedidos(): Promise<PedidoDoMontadorDTO[]> {
  const resposta = await requisitarAutenticado('/api/pedidos/meus');
  return (await resposta.json()) as PedidoDoMontadorDTO[];
}
