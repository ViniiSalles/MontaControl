import { localStorageKey } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import type { PedidoDoMontadorDTO } from '@montacontrol/shared';

/** O que o ponto precisa da obra: o pedido e onde fica o cliente. */
export type ObraDoPonto = Pick<PedidoDoMontadorDTO, 'id' | 'numeroPedido' | 'cliente'>;

/**
 * Última lista de obras lida do servidor. O ponto funciona sem sinal, então
 * a obra (e o raio dela) precisa estar no aparelho antes de faltar rede.
 * Fica no banco local, que o logout já apaga (`limparBancoLocal`).
 */
const CHAVE_OBRAS = localStorageKey<ObraDoPonto[]>('obras_do_montador');

/** Pedido do check-in da jornada aberta — a saída é validada contra ele. */
const CHAVE_OBRA_DA_JORNADA = localStorageKey<number>('obra_da_jornada_aberta');

export async function guardarObras(database: Database, pedidos: readonly ObraDoPonto[]): Promise<void> {
  const obras = pedidos.map(({ id, numeroPedido, cliente }) => ({ id, numeroPedido, cliente }));
  await database.localStorage.set(CHAVE_OBRAS, obras);
}

export async function lerObras(database: Database): Promise<ObraDoPonto[]> {
  return (await database.localStorage.get(CHAVE_OBRAS)) ?? [];
}

export async function lembrarObraDaJornada(database: Database, pedidoId: number): Promise<void> {
  await database.localStorage.set(CHAVE_OBRA_DA_JORNADA, pedidoId);
}

export async function lerObraDaJornada(database: Database): Promise<number | null> {
  return (await database.localStorage.get(CHAVE_OBRA_DA_JORNADA)) ?? null;
}

/** Apaga a cópia local das obras e a obra da jornada aberta (réplica do servidor). */
export async function limparObrasLocais(database: Database): Promise<void> {
  await database.localStorage.remove(CHAVE_OBRAS);
  await database.localStorage.remove(CHAVE_OBRA_DA_JORNADA);
}
