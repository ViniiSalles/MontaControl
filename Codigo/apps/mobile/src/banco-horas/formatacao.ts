const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** `12.75` → `"12h 45min"`. Sem sinal — para grandezas sempre não negativas (trabalhadas, previstas). */
export function formatarHoras(horas: number): string {
  const minutosTotais = Math.round(horas * 60);
  const h = Math.floor(minutosTotais / 60);
  const min = minutosTotais % 60;
  return `${h}h ${String(min).padStart(2, '0')}min`;
}

/** `-8` → `"-8h 00min"`; `12.75` → `"+12h 45min"` — saldo, que pode ser negativo. */
export function formatarSaldoHoras(horas: number): string {
  const sinal = horas < 0 ? '-' : '+';
  return `${sinal}${formatarHoras(Math.abs(horas))}`;
}

/** `(8, 2026)` → `"Agosto de 2026"`. */
export function formatarMesAno(mes: number, ano: number): string {
  return `${MESES[mes - 1]} de ${ano}`;
}
