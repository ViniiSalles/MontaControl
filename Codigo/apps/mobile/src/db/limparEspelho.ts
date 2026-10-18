import type { Database } from '@nozbe/watermelondb';

const TABELA_DA_FILA = 'acoes_pendentes';

/**
 * Chaves que o `synchronize()` do WatermelonDB guarda no `local_storage` do
 * banco (ver `sync/impl/index.js`). Fazem parte da réplica: sem apagá-las, o
 * próximo usuário faria um pull INCREMENTAL em cima de uma réplica já apagada
 * e ficaria sem os dados anteriores ao `lastPulledAt`. Há um teste que
 * sincroniza de verdade e confere que elas somem, para pegar mudança de nome.
 */
const CHAVES_DA_SINCRONIZACAO = [
  '__watermelon_last_pulled_at',
  '__watermelon_last_pulled_schema_version',
  // Legadas (app v2, `obrasLocais`): cópia do cliente da obra. A migração v3 as
  // apaga; mantidas aqui por segurança caso algum aparelho as reintroduza.
  'obras_do_montador',
  'obra_da_jornada_aberta',
];

/**
 * Apaga a réplica local do servidor: toda tabela, exceto a fila de ações
 * pendentes, e as chaves de `localStorage` da sincronização (`lastPulledAt`).
 * Usado na expiração forçada da sessão: o que o montador marcou e ainda não
 * subiu não pode se perder, mas os dados do servidor não ficam no aparelho sem
 * sessão. O dono da fila (`donoDaFila`) e demais chaves não são tocados.
 *
 * Tabelas novas entram sozinhas (itera as coleções); chaves novas de
 * `localStorage` da réplica precisam ser adicionadas à lista acima.
 * (O logout, que apaga TUDO, usa `unsafeResetDatabase`, que limpa o
 * `localStorage` inteiro.)
 */
export async function limparEspelhoLocal(database: Database): Promise<void> {
  await database.write(async () => {
    for (const colecao of Object.values(database.collections.map)) {
      if (colecao.table === TABELA_DA_FILA) continue;
      const registros = await colecao.query().fetch();
      await database.batch(...registros.map((registro) => registro.prepareDestroyPermanently()));
    }
  });
  for (const chave of CHAVES_DA_SINCRONIZACAO) {
    await database.adapter.removeLocal(chave);
  }
}
