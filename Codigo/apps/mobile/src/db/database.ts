import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { Jornada } from './Jornada';
import { BancoHoras } from './BancoHoras';
import { AcaoPendente } from './AcaoPendente';
import { limparEspelhoLocal } from './limparEspelho';

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
 * Apaga TUDO, inclusive a fila de ações pendentes. Chamado no logout
 * explícito (`AuthContext.sair`) e quando outro usuário entra no aparelho —
 * sem isto, um segundo montador veria o espelho de jornada do anterior (ou
 * enviaria as ações dele).
 */
export async function limparBancoLocal(): Promise<void> {
  await database.write(() => database.unsafeResetDatabase());
}

/**
 * Apaga a réplica do servidor e mantém a fila de ações pendentes. Usado na
 * expiração forçada da sessão (refresh recusado), ver `db/limparEspelho`.
 */
export async function limparEspelhoBancoLocal(): Promise<void> {
  await limparEspelhoLocal(database);
}
