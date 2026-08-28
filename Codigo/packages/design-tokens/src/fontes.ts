/**
 * Família tipográfica e pesos disponíveis. O carregamento real da fonte
 * (`@font-face` / self-hosting) é responsabilidade do app consumidor (web:
 * Fase 11/T11.2); este módulo só descreve os dados.
 */
export const fontes = {
  familia: 'Inter',
  // 400/600/700/800 são usados por tipografia.ts; 500 incluído à parte por
  // ser comum em componentes de formulário Material 3 (ex.: estado
  // "preenchido" de campos de texto).
  pesos: [400, 500, 600, 700, 800] as const,
} as const;
