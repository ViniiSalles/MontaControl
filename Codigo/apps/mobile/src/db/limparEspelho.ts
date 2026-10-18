import type { Database } from '@nozbe/watermelondb';
import { limparObrasLocais } from '../pedidos/obrasLocais';

const TABELA_DA_FILA = 'acoes_pendentes';

/**
 * Apaga a réplica local do servidor (toda tabela, exceto a fila de ações
 * pendentes, e as chaves de `localStorage` da réplica). Usado na expiração
 * forçada da sessão: o que o montador marcou e ainda não subiu não pode se
 * perder, mas os dados do servidor não ficam no aparelho sem sessão.
 *
 * Tabelas novas entram sozinhas (itera as coleções); chaves novas de
 * `localStorage` da réplica precisam ser adicionadas aqui.
 */
export async function limparEspelhoLocal(database: Database): Promise<void> {
  await database.write(async () => {
    for (const colecao of Object.values(database.collections.map)) {
      if (colecao.table === TABELA_DA_FILA) continue;
      const registros = await colecao.query().fetch();
      await database.batch(...registros.map((registro) => registro.prepareDestroyPermanently()));
    }
  });
  await limparObrasLocais(database);
}
