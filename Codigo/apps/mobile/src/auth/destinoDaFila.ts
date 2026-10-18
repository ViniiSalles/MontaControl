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
 * - erro de leitura em qualquer fonte: dono desconhecido => apaga, qualquer
 *   que seja o tamanho da fila;
 * - dono = o do banco; sem ele, o marcador do SecureStore. O do banco é gravado
 *   a cada login, então, se divergirem, o marcador é um resto velho (a
 *   limpeza dele falhou depois do wipe de outro usuário) e é ignorado;
 * - há dono: mantém só se for o mesmo usuário; de outro => apaga, mesmo com a
 *   fila vazia (a réplica — jornadas, banco de horas, obras — de outro usuário
 *   não pode ficar exposta a quem entra);
 * - nenhum dono registrado: fila vazia => nada a apagar; fila com ações (de
 *   antes do registro de dono) => apaga.
 */
export function decidirDestinoDaFila(entrada: EntradaDestinoDaFila): 'manter' | 'apagar' {
  const { acoes, donoBanco, donoMarcador, usuarioId } = entrada;
  if (donoBanco.tipo === 'erro' || donoMarcador.tipo === 'erro') return 'apagar';

  const dono = donoBanco.tipo === 'dono' ? donoBanco : donoMarcador;
  if (dono.tipo === 'dono') return dono.usuarioId === usuarioId ? 'manter' : 'apagar';

  return acoes === 0 ? 'manter' : 'apagar';
}
