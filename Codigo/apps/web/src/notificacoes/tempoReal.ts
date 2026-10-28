const LIMITE_SELO = 9

/** Texto do selo do sino: `null` sem não lidas (selo some); acima de 9 vira `9+`. */
export function rotuloContadorNotificacoes(naoLidas: number): string | null {
  if (naoLidas <= 0) return null
  return naoLidas > LIMITE_SELO ? `${LIMITE_SELO}+` : String(naoLidas)
}

/** Nome acessível do sino — traz a contagem real, sem o limite visual do selo. */
export function rotuloAcessivelSino(naoLidas: number): string {
  if (naoLidas <= 0) return 'Notificações, nenhuma não lida'
  return `Notificações, ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}`
}

/** Com o socket de pé o dashboard é atualizado por evento; a consulta periódica é só o plano B. */
export function deveFazerPolling(conectado: boolean): boolean {
  return !conectado
}

/**
 * Plano B: com o socket fora (`conectado === false`), a lista de notificações
 * e o dashboard voltam a se atualizar por REST neste intervalo.
 */
export const INTERVALO_PLANO_B_MS = 30_000

/** Primeira espera (ms) antes de reabrir um socket recusado pelo servidor; dobra a cada recusa seguida. */
export const ATRASO_INICIAL = 2_000
/** Teto da espera (ms): uma recusa persistente gera no máximo uma tentativa por minuto. */
export const ATRASO_MAXIMO = 60_000

/** Próxima espera da retentativa: o dobro da atual, limitado a `ATRASO_MAXIMO`. */
export function proximoAtraso(atual: number): number {
  return Math.min(atual * 2, ATRASO_MAXIMO)
}

/**
 * URL onde o socket conecta, lida de `VITE_WS_URL` no build. Ausente ou em
 * branco: `undefined`, e o socket usa o próprio origin (dev local, pelo proxy
 * `/socket.io` do Vite). No Render o site estático não faz proxy de WebSocket,
 * então o build aponta direto para a API.
 */
export function urlDoSocket(env: { VITE_WS_URL?: string }): string | undefined {
  const url = env.VITE_WS_URL?.trim()
  return url ? url : undefined
}
