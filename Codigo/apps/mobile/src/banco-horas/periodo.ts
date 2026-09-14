import { diaCivilDe } from '../jornada/formatacao';

export interface Periodo {
  mes: number;
  ano: number;
}

export function mesAnterior({ mes, ano }: Periodo): Periodo {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}

export function mesSeguinte({ mes, ano }: Periodo): Periodo {
  return mes === 12 ? { mes: 1, ano: ano + 1 } : { mes: mes + 1, ano };
}

/** Mês/ano corrente no fuso de operação, a partir do instante ISO informado. */
export function periodoAtual(agoraIso: string): Periodo {
  const [ano, mes] = diaCivilDe(agoraIso).split('-').map(Number);
  return { mes, ano };
}

/** O período pedido é o mês corrente? Usado para não deixar navegar para o futuro. */
export function ehMesCorrente(periodo: Periodo, agoraIso: string): boolean {
  const atual = periodoAtual(agoraIso);
  return periodo.mes === atual.mes && periodo.ano === atual.ano;
}
