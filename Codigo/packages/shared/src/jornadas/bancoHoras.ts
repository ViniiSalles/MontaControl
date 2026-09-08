/** Jornada padrão usada para estimar horas previstas — sem carga horária por colaborador ainda. */
export const HORAS_POR_DIA_UTIL = 8;

/**
 * Dias úteis (segunda a sexta) do mês civil `mes`/`ano`. Contagem de
 * calendário pura em UTC — segunda a sexta não muda com fuso horário — e
 * sem calendário de feriados por enquanto.
 */
export function diasUteisNoMes(mes: number, ano: number): number {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  let uteis = 0;
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) uteis++;
  }
  return uteis;
}

/** Horas previstas do mês: dias úteis × jornada padrão. */
export function horasPrevistasNoMes(mes: number, ano: number): number {
  return diasUteisNoMes(mes, ano) * HORAS_POR_DIA_UTIL;
}
