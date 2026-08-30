import type { JornadaDTO } from '../types';

/**
 * Uma jornada aberta não vale para sempre. Passado este prazo desde o
 * check-in, ela é tratada como check-out esquecido, não como turno em curso:
 * o app volta a oferecer ENTRADA, e o registro que faltou se corrige por
 * ponto em atraso.
 *
 * O prazo conta em horas corridas desde o check-in, não até a virada do
 * calendário — turno que começa 23h50 e fecha 00h30 é um turno só.
 */
export const LIMITE_JORNADA_HORAS = 24;

/** O mesmo limite em milissegundos, para aritmética de intervalo. */
export const LIMITE_JORNADA_MS = LIMITE_JORNADA_HORAS * 60 * 60 * 1000;

/**
 * `finalizada` tem check-out; `vencida` passou do limite sem ele; o resto é
 * turno em curso. São três porque a tela age diferente em cada um — só
 * `em_andamento` oferece o botão de saída.
 */
export type EstadoJornada = 'em_andamento' | 'vencida' | 'finalizada';

/** Instante em que a jornada vence, ou `null` se ela não tem check-in. */
export function vencimentoJornada(jornada: JornadaDTO): string | null {
  if (!jornada.checkinAt) return null;
  return new Date(new Date(jornada.checkinAt).getTime() + LIMITE_JORNADA_MS).toISOString();
}

export function estadoJornada(jornada: JornadaDTO, agoraIso: string): EstadoJornada {
  if (jornada.checkoutAt) return 'finalizada';

  const vencimento = vencimentoJornada(jornada);
  // Jornada aberta sem check-in não existe pelo fluxo normal (o check-in é
  // que a cria). Sem instante de referência não há o que vencer.
  if (!vencimento) return 'em_andamento';

  // Comparação numérica, não lexicográfica: `agoraIso` vem de fora e pode
  // chegar com deslocamento (`-03:00`) em vez de `Z`, e aí a ordem de texto
  // mente.
  return new Date(agoraIso).getTime() >= new Date(vencimento).getTime()
    ? 'vencida'
    : 'em_andamento';
}

/** Atalho para a única pergunta que a maioria dos chamadores faz. */
export function jornadaVencida(jornada: JornadaDTO, agoraIso: string): boolean {
  return estadoJornada(jornada, agoraIso) === 'vencida';
}
