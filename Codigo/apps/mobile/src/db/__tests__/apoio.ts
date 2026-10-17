import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { sanitizedRaw } from '@nozbe/watermelondb/RawRecord';
import logger from '@nozbe/watermelondb/utils/common/logger';
import { TABELAS_SYNC, type SyncPullResponse } from '@montacontrol/shared';
import { schema } from '../schema';
import { migrations } from '../migrations';
import { Jornada } from '../Jornada';
import { BancoHoras } from '../BancoHoras';
import { AcaoPendente } from '../AcaoPendente';
import { Pedido } from '../Pedido';
import { Ambiente } from '../Ambiente';
import { Peca } from '../Peca';
import { TipoAvaria } from '../TipoAvaria';
import { Avaria } from '../Avaria';
import { Atestado } from '../Atestado';

// O LokiJSAdapter loga cada etapa de setup/migração (e avisa do `useIncrementalIndexedDB:
// false`) em `console.log/warn` — ruído em toda suíte de banco. Os testes verificam
// os dados, não os logs.
logger.silence();

/** Mesma lista de `database.ts` — o app real não pode ser importado aqui (SQLite nativo). */
export const modelClasses = [
  Jornada,
  BancoHoras,
  AcaoPendente,
  Pedido,
  Ambiente,
  Peca,
  TipoAvaria,
  Avaria,
  Atestado,
];

/** Banco local em memória, para teste — mesmo schema/modelos/migrações do app real, sem SQLite nativo. */
export function criarBancoDeTeste(): Database {
  const adapter = new LokiJSAdapter({
    dbName: `teste-${Math.random()}`,
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses });
}

/**
 * Grava as linhas `created` + `updated` de um pull direto nas tabelas da réplica
 * (sem `synchronize()`, que é da #112). O `id` local é o id do servidor — é o que
 * o protocolo `pullChanges` do WatermelonDB faz por baixo dos panos.
 */
export async function gravarPullNaReplica(database: Database, pull: SyncPullResponse): Promise<void> {
  await database.write(async () => {
    const preparados = TABELAS_SYNC.flatMap((tabela) => {
      const colecao = database.get(tabela);
      const { created, updated } = pull.changes[tabela];
      return [...created, ...updated].map((linha) =>
        colecao.prepareCreate((registro) => {
          registro._raw = sanitizedRaw({ ...linha }, colecao.schema);
        }),
      );
    });
    await database.batch(...preparados);
  });
}
