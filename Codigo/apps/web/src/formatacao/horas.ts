/** Minutos → `HH:mm` (horas acumuladas, podem passar de 24). `comSinal` força `+` nos positivos. */
export function formatarMinutos(minutos: number, comSinal = false): string {
  const total = Math.abs(minutos)
  const texto = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  if (minutos < 0) return `-${texto}`
  return comSinal && minutos > 0 ? `+${texto}` : texto
}

/** Horas decimais (colunas `Decimal(7,2)` do banco de horas) → minutos inteiros. */
export function horasParaMinutos(horas: number): number {
  return Math.round(horas * 60)
}
