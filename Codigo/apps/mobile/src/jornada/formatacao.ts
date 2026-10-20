import { FUSO_OPERACAO } from '../config/fuso';

/** `540` → `"9h 00min"`. */
export function formatarDuracao(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas}h ${String(resto).padStart(2, '0')}min`;
}

/** ISO → `"08:00"` no fuso de operação. Travessão quando não há horário. */
export function formatarHora(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_OPERACAO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Dia civil `YYYY-MM-DD` como instante UTC — ver o comentário de `formatarDiaEMes`. */
function instanteDoDia(data: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * `"2026-08-26"` → `"26 ago"`. Usa `timeZone: 'UTC'` de propósito: a entrada
 * já é um dia civil (`YYYY-MM-DD`), não um instante — formatar de novo no
 * fuso de operação deslocaria a data em um dia. Monta as partes à mão porque
 * o `Intl` em pt-BR devolve "26 de ago.".
 */
export function formatarDiaEMes(data: string): string {
  const instante = instanteDoDia(data);
  const dia = String(instante.getUTCDate()).padStart(2, '0');
  const mes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' })
    .format(instante)
    .replace('.', '');
  return `${dia} ${mes}`;
}

/** `"2026-08-26"` → `"quarta-feira"`. Mesma construção UTC de `formatarDiaEMes`. */
export function formatarDiaDaSemana(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' }).format(
    instanteDoDia(data),
  );
}

/**
 * `"2026-08-26"` → `"Quarta-feira, 26 de agosto"`. Mesma construção UTC de
 * `formatarDiaEMes` (ver o comentário lá) — só maiúscula a inicial, já que
 * o `Intl` devolve tudo em minúsculo em pt-BR.
 */
export function formatarDataCompleta(data: string): string {
  const bruto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instanteDoDia(data));
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

/**
 * Instante ISO -> dia civil `YYYY-MM-DD` no fuso de operação. `en-CA` é o
 * atalho de sempre para esse formato no `Intl`; montar a string à mão a
 * partir de `getFullYear()` etc. usaria o fuso do aparelho, que é o que se
 * quer justamente evitar.
 */
export function diaCivilDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_OPERACAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
