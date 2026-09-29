/** Escala numérica de espaçamento, em px. */
export const espacamento = {
  0: 0,
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
  80: 80,
  96: 96,
} as const;

/** Apelidos nomeados para espaçamentos de uso recorrente (px). */
export const espacamentoNomeado = {
  paddingTelaMobile: 16,
  paddingTelaWeb: 32,
  paddingCartao: 24,
  alturaCampo: 56,
  gapPilha: 24,
  alturaBarraSuperior: 64,
  alturaBarraInferior: 88,
  gradeIcone: 24,
  larguraBarraLateral: 256,
  larguraPainelLateral: 440,
  alturaGrafico: 160,
  alturaPreviaDocumento: 320,
  topoPainelLateral: 96,
} as const;
