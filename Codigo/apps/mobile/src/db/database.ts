import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { Jornada } from './Jornada';
import { BancoHoras } from './BancoHoras';
import { AcaoPendente } from './AcaoPendente';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: () => {
    // Falha ao abrir o banco local — o app continua funcionando (a leitura
    // reativa simplesmente não emite nada), sem ação de recuperação melhor
    // possível aqui além do próximo boot.
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Jornada, BancoHoras, AcaoPendente],
});

/**
 * Apaga todo o espelho local. Chamado no logout (`AuthContext.sair`) — sem
 * isto, um segundo montador que logar no mesmo aparelho veria o espelho de
 * jornada do anterior até a primeira sincronização.
 */
export async function limparBancoLocal(): Promise<void> {
  await database.write(() => database.unsafeResetDatabase());
}
