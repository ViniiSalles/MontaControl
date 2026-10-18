import { localStorageKey } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import type { AcaoPendente } from './AcaoPendente';

/**
 * Leitura do dono da fila de ações pendentes em três estados: "não há registro"
 * e "não consegui ler" são coisas diferentes e quem decide o destino da fila
 * trata a segunda como dono desconhecido (fail-closed).
 */
export type LeituraDono =
  { tipo: 'ausente' } | { tipo: 'dono'; usuarioId: number } | { tipo: 'erro' };

/**
 * Dono guardado AO LADO da fila, no `localStorage` do WatermelonDB: o
 * `limparBancoLocal` (wipe completo) apaga os dois juntos, e o
 * `limparEspelhoLocal` (expiração forçada) não mexe nele — então sobrevive
 * exatamente quando a fila sobrevive. Gravado a cada login/restauração
 * bem-sucedidos, depois da reconciliação (ver `AuthContext`).
 */
const CHAVE_DONO = localStorageKey<number>('dono_da_fila');

export async function lerDonoNoBanco(database: Database): Promise<LeituraDono> {
  try {
    const valor: unknown = await database.localStorage.get(CHAVE_DONO);
    if (valor === undefined || valor === null) return { tipo: 'ausente' };
    return typeof valor === 'number' && Number.isInteger(valor)
      ? { tipo: 'dono', usuarioId: valor }
      : { tipo: 'erro' };
  } catch {
    return { tipo: 'erro' };
  }
}

/**
 * `false` se não conseguiu gravar. Quem chama trata como FATAL: o login não segue
 * (`AuthContext.reconciliarFilaCom`), porque um dono antigo no banco prevaleceria
 * sobre o marcador do SecureStore e a fila sairia sob o token de outro usuário.
 */
export async function registrarDonoNoBanco(
  database: Database,
  usuarioId: number,
): Promise<boolean> {
  try {
    await database.localStorage.set(CHAVE_DONO, usuarioId);
    return true;
  } catch {
    return false;
  }
}

/** Toda ação na fila, de qualquer status (as descartadas também são do usuário anterior). */
export async function contarAcoesNaFila(database: Database): Promise<number> {
  return database.get<AcaoPendente>('acoes_pendentes').query().fetchCount();
}
