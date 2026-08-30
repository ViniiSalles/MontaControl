/**
 * Fuso em que toda hora exibida ao montador é formatada (histórico de
 * jornada, ponto em atraso). Espelha `apps/api/src/common/fuso.ts` — o
 * backend já avalia toda regra de data nesse fuso, então exibir num fuso
 * diferente do aparelho descasaria a hora mostrada da hora que a API usou
 * para decidir o dia civil.
 */
export const FUSO_OPERACAO = 'America/Sao_Paulo';
