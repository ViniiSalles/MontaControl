/**
 * Calendário civil do banco de horas e do espelho de ponto.
 *
 * Tudo aqui trabalha em dia civil `YYYY-MM-DD` e em UTC puro — um dia do mês
 * não tem hora, e arrastar fuso para dentro dessa conta é o caminho mais
 * curto para o dia 1º virar o dia 31 do mês anterior. A conversão de
 * instante para dia civil no fuso de operação é feita antes, com `diaNoFuso`.
 *
 * Feriados não são considerados: dia útil aqui é segunda a sexta. Limitação
 * conhecida, registrada no plano da Sprint 7.
 */

/** Jornada contratual padrão do montador, em minutos (8 h). */
export const MINUTOS_JORNADA_PADRAO = 480;

export interface PeriodoAbonado {
  /** `YYYY-MM-DD`. */
  dataInicio: string;
  /** `YYYY-MM-DD`, inclusivo. */
  dataFim: string;
}

export interface PeriodoCivil {
  inicio: string;
  fim: string;
}

function paraData(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

function paraDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Sábado (6) e domingo (0) ficam de fora. */
function ehDiaUtil(data: Date): boolean {
  const diaSemana = data.getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6;
}

/** Primeiro e último dia civil do mês (`mes` é 1-12, como na coluna `banco_horas.mes`). */
export function periodoDoMes(ano: number, mes: number): PeriodoCivil {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  // Dia 0 do mês seguinte é o último dia deste mês — resolve fevereiro bissexto sozinho.
  const fim = new Date(Date.UTC(ano, mes, 0));
  return { inicio: paraDia(inicio), fim: paraDia(fim) };
}

/** Dias úteis do mês, em ordem crescente. */
export function diasUteisNoMes(ano: number, mes: number): string[] {
  const { fim } = periodoDoMes(ano, mes);
  const ultimoDia = paraData(fim).getUTCDate();
  const dias: string[] = [];

  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    if (ehDiaUtil(data)) dias.push(paraDia(data));
  }
  return dias;
}

/**
 * Dias úteis do mês cobertos por algum dos períodos informados (atestados
 * validados). `Set` porque atestados podem se sobrepor e o mesmo dia não
 * pode ser abonado duas vezes.
 */
export function diasAbonados(
  periodos: readonly PeriodoAbonado[],
  ano: number,
  mes: number,
): Set<string> {
  const abonados = new Set<string>();

  for (const dia of diasUteisNoMes(ano, mes)) {
    if (periodos.some((periodo) => dia >= periodo.dataInicio && dia <= periodo.dataFim)) {
      abonados.add(dia);
    }
  }
  return abonados;
}
