import type { NomeIcone } from '@montacontrol/design-tokens/icones';

export interface PropsIcone {
  nome: NomeIcone;
  /** px. Default: 24 (`gradeIcone` de `espacamento.ts`). */
  tamanho?: number;
  /** Hex de `cores`. Default: `currentColor`-like — herda do Texto pai se omitido. */
  cor?: string;
  preenchido?: boolean;
}
