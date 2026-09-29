/**
 * Aritmética de dia civil em um fuso, sem dependência externa.
 *
 * Toda regra de data do MontaControl (janela de aceitação do check-in,
 * limite retroativo do ponto em atraso, agrupamento do histórico) é sobre o
 * dia local do montador. Avaliar qualquer uma delas em UTC joga toda jornada
 * noturna para o dia seguinte, porque o Brasil está a oeste de Greenwich.
 */

const FORMATADOR_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let existente = FORMATADOR_CACHE.get(fuso);
  if (!existente) {
    existente = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATADOR_CACHE.set(fuso, existente);
  }
  return existente;
}

interface PartesLocais {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function partesLocais(instante: Date, fuso: string): PartesLocais {
  const partes = Object.fromEntries(
    formatador(fuso)
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value]),
  ) as Record<string, string>;

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

/**
 * Deslocamento do fuso, em minutos, no instante dado. Positivo a leste de
 * Greenwich. Calculado a partir do próprio `Intl` para não hardcodar `-03:00`
 * — o Brasil não tem horário de verão hoje, mas hardcodar o número faria a
 * função mentir se voltasse, e faz ela mentir agora para qualquer outro fuso.
 */
function deslocamentoMinutos(instante: Date, fuso: string): number {
  const p = partesLocais(instante, fuso);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const semMilissegundos = Math.floor(instante.getTime() / 1000) * 1000;
  return (comoSeFosseUtc - semMilissegundos) / 60_000;
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Dia civil (`YYYY-MM-DD`) em que o instante cai, no fuso informado. */
export function diaNoFuso(instanteIso: string, fuso: string): string {
  const p = partesLocais(new Date(instanteIso), fuso);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}`;
}

/**
 * Instante ISO em UTC correspondente a `data` + `hora` **locais** no fuso.
 *
 * Duas passadas: a primeira chuta o deslocamento usando a data tratada como
 * se fosse UTC, a segunda corrige usando o deslocamento real daquele
 * instante. Uma passada só erra em datas próximas a uma troca de
 * deslocamento; duas convergem para todos os casos práticos.
 */
export function comporInstante(data: string, hora: string, fuso: string): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const comoUtc = Date.UTC(ano, mes - 1, dia, h, min, 0, 0);

  const primeiroChute = comoUtc - deslocamentoMinutos(new Date(comoUtc), fuso) * 60_000;
  const ajustado = comoUtc - deslocamentoMinutos(new Date(primeiroChute), fuso) * 60_000;

  return new Date(ajustado).toISOString();
}

/** Soma (ou subtrai, com `dias` negativo) dias a uma data `YYYY-MM-DD`. */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const deslocada = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return `${deslocada.getUTCFullYear()}-${doisDigitos(deslocada.getUTCMonth() + 1)}-${doisDigitos(
    deslocada.getUTCDate(),
  )}`;
}

/**
 * Início e fim do mês civil (`mes` 1-12) no fuso informado, como instantes
 * ISO em UTC — mesma técnica de "-1ms" que `JornadasService.historico` usa
 * para o período de dias, agora por mês inteiro. O fim é o último
 * milissegundo do mês, não a meia-noite do mês seguinte: `23:59` perderia o
 * que aconteceu entre `23:59:01` e a virada.
 */
export function limitesDoMes(
  mes: number,
  ano: number,
  fuso: string,
): { inicioIso: string; fimIso: string } {
  const inicioIso = comporInstante(`${ano}-${doisDigitos(mes)}-01`, '00:00', fuso);

  const proximoMes = mes === 12 ? 1 : mes + 1;
  const anoDoProximoMes = mes === 12 ? ano + 1 : ano;
  const inicioProximoMes = comporInstante(
    `${anoDoProximoMes}-${doisDigitos(proximoMes)}-01`,
    '00:00',
    fuso,
  );

  const fimIso = new Date(new Date(inicioProximoMes).getTime() - 1).toISOString();

  return { inicioIso, fimIso };
}

/** Hora local (`HH:mm`) do instante, no fuso informado. */
export function horaNoFuso(instanteIso: string, fuso: string): string {
  const p = partesLocais(new Date(instanteIso), fuso);
  return `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
}

/** Deslocamento do fuso no instante, como `"+HHMM"`/`"-HHMM"` (ex.: `"-0300"`). */
export function offsetFuso(instanteIso: string, fuso: string): string {
  const minutos = deslocamentoMinutos(new Date(instanteIso), fuso);
  const sinal = minutos < 0 ? '-' : '+';
  const absolutos = Math.abs(minutos);
  return `${sinal}${doisDigitos(Math.floor(absolutos / 60))}${doisDigitos(absolutos % 60)}`;
}
