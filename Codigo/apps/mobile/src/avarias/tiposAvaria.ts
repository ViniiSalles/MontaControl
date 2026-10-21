import { NOME_TIPO_AVARIA_OUTRO } from '@montacontrol/shared';
import type { TipoAvariaDTO } from '@montacontrol/shared';

/** "Outro" é o tipo para problema fora da lista: o montador o descreve na descrição. */
export function ehTipoOutro(tipo: Pick<TipoAvariaDTO, 'nome'>): boolean {
  return tipo.nome.trim().toLowerCase() === NOME_TIPO_AVARIA_OUTRO.toLowerCase();
}

/** "Outro" sempre por último: é a saída quando nenhum tipo da lista serve. */
export function ordenarTiposComOutroPorUltimo(tipos: readonly TipoAvariaDTO[]): TipoAvariaDTO[] {
  return [...tipos.filter((tipo) => !ehTipoOutro(tipo)), ...tipos.filter(ehTipoOutro)];
}
