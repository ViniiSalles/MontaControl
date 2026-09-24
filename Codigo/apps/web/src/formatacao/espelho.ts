import { MINUTOS_JORNADA_PADRAO } from '@montacontrol/shared'
import type { DiaEspelhoDTO } from '@montacontrol/shared'

export type Ocorrencia = 'ABONADO' | 'EM_ANDAMENTO' | 'FALTA' | 'LANCADO_EM_ATRASO' | 'HE' | 'REGULAR' | 'NAO_UTIL'

/**
 * Ocorrência exibida na coluna do espelho (`espelho_de_ponto`). `null` =
 * dia útil ainda sem marcação (hoje ou futuro) — não é falta ainda.
 * `hoje` e `dia.data` são `YYYY-MM-DD`, comparáveis como string.
 */
export function ocorrenciaDoDia(dia: DiaEspelhoDTO, hoje: string): Ocorrencia | null {
  if (dia.abonado) return 'ABONADO'
  if (dia.emAndamento) return 'EM_ANDAMENTO'
  if (dia.minutosTrabalhados === 0) {
    if (!dia.diaUtil) return 'NAO_UTIL'
    return dia.data < hoje ? 'FALTA' : null
  }
  if (dia.lancadoEmAtraso) return 'LANCADO_EM_ATRASO'
  if (!dia.diaUtil || dia.minutosTrabalhados > MINUTOS_JORNADA_PADRAO) return 'HE'
  return 'REGULAR'
}

export interface ColunasMarcacao {
  entrada: string | null
  saidaIntervalo: string | null
  retornoIntervalo: string | null
  saida: string | null
}

/** Primeiro turno = manhã, segundo = tarde; a saída é sempre o fim do último turno. */
export function colunasDoDia(dia: DiaEspelhoDTO): ColunasMarcacao {
  const [primeiro, segundo] = dia.turnos
  if (!primeiro) return { entrada: null, saidaIntervalo: null, retornoIntervalo: null, saida: null }
  if (!segundo) return { entrada: primeiro.inicio, saidaIntervalo: null, retornoIntervalo: null, saida: primeiro.fim }
  return {
    entrada: primeiro.inicio,
    saidaIntervalo: primeiro.fim,
    retornoIntervalo: segundo.inicio,
    saida: dia.turnos[dia.turnos.length - 1].fim,
  }
}

export function contarFaltas(dias: DiaEspelhoDTO[], hoje: string): number {
  return dias.filter((dia) => ocorrenciaDoDia(dia, hoje) === 'FALTA').length
}

export function resumoDoMes(dias: DiaEspelhoDTO[]) {
  const comMarcacao = dias.filter((dia) => dia.minutosTrabalhados > 0)
  const minutosTrabalhados = comMarcacao.reduce((soma, dia) => soma + dia.minutosTrabalhados, 0)
  return {
    minutosTrabalhados,
    diasComMarcacao: comMarcacao.length,
    mediaDiariaMinutos: comMarcacao.length === 0 ? 0 : Math.round(minutosTrabalhados / comMarcacao.length),
  }
}

export function ultimosDiasComMarcacao(dias: DiaEspelhoDTO[], quantidade: number): DiaEspelhoDTO[] {
  return dias
    .filter((dia) => dia.minutosTrabalhados > 0)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, quantidade)
}

/** Dia civil de hoje no fuso do navegador do RH. */
export function hojeCivil(agora: Date = new Date()): string {
  const doisDigitos = (valor: number) => String(valor).padStart(2, '0')
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`
}

/** Saldo do dia contra a jornada padrão (dia não útil conta tudo como extra; abonado não desconta, o abono é somado no backend). */
export function saldoDoDia(dia: DiaEspelhoDTO): number {
  return dia.minutosTrabalhados - (dia.diaUtil && !dia.abonado ? MINUTOS_JORNADA_PADRAO : 0)
}
