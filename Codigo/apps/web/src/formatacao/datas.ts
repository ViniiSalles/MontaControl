export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DIAS_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const doisDigitos = (valor: number) => String(valor).padStart(2, '0')

/** `YYYY-MM-DD` → partes numéricas, sem `new Date` (que aplicaria UTC e voltaria um dia). */
function partesDoDia(dia: string): [number, number, number] {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number)
  return [ano, mes, diaDoMes]
}

export function nomeDoMes(mes: number): string {
  return MESES[mes - 1]
}

export function formatarDiaCivil(dia: string): string {
  const [ano, mes, diaDoMes] = partesDoDia(dia)
  return `${doisDigitos(diaDoMes)}/${doisDigitos(mes)}/${ano}`
}

export function formatarDiaMes(dia: string): string {
  const [, mes, diaDoMes] = partesDoDia(dia)
  return `${doisDigitos(diaDoMes)}/${doisDigitos(mes)}`
}

export function diaDaSemana(dia: string): string {
  const [ano, mes, diaDoMes] = partesDoDia(dia)
  return DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, diaDoMes)).getUTCDay()]
}

/** Quantidade de dias do período, contando início e fim. */
export function diasCorridos(inicio: string, fim: string): number {
  const [a1, m1, d1] = partesDoDia(inicio)
  const [a2, m2, d2] = partesDoDia(fim)
  const umDia = 24 * 60 * 60 * 1000
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / umDia) + 1
}

/** Instante ISO → `14 Out 2026, 08:30` no fuso do navegador do RH. */
export function formatarDataHoraCurta(iso: string): string {
  const data = new Date(iso)
  return `${doisDigitos(data.getDate())} ${MESES_CURTOS[data.getMonth()]} ${data.getFullYear()}, ${formatarHora(iso)}`
}

export function formatarHora(iso: string | null): string {
  if (!iso) return '--:--'
  const data = new Date(iso)
  return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
}

/** Valor de `<input type="month">`. */
export function competenciaParaTexto(ano: number, mes: number): string {
  return `${ano}-${doisDigitos(mes)}`
}

export function textoParaCompetencia(texto: string): { ano: number; mes: number } | null {
  const casamento = /^(\d{4})-(\d{2})$/.exec(texto)
  if (!casamento) return null
  const ano = Number(casamento[1])
  const mes = Number(casamento[2])
  return mes >= 1 && mes <= 12 ? { ano, mes } : null
}
