import type { Database } from '@nozbe/watermelondb';
import { apagarTodasAsFotos } from '../fotos/armazenamentoFotos';

/**
 * Apaga TUDO do aparelho: o banco inteiro (fila e `localStorage` incluídos) e
 * as fotos em arquivo que as ações da fila (e os rascunhos) referenciam. É o
 * logout explícito e a troca de usuário — as fotos de atestado são dado de
 * saúde do montador anterior e não podem sobrar no aparelho.
 *
 * O banco vai primeiro: se ele não deixar apagar, a fila ainda existe e ainda
 * precisa das fotos. A expiração forçada da sessão NÃO passa por aqui (a fila
 * fica, e as fotos com ela).
 */
export async function limparBancoCompleto(database: Database): Promise<void> {
  await database.write(() => database.unsafeResetDatabase());
  await apagarTodasAsFotos();
}
