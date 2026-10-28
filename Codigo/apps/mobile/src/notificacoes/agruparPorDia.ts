import { diaNoFuso, somarDias } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../config/fuso';

export interface GrupoPorDia<T> {
  /** `Hoje`, `Ontem` ou `dd/mm/aaaa`. */
  rotulo: string;
  itens: T[];
}

/** `"2026-10-10"` → `"10/10/2026"`. */
function dataBrasileira(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}/${ano}`;
}

/**
 * Agrupa por dia civil **no fuso de operação** (não no do aparelho: o mesmo
 * critério que a API usou para decidir o dia). Recebe os itens do mais novo
 * para o mais antigo e preserva essa ordem. `agoraIso` entra por parâmetro
 * para a tela reavaliar na virada do dia e para o teste fixar o relógio. Um
 * item "do futuro" (relógio do aparelho atrasado) entra em Hoje.
 */
export function agruparPorDia<T extends { criadaEm: string }>(
  itens: readonly T[],
  agoraIso: string,
  fuso: string = FUSO_OPERACAO,
): GrupoPorDia<T>[] {
  const hoje = diaNoFuso(agoraIso, fuso);
  const ontem = somarDias(hoje, -1);

  const grupos: GrupoPorDia<T>[] = [];
  const porRotulo = new Map<string, GrupoPorDia<T>>();

  for (const item of itens) {
    const dia = diaNoFuso(item.criadaEm, fuso);
    const rotulo = dia >= hoje ? 'Hoje' : dia === ontem ? 'Ontem' : dataBrasileira(dia);

    let grupo = porRotulo.get(rotulo);
    if (!grupo) {
      grupo = { rotulo, itens: [] };
      porRotulo.set(rotulo, grupo);
      grupos.push(grupo);
    }
    grupo.itens.push(item);
  }

  return grupos;
}
