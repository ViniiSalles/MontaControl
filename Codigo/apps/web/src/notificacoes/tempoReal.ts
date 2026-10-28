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
