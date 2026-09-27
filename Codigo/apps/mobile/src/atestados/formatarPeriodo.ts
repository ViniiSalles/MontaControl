const MS_POR_DIA = 24 * 60 * 60 * 1000;

function emUtc(dia: string): number {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number);
  return Date.UTC(ano, mes - 1, diaDoMes);
}

function diaMes(dia: string): string {
  const [, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}`;
}

/** Período de um atestado (`YYYY-MM-DD`) para exibição: `15/10 a 17/10 (3 dias)` ou `12/10 (1 dia)`. */
export function textoPeriodo(dataInicio: string, dataFim: string): string {
  const dias = Math.round((emUtc(dataFim) - emUtc(dataInicio)) / MS_POR_DIA) + 1;
  const contagem = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return dias === 1
    ? `${diaMes(dataInicio)} (${contagem})`
    : `${diaMes(dataInicio)} a ${diaMes(dataFim)} (${contagem})`;
}
