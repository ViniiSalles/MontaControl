/** String hexadecimal de cor (ex.: `#004d99`). */
export type Cor = string;

/** Um degrau da escala tipográfica (ver tipografia.ts). */
export interface TipografiaToken {
  /** Tamanho da fonte, em px. */
  px: number;
  /** Altura de linha, em px. */
  lineHeight: number;
  /** Peso da fonte (font-weight numérico). */
  peso: number;
  /** Espaçamento entre letras (letter-spacing), em `em` (ex.: `-0.02em`). */
  tracking: string;
}
