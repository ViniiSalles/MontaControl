import type { NomeIcone } from '@montacontrol/design-tokens/icones';

export interface ItemBarraNavInferior {
  rotulo: string;
  icone: NomeIcone;
  ativo: boolean;
  /** Sprint 1 entrega 1 aba ativa (Jornada) e 4 desabilitadas — ver `jornada_home:216-242`. */
  desabilitado?: boolean;
  aoPressionar?: () => void;
}

export interface PropsBarraNavInferior {
  itens: ItemBarraNavInferior[];
}
