import type { LeituraDono } from '../db/donoDaFila';

interface EntradaDestinoDaFila {
  /** Quantas ações há na fila; `'erro'` se não foi possível contar. */
  acoes: number | 'erro';
  /** Dono gravado ao lado da fila (`database.localStorage`). */
  donoBanco: LeituraDono;
  /** Marcador do SecureStore, gravado na expiração forçada da sessão. */
  donoMarcador: LeituraDono;
  /** Usuário que está autenticando (login ou restauração). */
  usuarioId: number;
}

/**
 * O que fazer com a fila de ações pendentes quando `usuarioId` autentica.
 * Fail-closed: ela só é mantida com prova de que é desse usuário — nenhuma
 * ação de um montador pode sair sob o token de outro.
 *
 * - fila vazia: nada a apagar;
 * - erro de leitura em qualquer fonte, ou nenhuma fonte com dono (fila
 *   anterior ao registro de dono): dono desconhecido => apaga;
 * - dono = o do banco; sem ele, o marcador do SecureStore. O do banco é gravado
 *   a cada login, então, se divergirem, o marcador é um resto velho (a
 *   limpeza dele falhou depois do wipe de outro usuário) e é ignorado.
 */
export function decidirDestinoDaFila(entrada: EntradaDestinoDaFila): 'manter' | 'apagar' {
  const { acoes, donoBanco, donoMarcador, usuarioId } = entrada;
  if (acoes === 0) return 'manter';
  if (donoBanco.tipo === 'erro' || donoMarcador.tipo === 'erro') return 'apagar';

  const dono = donoBanco.tipo === 'dono' ? donoBanco : donoMarcador;
  return dono.tipo === 'dono' && dono.usuarioId === usuarioId ? 'manter' : 'apagar';
}
