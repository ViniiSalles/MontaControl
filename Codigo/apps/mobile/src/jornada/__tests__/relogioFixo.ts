/**
 * Relógio de teste fixo. Várias telas decidem "hoje" pelo dia civil em
 * America/Sao_Paulo; com o relógio real, os testes quebravam logo depois da
 * meia-noite (um check-in "há 2 h" caía no dia anterior). 14:00 em SP fica
 * longe da virada do dia para os dois lados.
 */
export const AGORA_FIXO_ISO = '2026-10-14T17:00:00.000Z';
export const AGORA_FIXO_MS = Date.parse(AGORA_FIXO_ISO);

/**
 * `advanceTimers: true` é obrigatório com `waitFor` do Testing Library: sem
 * isso o polling nunca avança e a suíte trava.
 */
export function fixarRelogio(): void {
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date(AGORA_FIXO_ISO));
}

export function soltarRelogio(): void {
  jest.useRealTimers();
}
