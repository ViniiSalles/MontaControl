/**
 * Fuso em que toda regra de data do sistema é avaliada: janela de aceitação
 * do check-in, limite retroativo do ponto em atraso e agrupamento do
 * histórico. Avaliar qualquer uma delas em UTC empurraria toda jornada
 * noturna para o dia seguinte.
 */
export const FUSO_OPERACAO = 'America/Sao_Paulo';
