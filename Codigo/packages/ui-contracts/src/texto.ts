import type { ReactNode } from 'react';

/** Mesmas 16 chaves de `tipografia.ts` — `displayLg`…`overline`. */
export type VarianteTexto =
  | 'displayLg' | 'displayMd' | 'displaySm'
  | 'headlineLg' | 'headlineMd' | 'headlineSm'
  | 'titleLg' | 'titleMd' | 'titleSm'
  | 'bodyLg' | 'bodyMd' | 'bodySm'
  | 'labelLg' | 'labelMd' | 'labelSm'
  | 'overline';

export type AlinhamentoTexto = 'esquerda' | 'centro' | 'direita';

/** Obrigatório no RN — sem cascata CSS, todo texto precisa de um componente. */
export interface PropsTexto {
  variante: VarianteTexto;
  /** Hex de `cores`. Default: `cores.onSurface`. */
  cor?: string;
  /** Sobrescreve o peso default da variante — ver `native/texto.ts`. */
  peso?: number;
  alinhamento?: AlinhamentoTexto;
  numeroDeLinhas?: number;
  /** `tabular-nums` — usado em relógios/contadores (`jornada_home:130`). */
  tabular?: boolean;
  children: ReactNode;
}
