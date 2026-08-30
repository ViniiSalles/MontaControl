import type { DiaJornadaDTO, JornadaDTO } from '../types';
import { diaNoFuso } from './fuso';

const MS_POR_MINUTO = 60_000;

/**
 * Minutos de um turno. Zero enquanto faltar uma das pontas: turno aberto
 * (ou vencido, sem check-out) não tem duração para somar — o que ele tem é
 * um registro faltando.
 */
export function minutosDaJornada(jornada: JornadaDTO): number {
  if (!jornada.checkinAt || !jornada.checkoutAt) return 0;
  const bruto = new Date(jornada.checkoutAt).getTime() - new Date(jornada.checkinAt).getTime();
  return Math.max(0, Math.round(bruto / MS_POR_MINUTO));
}

function menor(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maior(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Agrupa jornadas em cards de dia, do mais recente ao mais antigo.
 *
 * O dia de uma jornada é o dia do **check-in** no fuso informado: um turno
 * que começa 23h50 e termina 00h30 é um turno só, na terça, e não meia hora
 * na terça e meia na quarta. Jornada sem check-in não tem dia a que
 * pertencer e é descartada.
 *
 * Só dias com ao menos uma jornada aparecem — a tela de histórico não ganha
 * nada com trinta cards vazios.
 */
export function agruparJornadasPorDia(
  jornadas: readonly JornadaDTO[],
  fuso: string,
): DiaJornadaDTO[] {
  const porDia = new Map<string, DiaJornadaDTO>();

  for (const jornada of jornadas) {
    if (!jornada.checkinAt) continue;

    const data = diaNoFuso(jornada.checkinAt, fuso);
    const existente = porDia.get(data);

    if (!existente) {
      porDia.set(data, {
        data,
        inicio: jornada.checkinAt,
        fim: jornada.checkoutAt,
        minutosTrabalhados: minutosDaJornada(jornada),
        emAndamento: jornada.checkoutAt === null,
        jornadas: [jornada],
      });
      continue;
    }

    existente.inicio = menor(existente.inicio, jornada.checkinAt);
    existente.fim = maior(existente.fim, jornada.checkoutAt);
    existente.minutosTrabalhados += minutosDaJornada(jornada);
    existente.emAndamento = existente.emAndamento || jornada.checkoutAt === null;
    existente.jornadas.push(jornada);
  }

  return [...porDia.values()].sort((a, b) => b.data.localeCompare(a.data));
}
