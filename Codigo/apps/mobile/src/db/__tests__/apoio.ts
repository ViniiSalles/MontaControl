import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from '../schema';
import { Jornada } from '../Jornada';
import { BancoHoras } from '../BancoHoras';
import { AcaoPendente } from '../AcaoPendente';

/** Banco local em memória, para teste — mesmo schema/modelos do app real, sem SQLite nativo. */
export function criarBancoDeTeste(): Database {
  const adapter = new LokiJSAdapter({
    dbName: `teste-${Math.random()}`,
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: [Jornada, BancoHoras, AcaoPendente] });
}
